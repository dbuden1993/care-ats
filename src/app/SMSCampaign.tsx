'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  created_at?: string;
}

interface SendLog {
  phone: string;
  name: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error?: string;
  reason?: string;
  timestamp?: Date;
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
  isHandled: boolean;
  responseTime?: number; // hours since last outbound
}

interface Campaign {
  id: string;
  name: string;
  template: string;
  total_recipients: number;
  sent_count: number;
  failed_count?: number;
  status: string;
  started_at: string;
  completed_at: string | null;
}

// Pre-built message templates
const MESSAGE_TEMPLATES = [
  {
    name: 'Initial Outreach',
    text: 'Hi {name}, this is [Your Name] from [Company]. We have care positions available in your area. Are you looking for work? Reply YES if interested or STOP to opt out.'
  },
  {
    name: 'Follow-up',
    text: 'Hi {name}, following up on my earlier message about care work. We have flexible shifts with competitive pay. Interested? Reply YES or STOP to opt out.'
  },
  {
    name: 'Urgent Hiring',
    text: 'Hi {name}, URGENT: We need carers in your area this week! Great rates, flexible hours. Reply YES for immediate start or STOP to opt out.'
  },
  {
    name: 'Interview Invite',
    text: 'Hi {name}, great news! We\'d like to invite you for an interview. Are you free this week? Reply with your preferred day or call us on [Phone].'
  },
  {
    name: 'Document Chase',
    text: 'Hi {name}, just a reminder - we\'re still waiting for your documents to complete your application. Can you send them today? Reply if you need help.'
  }
];

// Quick reply suggestions
const QUICK_REPLIES: Record<string, string[]> = {
  interested: [
    'Great to hear! When would be a good time to call you for a quick chat?',
    'Brilliant! What areas are you looking to work in? And do you drive?',
    'Thanks for your interest! Do you have any care experience?'
  ],
  question: [
    'Happy to help! Pay starts at £12/hr and varies by role. When can I call to discuss?',
    'Good question! We have days, nights, and weekends available. What works for you?',
    'I can explain more over a quick call. What time suits you today?'
  ],
  callback_request: [
    'I\'ll call you shortly!',
    'Perfect, calling you in the next 30 mins.',
    'What time works best for you today?'
  ],
  not_interested: [
    'No problem at all. Best of luck! Feel free to reach out if things change.',
    'Understood, thanks for letting me know. Take care!'
  ]
};

