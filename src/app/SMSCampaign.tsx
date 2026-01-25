'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Candidate {
  id: string;
  name: string | null;
  phone_e164: string;
  status: string;
  source: string | null;
  last_called_at: string | null;
  sms_opt_out?: boolean;
  roles?: string[];
}

interface SendLog {
  phone: string;
  name: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error?: string;
  reason?: string;
}

interface Conversation {
  phone: string;
  name: string | null;
  candidateId: string | null;
  roles: string[] | null;
  candidateStatus: string | null;
  messages: any[];
  lastMessage: any;
  hasResponse: boolean;
  latestIntent: string | null;
  latestSentiment: string | null;
  lastActivity: Date;
  unreadCount: number;
}

interface Campaign {
  id: string;
  name: string;
  template: string;
  total_recipients: number;
  sent_count: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

export default function SMSCampaignView() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'conversations' | 'history'>('compose');
  
  // Compose state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Hi {name}, this is [Your Name] from [Company]. We have care positions available near you. Are you looking for work? Reply YES if interested or STOP to opt out.');
  const [campaignName, setCampaignName] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterCalled, setFilterCalled] = useState('all');
  const [filterSmsHistory, setFilterSmsHistory] = useState('all');
  const [excludeOptOut, setExcludeOptOut] = useState(true);
  const [excludeRecentlySent, setExcludeRecentlySent] = useState(true);
  const [recentDays, setRecentDays] = useState(7);
  
  // Gateway settings
  const [gatewayUrl, setGatewayUrl] = useState('http://192.168.1.100:8080');
  const [gatewayUsername, setGatewayUsername] = useState('');
  const [gatewayPassword, setGatewayPassword] = useState('');
  const [sendDelay, setSendDelay] = useState(30);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null);
  
  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sendLog, setSendLog] = useState<SendLog[]>([]);
  const [sentPhones, setSentPhones] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);
  
  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [convoFilter, setConvoFilter] = useState<'all' | 'needs_action' | 'interested' | 'not_interested'>('all');
  const [convoSearch, setConvoSearch] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // History state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load settings on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('smsGatewaySettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setGatewayUrl(settings.url || 'http://192.168.1.100:8080');
        setGatewayUsername(settings.username || '');
        setGatewayPassword(settings.password || '');
        setSendDelay(settings.delay || 30);
      } catch (e) {
        console.error('Error loading settings:', e);
      }
    }
    loadCandidates();
    loadConversations();
    loadCampaigns();
    loadSentPhones();
  }, []);

  // Auto-refresh conversations every 30 seconds
  useEffect(() => {
    if (activeTab === 'conversations') {
      const interval = setInterval(loadConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const saveGatewaySettings = () => {
    localStorage.setItem('smsGatewaySettings', JSON.stringify({
      url: gatewayUrl,
      username: gatewayUsername,
      password: gatewayPassword,
      delay: sendDelay
    }));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  // Test gateway connection
  const testGatewayConnection = async () => {
    try {
      const credentials = btoa(`${gatewayUsername}:${gatewayPassword}`);
      const response = await fetch(`${gatewayUrl}/health`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${credentials}` }
      });
      setGatewayConnected(response.ok);
    } catch {
      setGatewayConnected(false);
    }
  };

  async function loadCandidates() {
    setLoading(true);
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, source, last_called_at, sms_opt_out, roles')
      .not('phone_e164', 'is', null)
      .order('created_at', { ascending: false });
    if (data) setCandidates(data);
    setLoading(false);
  }

  async function loadSentPhones() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - recentDays);
    
    const { data } = await supabase
      .from('sms_messages')
      .select('phone_e164')
      .eq('direction', 'outbound')
      .gte('created_at', cutoffDate.toISOString());
    
    if (data) {
      setSentPhones(new Set(data.map(m => m.phone_e164)));
    }
  }

  async function loadConversations() {
    const { data } = await supabase
      .from('sms_messages')
      .select('*, candidates(id, name, roles, status)')
      .order('created_at', { ascending: false })
      .limit(500);
    
    if (data) {
      const grouped = new Map<string, any[]>();
      data.forEach(msg => {
        const existing = grouped.get(msg.phone_e164) || [];
        existing.push(msg);
        grouped.set(msg.phone_e164, existing);
      });
      
      const convos: Conversation[] = Array.from(grouped.entries()).map(([phone, msgs]) => {
        const sortedMsgs = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const latestInbound = msgs.filter(m => m.direction === 'inbound').sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        const latestOutbound = msgs.filter(m => m.direction === 'outbound').sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        
        // Unread = inbound after latest outbound
        let unreadCount = 0;
        if (latestInbound && latestOutbound) {
          unreadCount = msgs.filter(m => 
            m.direction === 'inbound' && 
            new Date(m.created_at) > new Date(latestOutbound.created_at)
          ).length;
        } else if (latestInbound && !latestOutbound) {
          unreadCount = msgs.filter(m => m.direction === 'inbound').length;
        }
        
        return {
          phone,
          name: msgs.find(m => m.candidates?.name)?.candidates?.name || null,
          candidateId: msgs.find(m => m.candidates?.id)?.candidates?.id || null,
          roles: msgs.find(m => m.candidates?.roles)?.candidates?.roles || null,
          candidateStatus: msgs.find(m => m.candidates?.status)?.candidates?.status || null,
          messages: sortedMsgs,
          lastMessage: msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0],
          hasResponse: msgs.some(m => m.direction === 'inbound'),
          latestIntent: latestInbound?.ai_intent || null,
          latestSentiment: latestInbound?.ai_sentiment || null,
          lastActivity: new Date(msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at),
          unreadCount
        };
      });
      
      // Sort by last activity
      convos.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      setConversations(convos);
    }
  }

  async function loadCampaigns() {
    const { data } = await supabase
      .from('sms_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setCampaigns(data);
  }

  // Phone number validation
  const isValidUKMobile = (phone: string): { valid: boolean; reason?: string } => {
    if (!phone) return { valid: false, reason: 'No phone number' };
    
    // Remove spaces and normalize
    const cleaned = phone.replace(/\s+/g, '');
    
    // Check E.164 format
    if (!cleaned.startsWith('+44') && !cleaned.startsWith('44') && !cleaned.startsWith('0')) {
      return { valid: false, reason: 'Not a UK number' };
    }
    
    // Convert to E.164
    let e164 = cleaned;
    if (cleaned.startsWith('0')) {
      e164 = '+44' + cleaned.slice(1);
    } else if (cleaned.startsWith('44')) {
      e164 = '+' + cleaned;
    }
    
    // UK mobile numbers start with +447
    if (!e164.startsWith('+447')) {
      return { valid: false, reason: 'Not a mobile number' };
    }
    
    // Should be 13 characters total (+44 + 10 digits)
    if (e164.length !== 13) {
      return { valid: false, reason: 'Invalid length' };
    }
    
    return { valid: true };
  };

  // Filter candidates with validation
  const filteredCandidates = candidates.filter(c => {
    if (!c.phone_e164) return false;
    
    // Validate phone number
    const validation = isValidUKMobile(c.phone_e164);
    if (!validation.valid) return false;
    
    // Exclude opted out
    if (excludeOptOut && c.sms_opt_out) return false;
    
    // Exclude recently sent
    if (excludeRecentlySent && sentPhones.has(c.phone_e164)) return false;
    
    // Status filter
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    
    // Source filter
    if (filterSource !== 'all' && c.source !== filterSource) return false;
    
    // Called filter
    if (filterCalled === 'called' && !c.last_called_at) return false;
    if (filterCalled === 'not-called' && c.last_called_at) return false;
    
    return true;
  });

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    // Search filter
    if (convoSearch) {
      const search = convoSearch.toLowerCase();
      const matchesName = c.name?.toLowerCase().includes(search);
      const matchesPhone = c.phone.includes(search);
      const matchesMessage = c.messages.some(m => m.message_text?.toLowerCase().includes(search));
      if (!matchesName && !matchesPhone && !matchesMessage) return false;
    }
    
    // Intent filter
    if (convoFilter === 'needs_action') {
      return c.hasResponse && ['interested', 'callback_request', 'question'].includes(c.latestIntent || '');
    }
    if (convoFilter === 'interested') {
      return c.latestIntent === 'interested';
    }
    if (convoFilter === 'not_interested') {
      return ['not_interested', 'stop_request'].includes(c.latestIntent || '');
    }
    
    return true;
  });

  const sources = [...new Set(candidates.map(c => c.source).filter(Boolean))];
  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160);
  const totalSeconds = filteredCandidates.length * sendDelay;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const personalizeMessage = (template: string, candidate: Candidate) => {
    const firstName = candidate.name?.split(' ')[0] || 'there';
    return template
      .replace(/{name}/g, firstName)
      .replace(/{full_name}/g, candidate.name || 'Candidate');
  };

  async function sendViaGateway(phone: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      const credentials = btoa(`${gatewayUsername}:${gatewayPassword}`);
      const response = await fetch(`${gatewayUrl}/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify({ 
          message: text, 
          phoneNumbers: [phone] 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.message || `HTTP ${response.status}` };
      }
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  async function sendTestSMS() {
    if (!testPhone) return;
    
    setTestSending(true);
    setTestResult(null);
    
    const validation = isValidUKMobile(testPhone);
    if (!validation.valid) {
      setTestResult({ success: false, message: validation.reason || 'Invalid number' });
      setTestSending(false);
      return;
    }
    
    // Normalize phone
    let phone = testPhone.replace(/\s+/g, '');
    if (phone.startsWith('0')) phone = '+44' + phone.slice(1);
    if (!phone.startsWith('+')) phone = '+' + phone;
    
    const testMsg = personalizeMessage(message, { 
      id: 'test', 
      name: 'Test User', 
      phone_e164: phone, 
      status: 'test', 
      source: null, 
      last_called_at: null 
    });
    
    const result = await sendViaGateway(phone, testMsg);
    
    if (result.success) {
      setTestResult({ success: true, message: 'Test SMS sent successfully!' });
    } else {
      setTestResult({ success: false, message: result.error || 'Failed to send' });
    }
    
    setTestSending(false);
  }

  async function startSending() {
    if (filteredCandidates.length === 0) return;
    if (!gatewayUsername || !gatewayPassword) {
      alert('Please enter gateway credentials and save settings first.');
      return;
    }
    
    setIsSending(true);
    setIsPaused(false);
    abortRef.current = false;
    setCurrentIndex(0);
    setSendLog([]);
    
    // Track phones sent in this campaign to avoid duplicates
    const campaignSentPhones = new Set<string>();

    // Create campaign record
    const { data: campaign } = await supabase.from('sms_campaigns').insert({
      name: campaignName || `Campaign ${new Date().toLocaleDateString('en-GB')}`,
      template: message,
      total_recipients: filteredCandidates.length,
      sent_count: 0,
      status: 'sending',
      started_at: new Date().toISOString()
    }).select().single();

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < filteredCandidates.length; i++) {
      if (abortRef.current) break;
      
      // Handle pause
      while (isPaused && !abortRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (abortRef.current) break;

      const candidate = filteredCandidates[i];
      setCurrentIndex(i);
      
      // Skip duplicate in this campaign
      if (campaignSentPhones.has(candidate.phone_e164)) {
        setSendLog(prev => [...prev, { 
          phone: candidate.phone_e164, 
          name: candidate.name || 'Unknown', 
          status: 'skipped',
          reason: 'Duplicate in campaign'
        }]);
        skippedCount++;
        continue;
      }
      
      // Validate phone one more time
      const validation = isValidUKMobile(candidate.phone_e164);
      if (!validation.valid) {
        setSendLog(prev => [...prev, { 
          phone: candidate.phone_e164, 
          name: candidate.name || 'Unknown', 
          status: 'skipped',
          reason: validation.reason
        }]);
        skippedCount++;
        continue;
      }

      const personalizedMsg = personalizeMessage(message, candidate);
      setSendLog(prev => [...prev, { 
        phone: candidate.phone_e164, 
        name: candidate.name || 'Unknown', 
        status: 'pending' 
      }]);

      const result = await sendViaGateway(candidate.phone_e164, personalizedMsg);
      
      if (result.success) {
        // Record in database
        await supabase.from('sms_messages').insert({
          candidate_id: candidate.id,
          phone_e164: candidate.phone_e164,
          direction: 'outbound',
          message_text: personalizedMsg,
          campaign_id: campaign?.id,
          status: 'sent',
          sent_at: new Date().toISOString()
        });
        
        campaignSentPhones.add(candidate.phone_e164);
        sentCount++;
        
        setSendLog(prev => prev.map((item, idx) => 
          idx === prev.length - 1 ? { ...item, status: 'sent' } : item
        ));
      } else {
        failedCount++;
        setSendLog(prev => prev.map((item, idx) => 
          idx === prev.length - 1 ? { ...item, status: 'failed', error: result.error } : item
        ));
      }

      // Update campaign progress
      if (campaign?.id && (sentCount + failedCount) % 10 === 0) {
        await supabase.from('sms_campaigns')
          .update({ sent_count: sentCount })
          .eq('id', campaign.id);
      }

      // Delay between messages
      if (i < filteredCandidates.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, sendDelay * 1000));
      }
    }

    // Finalize campaign
    if (campaign?.id) {
      await supabase.from('sms_campaigns').update({ 
        status: abortRef.current ? 'stopped' : 'completed', 
        sent_count: sentCount,
        completed_at: new Date().toISOString() 
      }).eq('id', campaign.id);
    }
    
    setIsSending(false);
    loadCampaigns();
    loadSentPhones();
  }

  async function sendReply() {
    if (!selectedConvo || !replyMessage.trim()) return;
    
    setSendingReply(true);
    const result = await sendViaGateway(selectedConvo.phone, replyMessage);
    
    if (result.success) {
      await supabase.from('sms_messages').insert({
        candidate_id: selectedConvo.candidateId,
        phone_e164: selectedConvo.phone,
        direction: 'outbound',
        message_text: replyMessage,
        status: 'sent',
        sent_at: new Date().toISOString()
      });
      
      setReplyMessage('');
      loadConversations();
    } else {
      alert('Failed to send: ' + (result.error || 'Unknown error'));
    }
    
    setSendingReply(false);
  }

  function exportToCSV() {
    const rows = [['Phone', 'Name', 'Status', 'Message']];
    filteredCandidates.forEach(c => rows.push([
      c.phone_e164, 
      c.name || '', 
      c.status,
      personalizeMessage(message, c)
    ]));
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sms-campaign-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const getIntentConfig = (intent: string | null) => {
    switch (intent) {
      case 'interested': return { bg: '#dcfce7', text: '#166534', icon: '✓', label: 'Interested' };
      case 'callback_request': return { bg: '#dbeafe', text: '#1e40af', icon: '📞', label: 'Callback' };
      case 'question': return { bg: '#fef3c7', text: '#92400e', icon: '❓', label: 'Question' };
      case 'not_interested': return { bg: '#fee2e2', text: '#991b1b', icon: '✗', label: 'Not Interested' };
      case 'stop_request': return { bg: '#fee2e2', text: '#991b1b', icon: '🚫', label: 'Opt-Out' };
      default: return { bg: '#f3f4f6', text: '#6b7280', icon: '?', label: 'Unknown' };
    }
  };

  const getSentimentConfig = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive': return { bg: '#dcfce7', text: '#166534' };
      case 'negative': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  // Stats
  const stats = {
    needsAction: conversations.filter(c => 
      c.hasResponse && ['interested', 'callback_request', 'question'].includes(c.latestIntent || '')
    ).length,
    interested: conversations.filter(c => c.latestIntent === 'interested').length,
    totalResponses: conversations.filter(c => c.hasResponse).length
  };

  return (
    <div style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', minHeight: '100%' }}>
      <style>{`
        .sms-container { min-height: 100vh; }
        
        /* Tabs */
        .sms-tabs { display: flex; border-bottom: 1px solid #e5e7eb; background: #fff; padding: 0 24px; }
        .sms-tab { 
          padding: 16px 24px; font-size: 14px; font-weight: 600; color: #6b7280; 
          cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s;
          display: flex; align-items: center; gap: 8px;
        }
        .sms-tab:hover { color: #111; background: #f9fafb; }
        .sms-tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }
        .sms-badge { 
          padding: 2px 8px; background: #ef4444; color: #fff; border-radius: 10px; 
          font-size: 11px; font-weight: 700; 
        }
        .sms-badge.green { background: #22c55e; }
        
        /* Panels */
        .sms-compose { display: grid; grid-template-columns: 1fr 400px; gap: 24px; padding: 24px; }
        @media(max-width: 1200px) { .sms-compose { grid-template-columns: 1fr; } }
        .sms-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
        .sms-panel-header { 
          padding: 16px 20px; border-bottom: 1px solid #e5e7eb; 
          font-size: 15px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;
        }
        .sms-panel-body { padding: 20px; }
        
        /* Inputs */
        .sms-input { 
          width: 100%; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 10px; 
          font-size: 14px; margin-bottom: 12px; box-sizing: border-box; transition: all 0.2s;
        }
        .sms-input:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
        .sms-textarea { 
          width: 100%; padding: 14px 16px; border: 2px solid #e5e7eb; border-radius: 10px; 
          font-size: 14px; resize: vertical; min-height: 120px; box-sizing: border-box; 
          font-family: inherit; line-height: 1.6; transition: all 0.2s;
        }
        .sms-textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1); }
        
        /* Filters */
        .sms-filters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .sms-filter select { 
          padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 8px; 
          font-size: 13px; font-weight: 500; cursor: pointer; background: #fff;
        }
        .sms-filter select:focus { outline: none; border-color: #4f46e5; }
        
        /* Stats */
        .sms-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .sms-stat { 
          text-align: center; padding: 16px; background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); 
          border-radius: 12px; 
        }
        .sms-stat strong { display: block; font-size: 24px; font-weight: 800; color: #111; }
        .sms-stat small { font-size: 11px; color: #6b7280; font-weight: 500; }
        
        /* Buttons */
        .sms-btn { 
          padding: 14px 20px; font-size: 14px; font-weight: 600; border-radius: 10px; 
          cursor: pointer; border: none; width: 100%; margin-bottom: 10px; transition: all 0.2s;
        }
        .sms-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sms-btn.primary { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #fff; }
        .sms-btn.primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); }
        .sms-btn.secondary { background: #f3f4f6; color: #374151; }
        .sms-btn.secondary:hover:not(:disabled) { background: #e5e7eb; }
        .sms-btn.danger { background: #fee2e2; color: #dc2626; }
        .sms-btn.danger:hover:not(:disabled) { background: #fecaca; }
        .sms-btn.small { padding: 8px 14px; font-size: 12px; width: auto; margin: 0; }
        
        /* Progress */
        .sms-progress { margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 12px; }
        .sms-progress-bar { height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; }
        .sms-progress-fill { height: 100%; background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%); transition: width 0.3s; }
        
        /* Send Log */
        .sms-log { max-height: 250px; overflow-y: auto; font-size: 12px; margin-top: 12px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .sms-log-item { 
          padding: 10px 14px; border-bottom: 1px solid #f3f4f6; 
          display: flex; justify-content: space-between; align-items: center;
        }
        .sms-log-item:last-child { border-bottom: none; }
        .sms-log-item.sent { background: #f0fdf4; }
        .sms-log-item.failed { background: #fef2f2; }
        .sms-log-item.skipped { background: #fefce8; }
        .sms-log-status { 
          padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; 
        }
        .sms-log-status.sent { background: #dcfce7; color: #166534; }
        .sms-log-status.failed { background: #fee2e2; color: #991b1b; }
        .sms-log-status.skipped { background: #fef3c7; color: #92400e; }
        .sms-log-status.pending { background: #e0e7ff; color: #3730a3; }
        
        /* Gateway Status */
        .sms-gateway-status { 
          display: flex; align-items: center; gap: 6px; font-size: 12px; 
          padding: 6px 12px; border-radius: 6px; 
        }
        .sms-gateway-status.connected { background: #dcfce7; color: #166534; }
        .sms-gateway-status.disconnected { background: #fee2e2; color: #991b1b; }
        .sms-gateway-status.unknown { background: #f3f4f6; color: #6b7280; }
        
        /* Conversations */
        .sms-convo-container { display: flex; height: calc(100vh - 120px); }
        .sms-convo-sidebar { width: 380px; border-right: 1px solid #e5e7eb; background: #fff; display: flex; flex-direction: column; }
        .sms-convo-header { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
        .sms-convo-search { 
          width: 100%; padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 8px; 
          font-size: 13px; box-sizing: border-box; margin-bottom: 12px;
        }
        .sms-convo-filters { display: flex; gap: 6px; flex-wrap: wrap; }
        .sms-convo-filter { 
          padding: 6px 12px; border: none; border-radius: 6px; font-size: 11px; 
          font-weight: 600; cursor: pointer; background: #f3f4f6; color: #6b7280;
          transition: all 0.2s;
        }
        .sms-convo-filter:hover { background: #e5e7eb; }
        .sms-convo-filter.active { background: #4f46e5; color: #fff; }
        
        .sms-convo-list { flex: 1; overflow-y: auto; }
        .sms-convo { 
          padding: 14px 20px; border-bottom: 1px solid #f3f4f6; cursor: pointer; 
          display: flex; gap: 12px; align-items: center; transition: all 0.15s;
        }
        .sms-convo:hover { background: #f9fafb; }
        .sms-convo.active { background: #eef2ff; border-left: 3px solid #4f46e5; }
        .sms-convo.unread { background: #fefce8; }
        .sms-convo-avatar { 
          width: 44px; height: 44px; border-radius: 12px; 
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); 
          color: #fff; display: flex; align-items: center; justify-content: center; 
          font-weight: 700; font-size: 16px; flex-shrink: 0;
        }
        .sms-convo-info { flex: 1; min-width: 0; }
        .sms-convo-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .sms-convo-name { font-weight: 600; font-size: 14px; color: #111; }
        .sms-convo-time { font-size: 11px; color: #9ca3af; }
        .sms-convo-preview { font-size: 13px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sms-convo-badge { 
          padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; 
          white-space: nowrap; display: flex; align-items: center; gap: 4px;
        }
        .sms-unread-dot { 
          width: 8px; height: 8px; background: #ef4444; border-radius: 50%; 
          margin-left: auto; flex-shrink: 0;
        }
        
        /* Conversation Detail */
        .sms-detail { flex: 1; display: flex; flex-direction: column; background: #f8fafc; }
        .sms-detail-header { 
          padding: 16px 24px; background: #fff; border-bottom: 1px solid #e5e7eb; 
          display: flex; justify-content: space-between; align-items: center;
        }
        .sms-detail-info h3 { font-size: 16px; font-weight: 700; margin: 0 0 4px 0; }
        .sms-detail-meta { display: flex; gap: 12px; font-size: 12px; color: #6b7280; }
        .sms-detail-actions { display: flex; gap: 8px; }
        
        .sms-messages { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .sms-message { max-width: 75%; padding: 12px 16px; border-radius: 16px; position: relative; }
        .sms-message.out { 
          background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); 
          color: #fff; align-self: flex-end; border-bottom-right-radius: 4px;
        }
        .sms-message.in { 
          background: #fff; border: 1px solid #e5e7eb; 
          align-self: flex-start; border-bottom-left-radius: 4px;
        }
        .sms-message-text { font-size: 14px; line-height: 1.5; }
        .sms-message-time { font-size: 10px; opacity: 0.7; margin-top: 6px; }
        
        .sms-ai-analysis { 
          max-width: 75%; margin-top: -4px; padding: 12px 16px; 
          background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); 
          border: 1px solid #fde047; border-radius: 12px; font-size: 12px;
          align-self: flex-start;
        }
        .sms-ai-header { font-weight: 700; color: #854d0e; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .sms-ai-summary { color: #713f12; line-height: 1.5; }
        .sms-ai-action { 
          margin-top: 8px; padding: 6px 10px; background: rgba(0,0,0,0.05); 
          border-radius: 6px; font-weight: 600; display: inline-block;
        }
        
        .sms-reply-box { 
          padding: 16px 24px; background: #fff; border-top: 1px solid #e5e7eb; 
          display: flex; gap: 12px; align-items: flex-end;
        }
        .sms-reply-input { 
          flex: 1; padding: 12px 16px; border: 2px solid #e5e7eb; border-radius: 12px; 
          font-size: 14px; resize: none; min-height: 44px; max-height: 120px; 
          font-family: inherit; box-sizing: border-box;
        }
        .sms-reply-input:focus { outline: none; border-color: #4f46e5; }
        .sms-reply-btn { 
          padding: 12px 24px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); 
          color: #fff; border: none; border-radius: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.2s;
        }
        .sms-reply-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }
        .sms-reply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        /* Empty States */
        .sms-empty { 
          flex: 1; display: flex; flex-direction: column; align-items: center; 
          justify-content: center; color: #9ca3af; padding: 40px;
        }
        .sms-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
        .sms-empty-text { font-size: 14px; text-align: center; }
        
        /* Campaign History */
        .sms-history { padding: 24px; }
        .sms-history-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
        .sms-history-table th { 
          padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; 
          color: #6b7280; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
        }
        .sms-history-table td { 
          padding: 14px 16px; font-size: 13px; border-bottom: 1px solid #f3f4f6;
        }
        .sms-history-table tr:hover { background: #f9fafb; }
        .sms-campaign-status { 
          padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
        }
        .sms-campaign-status.completed { background: #dcfce7; color: #166534; }
        .sms-campaign-status.sending { background: #dbeafe; color: #1e40af; }
        .sms-campaign-status.stopped { background: #fee2e2; color: #991b1b; }
        
        /* Test SMS */
        .sms-test-box { 
          margin-top: 16px; padding: 16px; background: #f0f9ff; border: 1px solid #bae6fd; 
          border-radius: 12px; 
        }
        .sms-test-result { 
          margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
        }
        .sms-test-result.success { background: #dcfce7; color: #166534; }
        .sms-test-result.error { background: #fee2e2; color: #991b1b; }
        
        /* Checkbox styling */
        .sms-checkbox { 
          display: flex; align-items: center; gap: 10px; font-size: 13px; 
          cursor: pointer; padding: 8px 0;
        }
        .sms-checkbox input { width: 18px; height: 18px; cursor: pointer; }
      `}</style>

      {/* Tabs */}
      <div className="sms-tabs">
        <div className={`sms-tab ${activeTab === 'compose' ? 'active' : ''}`} onClick={() => setActiveTab('compose')}>
          📝 Compose
        </div>
        <div 
          className={`sms-tab ${activeTab === 'conversations' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('conversations'); loadConversations(); }}
        >
          💬 Conversations
          {stats.needsAction > 0 && <span className="sms-badge">{stats.needsAction}</span>}
          {stats.needsAction === 0 && stats.totalResponses > 0 && (
            <span className="sms-badge green">{stats.totalResponses}</span>
          )}
        </div>
        <div className={`sms-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); loadCampaigns(); }}>
          📊 History
        </div>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="sms-compose">
          <div>
            {/* Message Template */}
            <div className="sms-panel">
              <div className="sms-panel-header">
                📝 Message Template
                <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
                  {charCount} chars • {smsCount} SMS
                </span>
              </div>
              <div className="sms-panel-body">
                <input 
                  className="sms-input" 
                  placeholder="Campaign name (optional)" 
                  value={campaignName} 
                  onChange={e => setCampaignName(e.target.value)} 
                />
                <textarea 
                  className="sms-textarea" 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  placeholder="Type your message... Use {name} for first name" 
                />
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  Variables: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{'{name}'}</code>{' '}
                  <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{'{full_name}'}</code>
                </div>
              </div>
            </div>

            {/* Target Audience */}
            <div className="sms-panel" style={{ marginTop: 20 }}>
              <div className="sms-panel-header">
                🎯 Target Audience
                <span style={{ 
                  fontSize: 13, fontWeight: 700, 
                  color: filteredCandidates.length > 0 ? '#16a34a' : '#dc2626' 
                }}>
                  {filteredCandidates.length} recipients
                </span>
              </div>
              <div className="sms-panel-body">
                <div className="sms-filters">
                  <div className="sms-filter">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="new">New</option>
                      <option value="screening">Screening</option>
                      <option value="interviewed">Interviewed</option>
                    </select>
                  </div>
                  <div className="sms-filter">
                    <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                      <option value="all">All Sources</option>
                      {sources.map(s => <option key={s} value={s!}>{s}</option>)}
                    </select>
                  </div>
                  <div className="sms-filter">
                    <select value={filterCalled} onChange={e => setFilterCalled(e.target.value)}>
                      <option value="all">All</option>
                      <option value="called">Called</option>
                      <option value="not-called">Not Called</option>
                    </select>
                  </div>
                </div>
                
                <label className="sms-checkbox">
                  <input 
                    type="checkbox" 
                    checked={excludeOptOut} 
                    onChange={e => setExcludeOptOut(e.target.checked)} 
                  />
                  Exclude opted-out candidates
                </label>
                
                <label className="sms-checkbox">
                  <input 
                    type="checkbox" 
                    checked={excludeRecentlySent} 
                    onChange={e => setExcludeRecentlySent(e.target.checked)} 
                  />
                  Exclude candidates messaged in last {recentDays} days
                  {excludeRecentlySent && (
                    <span style={{ marginLeft: 8, color: '#6b7280' }}>
                      ({sentPhones.size} excluded)
                    </span>
                  )}
                </label>
              </div>
            </div>

            {/* AI Info */}
            <div className="sms-ai-analysis" style={{ marginTop: 20, maxWidth: '100%' }}>
              <div className="sms-ai-header">🤖 AI Response Analysis</div>
              <div className="sms-ai-summary">
                When candidates reply, AI automatically analyzes their responses to detect 
                interest level, callback requests, questions, and opt-outs. 
                View and respond to analyzed messages in the Conversations tab.
              </div>
            </div>
          </div>

          {/* Send Panel */}
          <div>
            <div className="sms-panel">
              <div className="sms-panel-header">
                🚀 Send
                <div 
                  className={`sms-gateway-status ${
                    gatewayConnected === true ? 'connected' : 
                    gatewayConnected === false ? 'disconnected' : 'unknown'
                  }`}
                  onClick={testGatewayConnection}
                  style={{ cursor: 'pointer' }}
                >
                  {gatewayConnected === true ? '✓ Connected' : 
                   gatewayConnected === false ? '✗ Disconnected' : '? Check Connection'}
                </div>
              </div>
              <div className="sms-panel-body">
                <div className="sms-stats">
                  <div className="sms-stat">
                    <strong>{filteredCandidates.length}</strong>
                    <small>RECIPIENTS</small>
                  </div>
                  <div className="sms-stat">
                    <strong>{smsCount}</strong>
                    <small>SMS EACH</small>
                  </div>
                  <div className="sms-stat">
                    <strong>{sendDelay}s</strong>
                    <small>DELAY</small>
                  </div>
                  <div className="sms-stat">
                    <strong>{hours > 0 ? `${hours}h` : ''}{minutes}m</strong>
                    <small>EST. TIME</small>
                  </div>
                </div>

                <input 
                  className="sms-input" 
                  value={gatewayUrl} 
                  onChange={e => setGatewayUrl(e.target.value)} 
                  placeholder="Gateway URL (e.g., http://192.168.1.100:8080)" 
                />
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input 
                    className="sms-input" 
                    value={gatewayUsername} 
                    onChange={e => setGatewayUsername(e.target.value)} 
                    placeholder="Username" 
                    style={{ marginBottom: 0 }}
                  />
                  <input 
                    className="sms-input" 
                    type="password"
                    value={gatewayPassword} 
                    onChange={e => setGatewayPassword(e.target.value)} 
                    placeholder="Password" 
                    style={{ marginBottom: 0 }}
                  />
                </div>
                
                <button 
                  className="sms-btn secondary"
                  onClick={saveGatewaySettings}
                  style={{ 
                    background: settingsSaved ? '#dcfce7' : undefined,
                    color: settingsSaved ? '#166534' : undefined
                  }}
                >
                  {settingsSaved ? '✓ Settings Saved!' : '💾 Save Gateway Settings'}
                </button>
                
                <div style={{ marginBottom: 16, marginTop: 8 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                    Delay between messages: {sendDelay} seconds
                  </label>
                  <input 
                    type="range" 
                    min="10" 
                    max="120" 
                    value={sendDelay} 
                    onChange={e => setSendDelay(parseInt(e.target.value))} 
                    style={{ width: '100%', marginTop: 8 }} 
                  />
                </div>

                {!isSending ? (
                  <>
                    <button 
                      className="sms-btn primary" 
                      onClick={startSending} 
                      disabled={filteredCandidates.length === 0 || !gatewayUsername}
                    >
                      📱 Start Sending ({filteredCandidates.length})
                    </button>
                    <button className="sms-btn secondary" onClick={exportToCSV}>
                      📥 Export Recipients CSV
                    </button>
                  </>
                ) : (
                  <>
                    <button className="sms-btn secondary" onClick={() => setIsPaused(!isPaused)}>
                      {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                    </button>
                    <button 
                      className="sms-btn danger" 
                      onClick={() => { abortRef.current = true; setIsSending(false); }}
                    >
                      ⏹️ Stop Campaign
                    </button>
                  </>
                )}

                {isSending && (
                  <div className="sms-progress">
                    <div className="sms-progress-bar">
                      <div 
                        className="sms-progress-fill" 
                        style={{ width: `${((currentIndex + 1) / filteredCandidates.length) * 100}%` }} 
                      />
                    </div>
                    <div style={{ fontSize: 13, marginTop: 10, textAlign: 'center', fontWeight: 500 }}>
                      {currentIndex + 1} / {filteredCandidates.length}
                      {isPaused && <span style={{ color: '#f59e0b' }}> (Paused)</span>}
                    </div>
                  </div>
                )}

                {sendLog.length > 0 && (
                  <div className="sms-log">
                    {sendLog.slice().reverse().slice(0, 50).map((log, i) => (
                      <div key={i} className={`sms-log-item ${log.status}`}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{log.name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{log.phone}</div>
                          {log.error && <div style={{ fontSize: 10, color: '#dc2626' }}>{log.error}</div>}
                          {log.reason && <div style={{ fontSize: 10, color: '#92400e' }}>{log.reason}</div>}
                        </div>
                        <span className={`sms-log-status ${log.status}`}>
                          {log.status === 'sent' ? '✓ Sent' : 
                           log.status === 'failed' ? '✗ Failed' : 
                           log.status === 'skipped' ? '⊘ Skipped' : '⋯ Sending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Test SMS */}
                <div className="sms-test-box">
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>🧪 Send Test SMS</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      className="sms-input"
                      style={{ flex: 1, marginBottom: 0 }}
                      placeholder="Phone number (e.g., 07123456789)"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                    />
                    <button 
                      className="sms-btn primary small"
                      onClick={sendTestSMS}
                      disabled={testSending || !testPhone}
                      style={{ width: 100 }}
                    >
                      {testSending ? '...' : 'Test'}
                    </button>
                  </div>
                  {testResult && (
                    <div className={`sms-test-result ${testResult.success ? 'success' : 'error'}`}>
                      {testResult.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="sms-convo-container">
          {/* Sidebar */}
          <div className="sms-convo-sidebar">
            <div className="sms-convo-header">
              <input 
                className="sms-convo-search"
                placeholder="🔍 Search conversations..."
                value={convoSearch}
                onChange={e => setConvoSearch(e.target.value)}
              />
              <div className="sms-convo-filters">
                <button 
                  className={`sms-convo-filter ${convoFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setConvoFilter('all')}
                >
                  All ({conversations.length})
                </button>
                <button 
                  className={`sms-convo-filter ${convoFilter === 'needs_action' ? 'active' : ''}`}
                  onClick={() => setConvoFilter('needs_action')}
                >
                  🔔 Needs Action ({stats.needsAction})
                </button>
                <button 
                  className={`sms-convo-filter ${convoFilter === 'interested' ? 'active' : ''}`}
                  onClick={() => setConvoFilter('interested')}
                >
                  ✓ Interested ({stats.interested})
                </button>
              </div>
            </div>
            
            <div className="sms-convo-list">
              {filteredConversations.length === 0 ? (
                <div className="sms-empty">
                  <div className="sms-empty-icon">💬</div>
                  <div className="sms-empty-text">
                    {convoSearch ? 'No conversations match your search' : 'No conversations yet'}
                  </div>
                </div>
              ) : filteredConversations.map(convo => {
                const intentConfig = getIntentConfig(convo.latestIntent);
                return (
                  <div 
                    key={convo.phone} 
                    className={`sms-convo ${selectedConvo?.phone === convo.phone ? 'active' : ''} ${convo.unreadCount > 0 ? 'unread' : ''}`}
                    onClick={() => setSelectedConvo(convo)}
                  >
                    <div className="sms-convo-avatar">
                      {convo.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="sms-convo-info">
                      <div className="sms-convo-top">
                        <span className="sms-convo-name">{convo.name || 'Unknown'}</span>
                        <span className="sms-convo-time">{formatRelativeTime(convo.lastActivity)}</span>
                      </div>
                      <div className="sms-convo-preview">
                        {convo.lastMessage?.direction === 'inbound' ? '← ' : '→ '}
                        {convo.lastMessage?.message_text?.substring(0, 35)}...
                      </div>
                    </div>
                    {convo.latestIntent && (
                      <span 
                        className="sms-convo-badge"
                        style={{ background: intentConfig.bg, color: intentConfig.text }}
                      >
                        {intentConfig.icon} {intentConfig.label}
                      </span>
                    )}
                    {convo.unreadCount > 0 && <div className="sms-unread-dot" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail View */}
          <div className="sms-detail">
            {selectedConvo ? (
              <>
                <div className="sms-detail-header">
                  <div className="sms-detail-info">
                    <h3>{selectedConvo.name || 'Unknown'}</h3>
                    <div className="sms-detail-meta">
                      <span>📱 {selectedConvo.phone}</span>
                      {selectedConvo.roles && selectedConvo.roles.length > 0 && (
                        <span>💼 {selectedConvo.roles.slice(0, 2).join(', ')}</span>
                      )}
                      {selectedConvo.candidateStatus && (
                        <span>📋 {selectedConvo.candidateStatus}</span>
                      )}
                    </div>
                  </div>
                  <div className="sms-detail-actions">
                    <a 
                      href={`tel:${selectedConvo.phone}`}
                      className="sms-btn primary small"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      📞 Call
                    </a>
                    <a 
                      href={`https://wa.me/${selectedConvo.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      className="sms-btn secondary small"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      💬 WhatsApp
                    </a>
                  </div>
                </div>
                
                <div className="sms-messages">
                  {selectedConvo.messages.map((msg: any) => (
                    <div key={msg.id}>
                      <div className={`sms-message ${msg.direction === 'outbound' ? 'out' : 'in'}`}>
                        <div className="sms-message-text">{msg.message_text}</div>
                        <div className="sms-message-time">
                          {new Date(msg.created_at).toLocaleString('en-GB', { 
                            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' 
                          })}
                        </div>
                      </div>
                      {msg.direction === 'inbound' && msg.ai_summary && (
                        <div className="sms-ai-analysis">
                          <div className="sms-ai-header">
                            🤖 AI Analysis
                            {msg.ai_sentiment && (
                              <span 
                                style={{ 
                                  marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 10,
                                  ...getSentimentConfig(msg.ai_sentiment)
                                }}
                              >
                                {msg.ai_sentiment}
                              </span>
                            )}
                          </div>
                          <div className="sms-ai-summary">{msg.ai_summary}</div>
                          {msg.ai_suggested_action && (
                            <div className="sms-ai-action">
                              Suggested: {msg.ai_suggested_action.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="sms-reply-box">
                  <textarea 
                    className="sms-reply-input"
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                  />
                  <button 
                    className="sms-reply-btn"
                    onClick={sendReply}
                    disabled={sendingReply || !replyMessage.trim()}
                  >
                    {sendingReply ? 'Sending...' : 'Send →'}
                  </button>
                </div>
              </>
            ) : (
              <div className="sms-empty">
                <div className="sms-empty-icon">👈</div>
                <div className="sms-empty-text">Select a conversation to view messages</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="sms-history">
          <div className="sms-panel">
            <div className="sms-panel-header">📊 Campaign History</div>
            <div className="sms-panel-body" style={{ padding: 0 }}>
              {campaigns.length === 0 ? (
                <div className="sms-empty" style={{ padding: 60 }}>
                  <div className="sms-empty-icon">📊</div>
                  <div className="sms-empty-text">No campaigns yet. Start your first campaign!</div>
                </div>
              ) : (
                <table className="sms-history-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Recipients</th>
                      <th>Sent</th>
                      <th>Status</th>
                      <th>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(campaign => (
                      <tr key={campaign.id}>
                        <td style={{ fontWeight: 500 }}>{campaign.name}</td>
                        <td>{campaign.total_recipients}</td>
                        <td>{campaign.sent_count || 0}</td>
                        <td>
                          <span className={`sms-campaign-status ${campaign.status}`}>
                            {campaign.status}
                          </span>
                        </td>
                        <td style={{ color: '#6b7280' }}>
                          {new Date(campaign.started_at).toLocaleString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