export default function SMSCampaignView() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'compose' | 'conversations' | 'history'>('compose');
  
  // Compose state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(MESSAGE_TEMPLATES[0].text);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [campaignName, setCampaignName] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterCalled, setFilterCalled] = useState('all');
  const [excludeOptOut, setExcludeOptOut] = useState(true);
  const [excludeRecentlySent, setExcludeRecentlySent] = useState(true);
  const [recentDays, setRecentDays] = useState(7);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  
  // Gateway settings
  const [gatewayUrl, setGatewayUrl] = useState('http://192.168.1.100:8080');
  const [gatewayUsername, setGatewayUsername] = useState('');
  const [gatewayPassword, setGatewayPassword] = useState('');
  const [sendDelay, setSendDelay] = useState(30);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null);
  const [checkingGateway, setCheckingGateway] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sendLog, setSendLog] = useState<SendLog[]>([]);
  const [sentPhones, setSentPhones] = useState<Set<string>>(new Set());
  const [sendStats, setSendStats] = useState({ sent: 0, failed: 0, skipped: 0 });
  const [campaignStartTime, setCampaignStartTime] = useState<Date | null>(null);
  
  // Refs for async control (fixes pause bug)
  const abortRef = useRef(false);
  const pausedRef = useRef(false);
  const [isPausedDisplay, setIsPausedDisplay] = useState(false);
  
  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [convoFilter, setConvoFilter] = useState<'all' | 'needs_action' | 'interested' | 'not_interested' | 'handled'>('all');
  const [convoSearch, setConvoSearch] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [handledConvos, setHandledConvos] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // History state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Test SMS state
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load everything on mount
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
    
    const savedHandled = localStorage.getItem('handledConversations');
    if (savedHandled) {
      try {
        setHandledConvos(new Set(JSON.parse(savedHandled)));
      } catch (e) {}
    }
    
    const savedTemplate = localStorage.getItem('smsLastMessage');
    if (savedTemplate) setMessage(savedTemplate);
    
    loadCandidates();
    loadConversations();
    loadCampaigns();
    loadSentPhones();
  }, []);

  // Save message template when it changes
  useEffect(() => {
    localStorage.setItem('smsLastMessage', message);
  }, [message]);

  // Reload sent phones when recentDays changes
  useEffect(() => {
    loadSentPhones();
  }, [recentDays]);

  // Auto-refresh conversations
  useEffect(() => {
    if (activeTab === 'conversations') {
      const interval = setInterval(loadConversations, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Save handled conversations
  useEffect(() => {
    localStorage.setItem('handledConversations', JSON.stringify([...handledConvos]));
  }, [handledConvos]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConvo?.messages]);

  const saveGatewaySettings = useCallback(() => {
    localStorage.setItem('smsGatewaySettings', JSON.stringify({
      url: gatewayUrl,
      username: gatewayUsername,
      password: gatewayPassword,
      delay: sendDelay
    }));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }, [gatewayUrl, gatewayUsername, gatewayPassword, sendDelay]);

  const testGatewayConnection = async () => {
    if (!gatewayUrl || !gatewayUsername) {
      setGatewayConnected(false);
      return;
    }
    
    setCheckingGateway(true);
    try {
      const credentials = btoa(`${gatewayUsername}:${gatewayPassword}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      // Try health endpoint first, then fall back to root
      let response;
      try {
        response = await fetch(`${gatewayUrl}/health`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${credentials}` },
          signal: controller.signal
        });
      } catch {
        response = await fetch(`${gatewayUrl}/`, {
          method: 'GET',
          headers: { 'Authorization': `Basic ${credentials}` },
          signal: controller.signal
        });
      }
      clearTimeout(timeoutId);
      setGatewayConnected(response.ok || response.status === 401); // 401 means gateway is reachable but wrong creds
    } catch {
      setGatewayConnected(false);
    }
    setCheckingGateway(false);
  };

  async function loadCandidates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, source, last_called_at, sms_opt_out, roles, created_at')
      .not('phone_e164', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading candidates:', error);
    }
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
      .limit(1000);
    
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
        
        let unreadCount = 0;
        if (latestInbound) {
          if (latestOutbound) {
            unreadCount = msgs.filter(m => 
              m.direction === 'inbound' && 
              new Date(m.created_at) > new Date(latestOutbound.created_at)
            ).length;
          } else {
            unreadCount = msgs.filter(m => m.direction === 'inbound').length;
          }
        }
        
        // Calculate response time
        let responseTime: number | undefined;
        if (latestInbound && latestOutbound) {
          const outTime = new Date(latestOutbound.created_at).getTime();
          const inTime = new Date(latestInbound.created_at).getTime();
          if (inTime > outTime) {
            responseTime = Math.round((inTime - outTime) / 3600000); // hours
          }
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
          unreadCount,
          isHandled: handledConvos.has(phone),
          responseTime
        };
      });
      
      convos.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      setConversations(convos);
      
      // Update selected convo if it exists
      if (selectedConvo) {
        const updated = convos.find(c => c.phone === selectedConvo.phone);
        if (updated) setSelectedConvo(updated);
      }
    }
  }

  async function loadCampaigns() {
    const { data } = await supabase
      .from('sms_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setCampaigns(data);
  }

  // Phone validation with detailed feedback
  const validatePhone = useCallback((phone: string): { valid: boolean; normalized?: string; reason?: string } => {
    if (!phone) return { valid: false, reason: 'No phone number' };
    
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Check for obviously invalid
    if (cleaned.length < 10) return { valid: false, reason: 'Too short' };
    if (!/^\+?[0-9]+$/.test(cleaned)) return { valid: false, reason: 'Invalid characters' };
    
    // Normalize to E.164
    let e164 = cleaned;
    if (cleaned.startsWith('0')) {
      e164 = '+44' + cleaned.slice(1);
    } else if (cleaned.startsWith('44') && !cleaned.startsWith('+')) {
      e164 = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      e164 = '+' + cleaned;
    }
    
    // UK mobile validation
    if (!e164.startsWith('+447')) {
      if (e164.startsWith('+44')) {
        return { valid: false, reason: 'Not a mobile (landline?)' };
      }
      return { valid: false, reason: 'Not a UK mobile' };
    }
    
    if (e164.length !== 13) {
      return { valid: false, reason: `Wrong length (${e164.length - 3} digits)` };
    }
    
    return { valid: true, normalized: e164 };
  }, []);

  // Filtered candidates with memoization
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (!c.phone_e164) return false;
      
      const validation = validatePhone(c.phone_e164);
      if (!validation.valid) return false;
      
      if (excludeOptOut && c.sms_opt_out) return false;
      if (excludeRecentlySent && sentPhones.has(c.phone_e164)) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (filterCalled === 'called' && !c.last_called_at) return false;
      if (filterCalled === 'not-called' && c.last_called_at) return false;
      
      return true;
    });
  }, [candidates, excludeOptOut, excludeRecentlySent, sentPhones, filterStatus, filterSource, filterCalled, validatePhone]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (convoSearch) {
        const search = convoSearch.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(search);
        const matchesPhone = c.phone.includes(search);
        const matchesMessage = c.messages.some(m => m.message_text?.toLowerCase().includes(search));
        if (!matchesName && !matchesPhone && !matchesMessage) return false;
      }
      
      switch (convoFilter) {
        case 'needs_action':
          return c.hasResponse && ['interested', 'callback_request', 'question'].includes(c.latestIntent || '') && !c.isHandled;
        case 'interested':
          return c.latestIntent === 'interested';
        case 'not_interested':
          return ['not_interested', 'stop_request'].includes(c.latestIntent || '');
        case 'handled':
          return c.isHandled;
        default:
          return true;
      }
    });
  }, [conversations, convoSearch, convoFilter]);

  // Sources for filter dropdown
  const sources = useMemo(() => [...new Set(candidates.map(c => c.source).filter(Boolean))], [candidates]);
  
  // Statuses for filter dropdown
  const statuses = useMemo(() => [...new Set(candidates.map(c => c.status).filter(Boolean))], [candidates]);
  
  // Message stats
  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;
  const isLongMessage = charCount > 160;
  const hasPlaceholders = message.includes('[') && message.includes(']');
  
  // Time estimates
  const totalSeconds = filteredCandidates.length * sendDelay;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  // Conversation stats
  const convoStats = useMemo(() => ({
    total: conversations.length,
    needsAction: conversations.filter(c => 
      c.hasResponse && ['interested', 'callback_request', 'question'].includes(c.latestIntent || '') && !c.isHandled
    ).length,
    interested: conversations.filter(c => c.latestIntent === 'interested').length,
    responses: conversations.filter(c => c.hasResponse).length,
    handled: conversations.filter(c => c.isHandled).length,
    responseRate: conversations.length > 0 
      ? Math.round((conversations.filter(c => c.hasResponse).length / conversations.length) * 100) 
      : 0
  }), [conversations]);

  // Personalize message
  const personalizeMessage = useCallback((template: string, candidate: Candidate | { name: string }) => {
    const firstName = candidate.name?.split(' ')[0] || 'there';
    const fullName = candidate.name || 'there';
    return template
      .replace(/{name}/gi, firstName)
      .replace(/{full_name}/gi, fullName)
      .replace(/{firstname}/gi, firstName);
  }, []);

  // Send via gateway
  async function sendViaGateway(phone: string, text: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
    try {
      const credentials = btoa(`${gatewayUsername}:${gatewayPassword}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${gatewayUrl}/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify({ message: text, phoneNumbers: [phone] }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.message || errorData.error || `HTTP ${response.status}` 
        };
      }
      
      const data = await response.json().catch(() => ({}));
      return { success: true, messageId: data.id };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Timeout - gateway not responding' };
      }
      return { success: false, error: err.message || 'Network error - check gateway connection' };
    }
  }

  // Send test SMS
  async function sendTestSMS() {
    if (!testPhone) return;
    
    setTestSending(true);
    setTestResult(null);
    
    const validation = validatePhone(testPhone);
    if (!validation.valid) {
      setTestResult({ success: false, message: validation.reason || 'Invalid number' });
      setTestSending(false);
      return;
    }
    
    const testMsg = personalizeMessage(message, { name: 'Test User' });
    const result = await sendViaGateway(validation.normalized!, testMsg);
    
    setTestResult({ 
      success: result.success, 
      message: result.success ? '✓ Test SMS sent successfully!' : `✗ ${result.error}` 
    });
    setTestSending(false);
  }

  // Toggle pause (using ref for immediate effect in async loop)
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setIsPausedDisplay(pausedRef.current);
  }, []);

  // Stop sending
  const stopSending = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPausedDisplay(false);
  }, []);

  // Start campaign
  async function startSending() {
    if (filteredCandidates.length === 0) {
      alert('No recipients selected. Adjust your filters.');
      return;
    }
    
    if (!gatewayUsername || !gatewayPassword) {
      alert('Please enter gateway credentials and save settings first.');
      setShowSettings(true);
      return;
    }
    
    // Warn about placeholders
    if (hasPlaceholders) {
      const proceed = window.confirm(
        'Your message contains [brackets] which look like unfilled placeholders. Did you forget to customize them?\n\nClick OK to send anyway, or Cancel to edit.'
      );
      if (!proceed) return;
    }
    
    // Confirm large campaigns
    if (filteredCandidates.length > 50 && !showConfirmModal) {
      setShowConfirmModal(true);
      return;
    }
    setShowConfirmModal(false);
    
    // Refresh sent phones to ensure we have latest data
    await loadSentPhones();
    
    setIsSending(true);
    pausedRef.current = false;
    setIsPausedDisplay(false);
    abortRef.current = false;
    setCurrentIndex(0);
    setSendLog([]);
    setSendStats({ sent: 0, failed: 0, skipped: 0 });
    setCampaignStartTime(new Date());
    
    const campaignSentPhones = new Set<string>();
    const campaignNameFinal = campaignName || `Campaign ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

    const { data: campaign } = await supabase.from('sms_campaigns').insert({
      name: campaignNameFinal,
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
      while (pausedRef.current && !abortRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (abortRef.current) break;

      const candidate = filteredCandidates[i];
      setCurrentIndex(i);
      
      // Double-check: skip if already sent in this campaign
      if (campaignSentPhones.has(candidate.phone_e164)) {
        const logEntry: SendLog = { 
          phone: candidate.phone_e164, 
          name: candidate.name || 'Unknown', 
          status: 'skipped',
          reason: 'Duplicate',
          timestamp: new Date()
        };
        setSendLog(prev => [...prev, logEntry]);
        skippedCount++;
        setSendStats({ sent: sentCount, failed: failedCount, skipped: skippedCount });
        continue;
      }
      
      // Validate phone
      const validation = validatePhone(candidate.phone_e164);
      if (!validation.valid) {
        const logEntry: SendLog = { 
          phone: candidate.phone_e164, 
          name: candidate.name || 'Unknown', 
          status: 'skipped',
          reason: validation.reason,
          timestamp: new Date()
        };
        setSendLog(prev => [...prev, logEntry]);
        skippedCount++;
        setSendStats({ sent: sentCount, failed: failedCount, skipped: skippedCount });
        continue;
      }

      const personalizedMsg = personalizeMessage(message, candidate);
      
      // Add pending log entry
      setSendLog(prev => [...prev, { 
        phone: candidate.phone_e164, 
        name: candidate.name || 'Unknown', 
        status: 'pending',
        timestamp: new Date()
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

      setSendStats({ sent: sentCount, failed: failedCount, skipped: skippedCount });

      // Update campaign progress every 5 messages
      if (campaign?.id && (sentCount + failedCount) % 5 === 0) {
        await supabase.from('sms_campaigns')
          .update({ sent_count: sentCount })
          .eq('id', campaign.id);
      }

      // Delay between messages (skip on last)
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
    setCampaignStartTime(null);
    loadCampaigns();
    loadSentPhones();
  }

  // Send reply
  async function sendReply() {
    if (!selectedConvo || !replyMessage.trim()) return;
    
    setSendingReply(true);
    const result = await sendViaGateway(selectedConvo.phone, replyMessage.trim());
    
    if (result.success) {
      await supabase.from('sms_messages').insert({
        candidate_id: selectedConvo.candidateId,
        phone_e164: selectedConvo.phone,
        direction: 'outbound',
        message_text: replyMessage.trim(),
        status: 'sent',
        sent_at: new Date().toISOString()
      });
      
      setReplyMessage('');
      
      // Mark as handled after reply
      setHandledConvos(prev => new Set([...prev, selectedConvo.phone]));
      
      loadConversations();
    } else {
      alert('Failed to send: ' + (result.error || 'Unknown error'));
    }
    
    setSendingReply(false);
  }

  // Toggle handled status
  const toggleHandled = useCallback((phone: string) => {
    setHandledConvos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phone)) {
        newSet.delete(phone);
      } else {
        newSet.add(phone);
      }
      return newSet;
    });
  }, []);

  // Use quick reply
  const useQuickReply = useCallback((reply: string) => {
    setReplyMessage(reply);
  }, []);

  // Export recipients
  function exportToCSV() {
    const rows = [['Phone', 'Name', 'Status', 'Source', 'Personalized Message']];
    filteredCandidates.forEach(c => rows.push([
      c.phone_e164, 
      c.name || '', 
      c.status || '', 
      c.source || '', 
      personalizeMessage(message, c)
    ]));
    const csv = rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sms-recipients-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  // Export conversations
  function exportConversations() {
    const rows = [['Phone', 'Name', 'Intent', 'Sentiment', 'Last Response', 'AI Summary', 'Response Time (hrs)', 'Last Activity']];
    filteredConversations.forEach(c => {
      const lastInbound = c.messages.filter(m => m.direction === 'inbound').pop();
      rows.push([
        c.phone,
        c.name || '',
        c.latestIntent || '',
        c.latestSentiment || '',
        lastInbound?.message_text || '',
        lastInbound?.ai_summary || '',
        c.responseTime?.toString() || '',
        c.lastActivity.toISOString()
      ]);
    });
    const csv = rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sms-conversations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  // Helper functions
  const getIntentConfig = (intent: string | null) => {
    switch (intent) {
      case 'interested': return { bg: '#dcfce7', text: '#166534', icon: '✓', label: 'Interested' };
      case 'callback_request': return { bg: '#dbeafe', text: '#1e40af', icon: '📞', label: 'Callback' };
      case 'question': return { bg: '#fef3c7', text: '#92400e', icon: '❓', label: 'Question' };
      case 'not_interested': return { bg: '#fee2e2', text: '#991b1b', icon: '✗', label: 'Not Interested' };
      case 'stop_request': return { bg: '#fee2e2', text: '#991b1b', icon: '🚫', label: 'Opt-Out' };
      default: return { bg: '#f3f4f6', text: '#6b7280', icon: '•', label: 'Pending' };
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    if (hrs < 24) return `${hrs}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getElapsedTime = () => {
    if (!campaignStartTime) return '';
    const elapsed = Math.floor((new Date().getTime() - campaignStartTime.getTime()) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Preview sample candidate
  const previewCandidate = filteredCandidates[0] || { name: 'John Smith' };

  return (
    <div style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', minHeight: '100%' }}>
      <style>{`
        .sms-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#fff;padding:0 24px;position:sticky;top:0;z-index:50}
        .sms-tab{padding:16px 24px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;border-bottom:3px solid transparent;transition:all .2s;display:flex;align-items:center;gap:8px}
        .sms-tab:hover{color:#111;background:#f9fafb}
        .sms-tab.active{color:#4f46e5;border-bottom-color:#4f46e5}
        .sms-badge{padding:2px 8px;background:#ef4444;color:#fff;border-radius:10px;font-size:11px;font-weight:700;min-width:18px;text-align:center}
        .sms-badge.green{background:#22c55e}
        .sms-badge.blue{background:#3b82f6}
        
        .sms-compose{display:grid;grid-template-columns:1fr 420px;gap:24px;padding:24px}
        @media(max-width:1200px){.sms-compose{grid-template-columns:1fr}}
        
        .sms-panel{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .sms-panel-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:700;display:flex;justify-content:space-between;align-items:center;background:linear-gradient(180deg,#fff 0%,#fafafa 100%)}
        .sms-panel-body{padding:20px}
        
        .sms-input{width:100%;padding:12px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;margin-bottom:12px;box-sizing:border-box;transition:all .2s}
        .sms-input:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
        .sms-textarea{width:100%;padding:14px 16px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;resize:vertical;min-height:120px;box-sizing:border-box;font-family:inherit;line-height:1.6;transition:all .2s}
        .sms-textarea:focus{outline:none;border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
        .sms-textarea.warning{border-color:#f59e0b}
        
        .sms-filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .sms-select{padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;background:#fff;min-width:120px}
        .sms-select:focus{outline:none;border-color:#4f46e5}
        
        .sms-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
        .sms-stat{text-align:center;padding:12px 8px;background:linear-gradient(135deg,#f9fafb 0%,#f3f4f6 100%);border-radius:10px}
        .sms-stat strong{display:block;font-size:22px;font-weight:800;color:#111}
        .sms-stat small{font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase}
        .sms-stat.green{background:linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%)}
        .sms-stat.green strong{color:#166534}
        .sms-stat.red{background:linear-gradient(135deg,#fee2e2 0%,#fecaca 100%)}
        .sms-stat.red strong{color:#991b1b}
        .sms-stat.yellow{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)}
        .sms-stat.yellow strong{color:#92400e}
        
        .sms-btn{padding:14px 20px;font-size:14px;font-weight:600;border-radius:10px;cursor:pointer;border:none;width:100%;margin-bottom:10px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .sms-btn:disabled{opacity:.5;cursor:not-allowed}
        .sms-btn.primary{background:linear-gradient(135deg,#22c55e 0%,#16a34a 100%);color:#fff}
        .sms-btn.primary:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(34,197,94,.4)}
        .sms-btn.secondary{background:#f3f4f6;color:#374151}
        .sms-btn.secondary:hover:not(:disabled){background:#e5e7eb}
        .sms-btn.danger{background:linear-gradient(135deg,#fee2e2 0%,#fecaca 100%);color:#dc2626}
        .sms-btn.purple{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff}
        .sms-btn.purple:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(79,70,229,.4)}
        .sms-btn.small{padding:10px 16px;font-size:13px;width:auto;margin:0}
        .sms-btn.xs{padding:6px 12px;font-size:11px;width:auto;margin:0;border-radius:6px}
        
        .sms-progress{margin-top:16px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb}
        .sms-progress-bar{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden}
        .sms-progress-fill{height:100%;background:linear-gradient(90deg,#4f46e5 0%,#7c3aed 100%);transition:width .3s}
        .sms-progress-stats{display:flex;justify-content:space-between;margin-top:12px;font-size:12px;flex-wrap:wrap;gap:8px}
        .sms-progress-stat{display:flex;align-items:center;gap:4px}
        .sms-progress-dot{width:8px;height:8px;border-radius:50%}
        
        .sms-log{max-height:200px;overflow-y:auto;font-size:12px;margin-top:12px;border-radius:8px;border:1px solid #e5e7eb}
        .sms-log-item{padding:10px 14px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center}
        .sms-log-item:last-child{border-bottom:none}
        .sms-log-item.sent{background:#f0fdf4}
        .sms-log-item.failed{background:#fef2f2}
        .sms-log-item.skipped{background:#fffbeb}
        .sms-log-status{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700}
        .sms-log-status.sent{background:#dcfce7;color:#166534}
        .sms-log-status.failed{background:#fee2e2;color:#991b1b}
        .sms-log-status.skipped{background:#fef3c7;color:#92400e}
        .sms-log-status.pending{background:#e0e7ff;color:#3730a3}
        
        .sms-gateway{display:flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;border-radius:6px;cursor:pointer;font-weight:500}
        .sms-gateway.connected{background:#dcfce7;color:#166534}
        .sms-gateway.disconnected{background:#fee2e2;color:#991b1b}
        .sms-gateway.unknown{background:#f3f4f6;color:#6b7280}
        .sms-gateway.checking{background:#e0e7ff;color:#3730a3}
        
        .sms-templates{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
        .sms-template{padding:8px 14px;background:#f3f4f6;border:2px solid #e5e7eb;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .2s}
        .sms-template:hover{background:#e5e7eb;border-color:#d1d5db}
        .sms-template.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
        
        .sms-convo-container{display:flex;height:calc(100vh - 65px)}
        .sms-convo-sidebar{width:400px;border-right:1px solid #e5e7eb;background:#fff;display:flex;flex-direction:column}
        .sms-convo-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;background:#fff}
        .sms-convo-search{width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:13px;box-sizing:border-box;margin-bottom:12px}
        .sms-convo-search:focus{outline:none;border-color:#4f46e5}
        .sms-convo-filters{display:flex;gap:6px;flex-wrap:wrap}
        .sms-convo-filter{padding:6px 12px;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;background:#f3f4f6;color:#6b7280;transition:all .2s}
        .sms-convo-filter:hover{background:#e5e7eb}
        .sms-convo-filter.active{background:#4f46e5;color:#fff}
        
        .sms-convo-list{flex:1;overflow-y:auto}
        .sms-convo{padding:14px 20px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;gap:12px;align-items:center;transition:all .15s}
        .sms-convo:hover{background:#f9fafb}
        .sms-convo.active{background:#eef2ff;border-left:3px solid #4f46e5}
        .sms-convo.unread{background:#fffbeb}
        .sms-convo.handled{opacity:.6}
        .sms-convo-avatar{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
        .sms-convo-info{flex:1;min-width:0}
        .sms-convo-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
        .sms-convo-name{font-weight:600;font-size:14px;color:#111}
        .sms-convo-time{font-size:11px;color:#9ca3af}
        .sms-convo-preview{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sms-convo-badge{padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700;white-space:nowrap}
        .sms-unread-dot{width:10px;height:10px;background:#ef4444;border-radius:50%;flex-shrink:0}
        
        .sms-detail{flex:1;display:flex;flex-direction:column;background:#f8fafc}
        .sms-detail-header{padding:16px 24px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .sms-detail-info h3{font-size:16px;font-weight:700;margin:0 0 4px 0}
        .sms-detail-meta{display:flex;gap:12px;font-size:12px;color:#6b7280;flex-wrap:wrap}
        .sms-detail-actions{display:flex;gap:8px;flex-wrap:wrap}
        
        .sms-messages{flex:1;padding:24px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
        .sms-message{max-width:75%;padding:12px 16px;border-radius:16px}
        .sms-message.out{background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
        .sms-message.in{background:#fff;border:1px solid #e5e7eb;align-self:flex-start;border-bottom-left-radius:4px}
        .sms-message-text{font-size:14px;line-height:1.5;white-space:pre-wrap}
        .sms-message-time{font-size:10px;opacity:.7;margin-top:6px}
        
        .sms-ai-box{max-width:75%;margin-top:-4px;padding:12px 16px;background:linear-gradient(135deg,#fefce8 0%,#fef9c3 100%);border:1px solid #fde047;border-radius:12px;font-size:12px;align-self:flex-start}
        .sms-ai-header{font-weight:700;color:#854d0e;margin-bottom:6px;display:flex;align-items:center;gap:6px}
        .sms-ai-summary{color:#713f12;line-height:1.5}
        .sms-ai-action{margin-top:8px;padding:6px 10px;background:rgba(0,0,0,.05);border-radius:6px;font-weight:600;display:inline-block}
        
        .sms-quick-replies{padding:12px 24px;background:#fff;border-top:1px solid #e5e7eb}
        .sms-quick-replies-title{font-size:11px;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase}
        .sms-quick-replies-list{display:flex;gap:8px;flex-wrap:wrap}
        .sms-quick-reply{padding:8px 14px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;cursor:pointer;transition:all .2s;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sms-quick-reply:hover{background:#e5e7eb;border-color:#d1d5db}
        
        .sms-reply-box{padding:16px 24px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:12px;align-items:flex-end}
        .sms-reply-input{flex:1;padding:12px 16px;border:2px solid #e5e7eb;border-radius:12px;font-size:14px;resize:none;min-height:44px;max-height:120px;font-family:inherit;box-sizing:border-box}
        .sms-reply-input:focus{outline:none;border-color:#4f46e5}
        .sms-reply-btn{padding:14px 28px;background:linear-gradient(135deg,#4f46e5 0%,#6366f1 100%);color:#fff;border:none;border-radius:12px;font-weight:600;cursor:pointer;transition:all .2s}
        .sms-reply-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(79,70,229,.4)}
        .sms-reply-btn:disabled{opacity:.5;cursor:not-allowed}
        
        .sms-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9ca3af;padding:40px}
        .sms-empty-icon{font-size:48px;margin-bottom:16px;opacity:.5}
        .sms-empty-text{font-size:14px;text-align:center}
        
        .sms-history{padding:24px}
        .sms-history-table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05)}
        .sms-history-table th{padding:14px 16px;text-align:left;font-size:12px;font-weight:600;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb}
        .sms-history-table td{padding:14px 16px;font-size:13px;border-bottom:1px solid #f3f4f6}
        .sms-history-table tr:hover{background:#f9fafb}
        .sms-campaign-status{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600}
        .sms-campaign-status.completed{background:#dcfce7;color:#166534}
        .sms-campaign-status.sending{background:#dbeafe;color:#1e40af}
        .sms-campaign-status.stopped{background:#fee2e2;color:#991b1b}
        
        .sms-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:100}
        .sms-modal{background:#fff;border-radius:16px;padding:24px;width:90%;max-width:500px;box-shadow:0 25px 50px -12px rgba(0,0,0,.25)}
        .sms-modal-title{font-size:18px;font-weight:700;margin-bottom:12px}
        .sms-modal-text{font-size:14px;color:#6b7280;margin-bottom:20px;line-height:1.6}
        .sms-modal-actions{display:flex;gap:12px;justify-content:flex-end}
        
        .sms-checkbox{display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:8px 0}
        .sms-checkbox input{width:18px;height:18px;cursor:pointer;accent-color:#4f46e5}
        
        .sms-preview{margin-top:16px;padding:16px;background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:1px solid #7dd3fc;border-radius:12px}
        .sms-preview-title{font-size:12px;font-weight:600;color:#0369a1;margin-bottom:8px;display:flex;justify-content:space-between}
        .sms-preview-text{font-size:14px;color:#0c4a6e;line-height:1.6;white-space:pre-wrap;font-family:inherit}
        
        .sms-test{margin-top:16px;padding:16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px}
        .sms-test-title{font-size:13px;font-weight:600;color:#0369a1;margin-bottom:10px}
        .sms-test-result{margin-top:10px;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:500}
        .sms-test-result.success{background:#dcfce7;color:#166534}
        .sms-test-result.error{background:#fee2e2;color:#991b1b}
        
        .sms-char-count{font-size:12px;margin-top:8px;display:flex;justify-content:space-between}
        .sms-char-count.warning{color:#f59e0b}
        .sms-char-count.danger{color:#ef4444}
        
        .sms-settings-toggle{font-size:12px;color:#6b7280;cursor:pointer;text-decoration:underline}
        .sms-settings-toggle:hover{color:#4f46e5}
      `}</style>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="sms-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="sms-modal" onClick={e => e.stopPropagation()}>
            <div className="sms-modal-title">⚠️ Confirm Campaign</div>
            <div className="sms-modal-text">
              You're about to send SMS to <strong>{filteredCandidates.length}</strong> recipients.<br /><br />
              • Estimated time: <strong>{hours > 0 ? `${hours}h ` : ''}{minutes}m</strong><br />
              • Total messages: <strong>{filteredCandidates.length * smsCount}</strong> SMS parts<br />
              • Message length: <strong>{charCount}</strong> characters ({smsCount} SMS{smsCount > 1 ? 's' : ''}/person)
            </div>
            <div className="sms-modal-actions">
              <button className="sms-btn secondary small" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button className="sms-btn primary small" onClick={startSending}>Yes, Start Sending</button>
            </div>
          </div>
        </div>
      )}

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
          {convoStats.needsAction > 0 && <span className="sms-badge">{convoStats.needsAction}</span>}
          {convoStats.needsAction === 0 && convoStats.responses > 0 && <span className="sms-badge green">{convoStats.responses}</span>}
        </div>
        <div className={`sms-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); loadCampaigns(); }}>
          📊 History
          {campaigns.filter(c => c.status === 'sending').length > 0 && <span className="sms-badge blue">Live</span>}
        </div>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="sms-compose">
          <div>
            {/* Message */}
            <div className="sms-panel">
              <div className="sms-panel-header">
                📝 Message
                <span style={{ fontSize: 12, fontWeight: 500, color: charCount > 160 ? '#f59e0b' : '#6b7280' }}>
                  {charCount} chars • {smsCount} SMS{smsCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="sms-panel-body">
                <div className="sms-templates">
                  {MESSAGE_TEMPLATES.map((t, i) => (
                    <button 
                      key={i}
                      className={`sms-template ${selectedTemplate === i && message === t.text ? 'active' : ''}`}
                      onClick={() => { setMessage(t.text); setSelectedTemplate(i); }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                
                <input 
                  className="sms-input" 
                  placeholder="Campaign name (optional)" 
                  value={campaignName} 
                  onChange={e => setCampaignName(e.target.value)} 
                />
                <textarea 
                  className={`sms-textarea ${charCount > 160 ? 'warning' : ''}`}
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  placeholder="Type your message..." 
                />
                <div className={`sms-char-count ${charCount > 320 ? 'danger' : charCount > 160 ? 'warning' : ''}`}>
                  <span>
                    Variables: <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code>{' '}
                    <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>{'{full_name}'}</code>
                  </span>
                  <span>
                    {charCount > 160 && `⚠️ Long message: ${smsCount} SMS parts`}
                  </span>
                </div>
                
                <div className="sms-preview">
                  <div className="sms-preview-title">
                    <span>📱 Preview</span>
                    <span style={{ fontWeight: 400 }}>To: {previewCandidate.name || 'Candidate'}</span>
                  </div>
                  <div className="sms-preview-text">{personalizeMessage(message, previewCandidate)}</div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="sms-panel" style={{ marginTop: 20 }}>
              <div className="sms-panel-header">
                🎯 Recipients
                <span style={{ fontSize: 13, fontWeight: 700, color: filteredCandidates.length > 0 ? '#16a34a' : '#dc2626' }}>
                  {filteredCandidates.length} selected
                </span>
              </div>
              <div className="sms-panel-body">
                <div className="sms-filters">
                  <select className="sms-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="all">All Statuses</option>
                    {statuses.map(s => <option key={s} value={s!}>{s}</option>)}
                  </select>
                  <select className="sms-select" value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                    <option value="all">All Sources</option>
                    {sources.map(s => <option key={s} value={s!}>{s}</option>)}
                  </select>
                  <select className="sms-select" value={filterCalled} onChange={e => setFilterCalled(e.target.value)}>
                    <option value="all">Call Status</option>
                    <option value="called">Called</option>
                    <option value="not-called">Not Called</option>
                  </select>
                </div>
                
                <label className="sms-checkbox">
                  <input type="checkbox" checked={excludeOptOut} onChange={e => setExcludeOptOut(e.target.checked)} />
                  Exclude opted-out candidates
                </label>
                
                <label className="sms-checkbox">
                  <input type="checkbox" checked={excludeRecentlySent} onChange={e => setExcludeRecentlySent(e.target.checked)} />
                  Exclude messaged in last
                  <select 
                    value={recentDays} 
                    onChange={e => setRecentDays(parseInt(e.target.value))}
                    style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb' }}
                    disabled={!excludeRecentlySent}
                  >
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                  </select>
                  {excludeRecentlySent && sentPhones.size > 0 && (
                    <span style={{ color: '#6b7280', marginLeft: 8 }}>({sentPhones.size} excluded)</span>
                  )}
                </label>
                
                {filteredCandidates.length > 0 && filteredCandidates.length <= 10 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
                    <strong>Recipients:</strong> {filteredCandidates.map(c => c.name || c.phone_e164).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Send Panel */}
          <div>
            <div className="sms-panel">
              <div className="sms-panel-header">
                🚀 Send
                <div 
                  className={`sms-gateway ${checkingGateway ? 'checking' : gatewayConnected === true ? 'connected' : gatewayConnected === false ? 'disconnected' : 'unknown'}`}
                  onClick={testGatewayConnection}
                >
                  {checkingGateway ? '⋯ Testing' : gatewayConnected === true ? '✓ Connected' : gatewayConnected === false ? '✗ Offline' : '? Test'}
                </div>
              </div>
              <div className="sms-panel-body">
                <div className="sms-stats">
                  <div className="sms-stat"><strong>{filteredCandidates.length}</strong><small>Recipients</small></div>
                  <div className="sms-stat"><strong>{smsCount}</strong><small>SMS Each</small></div>
                  <div className="sms-stat"><strong>{sendDelay}s</strong><small>Delay</small></div>
                  <div className="sms-stat"><strong>{hours > 0 ? `${hours}h` : ''}{minutes}m</strong><small>Est. Time</small></div>
                </div>

                <div 
                  className="sms-settings-toggle" 
                  onClick={() => setShowSettings(!showSettings)}
                  style={{ marginBottom: 12 }}
                >
                  {showSettings ? '▼ Hide gateway settings' : '▶ Show gateway settings'}
                </div>

                {showSettings && (
                  <>
                    <input className="sms-input" value={gatewayUrl} onChange={e => setGatewayUrl(e.target.value)} placeholder="Gateway URL" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input className="sms-input" style={{ marginBottom: 0 }} value={gatewayUsername} onChange={e => setGatewayUsername(e.target.value)} placeholder="Username" />
                      <input className="sms-input" style={{ marginBottom: 0 }} type="password" value={gatewayPassword} onChange={e => setGatewayPassword(e.target.value)} placeholder="Password" />
                    </div>
                    <button 
                      className="sms-btn secondary"
                      onClick={saveGatewaySettings}
                      style={{ background: settingsSaved ? '#dcfce7' : undefined, color: settingsSaved ? '#166534' : undefined }}
                    >
                      {settingsSaved ? '✓ Saved!' : '💾 Save Settings'}
                    </button>
                  </>
                )}
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Delay between messages: {sendDelay}s</label>
                  <input type="range" min="10" max="120" value={sendDelay} onChange={e => setSendDelay(parseInt(e.target.value))} style={{ width: '100%', marginTop: 4 }} />
                </div>

                {!isSending ? (
                  <>
                    <button 
                      className="sms-btn primary" 
                      onClick={() => filteredCandidates.length > 50 ? setShowConfirmModal(true) : startSending()} 
                      disabled={filteredCandidates.length === 0 || !gatewayUsername}
                    >
                      📱 Start Sending ({filteredCandidates.length})
                    </button>
                    <button className="sms-btn secondary" onClick={exportToCSV} disabled={filteredCandidates.length === 0}>
                      📥 Export Recipients
                    </button>
                  </>
                ) : (
                  <>
                    <button className="sms-btn secondary" onClick={togglePause}>
                      {isPausedDisplay ? '▶️ Resume' : '⏸️ Pause'}
                    </button>
                    <button className="sms-btn danger" onClick={stopSending}>⏹️ Stop Campaign</button>
                  </>
                )}

                {isSending && (
                  <div className="sms-progress">
                    <div className="sms-progress-bar">
                      <div className="sms-progress-fill" style={{ width: `${((currentIndex + 1) / filteredCandidates.length) * 100}%` }} />
                    </div>
                    <div className="sms-progress-stats">
                      <span style={{ fontWeight: 600 }}>
                        {currentIndex + 1}/{filteredCandidates.length} 
                        {isPausedDisplay && <span style={{ color: '#f59e0b' }}> (Paused)</span>}
                        {campaignStartTime && <span style={{ color: '#6b7280', marginLeft: 8 }}>{getElapsedTime()}</span>}
                      </span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span className="sms-progress-stat"><span className="sms-progress-dot" style={{ background: '#22c55e' }} />{sendStats.sent}</span>
                        <span className="sms-progress-stat"><span className="sms-progress-dot" style={{ background: '#ef4444' }} />{sendStats.failed}</span>
                        <span className="sms-progress-stat"><span className="sms-progress-dot" style={{ background: '#f59e0b' }} />{sendStats.skipped}</span>
                      </div>
                    </div>
                  </div>
                )}

                {sendLog.length > 0 && (
                  <div className="sms-log">
                    {sendLog.slice().reverse().slice(0, 30).map((log, i) => (
                      <div key={i} className={`sms-log-item ${log.status}`}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{log.name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{log.phone}</div>
                          {(log.error || log.reason) && (
                            <div style={{ fontSize: 10, color: log.status === 'failed' ? '#dc2626' : '#92400e' }}>
                              {log.error || log.reason}
                            </div>
                          )}
                        </div>
                        <span className={`sms-log-status ${log.status}`}>
                          {log.status === 'sent' ? '✓' : log.status === 'failed' ? '✗' : log.status === 'skipped' ? '⊘' : '⋯'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="sms-test">
                  <div className="sms-test-title">🧪 Send Test SMS</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      className="sms-input" style={{ flex: 1, marginBottom: 0 }}
                      placeholder="07123456789"
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendTestSMS()}
                    />
                    <button className="sms-btn purple small" onClick={sendTestSMS} disabled={testSending || !testPhone}>
                      {testSending ? '⋯' : 'Send'}
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
          <div className="sms-convo-sidebar">
            <div className="sms-convo-header">
              <input 
                className="sms-convo-search"
                placeholder="🔍 Search name, phone, message..."
                value={convoSearch}
                onChange={e => setConvoSearch(e.target.value)}
              />
              <div className="sms-convo-filters">
                <button className={`sms-convo-filter ${convoFilter === 'all' ? 'active' : ''}`} onClick={() => setConvoFilter('all')}>
                  All ({convoStats.total})
                </button>
                <button className={`sms-convo-filter ${convoFilter === 'needs_action' ? 'active' : ''}`} onClick={() => setConvoFilter('needs_action')}>
                  🔔 Action ({convoStats.needsAction})
                </button>
                <button className={`sms-convo-filter ${convoFilter === 'interested' ? 'active' : ''}`} onClick={() => setConvoFilter('interested')}>
                  ✓ Hot ({convoStats.interested})
                </button>
                <button className={`sms-convo-filter ${convoFilter === 'handled' ? 'active' : ''}`} onClick={() => setConvoFilter('handled')}>
                  ✔ Done ({convoStats.handled})
                </button>
              </div>
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>
                  {convoStats.responseRate}% response rate
                </span>
                <button className="sms-btn xs secondary" onClick={exportConversations}>📥 Export</button>
              </div>
            </div>
            
            <div className="sms-convo-list">
              {filteredConversations.length === 0 ? (
                <div className="sms-empty"><div className="sms-empty-icon">💬</div><div className="sms-empty-text">{convoSearch ? 'No matches' : 'No conversations'}</div></div>
              ) : filteredConversations.map(convo => {
                const intentConfig = getIntentConfig(convo.latestIntent);
                return (
                  <div 
                    key={convo.phone} 
                    className={`sms-convo ${selectedConvo?.phone === convo.phone ? 'active' : ''} ${convo.unreadCount > 0 ? 'unread' : ''} ${convo.isHandled ? 'handled' : ''}`}
                    onClick={() => setSelectedConvo(convo)}
                  >
                    <div className="sms-convo-avatar">{convo.name?.[0]?.toUpperCase() || '?'}</div>
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
                    {convo.hasResponse && (
                      <span className="sms-convo-badge" style={{ background: intentConfig.bg, color: intentConfig.text }}>
                        {intentConfig.icon}
                      </span>
                    )}
                    {convo.unreadCount > 0 && <div className="sms-unread-dot" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sms-detail">
            {selectedConvo ? (
              <>
                <div className="sms-detail-header">
                  <div className="sms-detail-info">
                    <h3>{selectedConvo.name || 'Unknown'}</h3>
                    <div className="sms-detail-meta">
                      <span>📱 {selectedConvo.phone}</span>
                      {selectedConvo.roles?.length ? <span>💼 {selectedConvo.roles.slice(0, 2).join(', ')}</span> : null}
                      {selectedConvo.responseTime && <span>⏱️ Replied in {selectedConvo.responseTime}h</span>}
                    </div>
                  </div>
                  <div className="sms-detail-actions">
                    <button 
                      className={`sms-btn xs ${selectedConvo.isHandled ? 'secondary' : 'purple'}`}
                      onClick={() => toggleHandled(selectedConvo.phone)}
                    >
                      {selectedConvo.isHandled ? '↩ Reopen' : '✔ Done'}
                    </button>
                    <a href={`tel:${selectedConvo.phone}`} className="sms-btn xs primary" style={{ textDecoration: 'none' }}>📞 Call</a>
                    <a href={`https://wa.me/${selectedConvo.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="sms-btn xs secondary" style={{ textDecoration: 'none' }}>💬 WA</a>
                  </div>
                </div>
                
                <div className="sms-messages">
                  {selectedConvo.messages.map((msg: any) => (
                    <div key={msg.id}>
                      <div className={`sms-message ${msg.direction === 'outbound' ? 'out' : 'in'}`}>
                        <div className="sms-message-text">{msg.message_text}</div>
                        <div className="sms-message-time">
                          {new Date(msg.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      {msg.direction === 'inbound' && msg.ai_summary && (
                        <div className="sms-ai-box">
                          <div className="sms-ai-header">🤖 AI</div>
                          <div className="sms-ai-summary">{msg.ai_summary}</div>
                          {msg.ai_suggested_action && <div className="sms-ai-action">→ {msg.ai_suggested_action.replace(/_/g, ' ')}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
                
                {selectedConvo.latestIntent && QUICK_REPLIES[selectedConvo.latestIntent] && (
                  <div className="sms-quick-replies">
                    <div className="sms-quick-replies-title">💡 Quick Replies</div>
                    <div className="sms-quick-replies-list">
                      {QUICK_REPLIES[selectedConvo.latestIntent].map((reply, i) => (
                        <div key={i} className="sms-quick-reply" onClick={() => useQuickReply(reply)} title={reply}>
                          {reply.substring(0, 50)}{reply.length > 50 ? '...' : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="sms-reply-box">
                  <textarea 
                    className="sms-reply-input"
                    placeholder="Type reply... (Enter to send)"
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  />
                  <button className="sms-reply-btn" onClick={sendReply} disabled={sendingReply || !replyMessage.trim()}>
                    {sendingReply ? '⋯' : '→'}
                  </button>
                </div>
              </>
            ) : (
              <div className="sms-empty"><div className="sms-empty-icon">👈</div><div className="sms-empty-text">Select a conversation</div></div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="sms-history">
          <div className="sms-panel">
            <div className="sms-panel-header">
              📊 Campaign History
              <button className="sms-btn xs secondary" onClick={loadCampaigns}>🔄 Refresh</button>
            </div>
            <div className="sms-panel-body" style={{ padding: 0 }}>
              {campaigns.length === 0 ? (
                <div className="sms-empty" style={{ padding: 60 }}><div className="sms-empty-icon">📊</div><div className="sms-empty-text">No campaigns yet</div></div>
              ) : (
                <table className="sms-history-table">
                  <thead><tr><th>Campaign</th><th>Recipients</th><th>Sent</th><th>Rate</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td>{c.total_recipients}</td>
                        <td>{c.sent_count || 0}</td>
                        <td>{c.total_recipients > 0 ? Math.round(((c.sent_count || 0) / c.total_recipients) * 100) : 0}%</td>
                        <td><span className={`sms-campaign-status ${c.status}`}>{c.status}</span></td>
                        <td style={{ color: '#6b7280', fontSize: 12 }}>
                          {new Date(c.started_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
