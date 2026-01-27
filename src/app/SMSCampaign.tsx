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
  roles?: string;
  driver?: string;
  dbs_update_service?: string;
  created_at?: string;
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
  roles: string | null;
  messages: any[];
  lastMessage: any;
  hasResponse: boolean;
  latestIntent: string | null;
  latestSentiment: string | null;
  lastActivity: Date;
  unreadCount: number;
  isHandled: boolean;
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

interface SavedAudience {
  id: string;
  name: string;
  candidateIds: string[];
  createdAt: string;
}

// Common care roles for quick filtering
const CARE_ROLES = [
  { key: 'hca', label: 'HCA', keywords: ['hca', 'health care assistant', 'healthcare assistant', 'care assistant'] },
  { key: 'nurse', label: 'Nurse', keywords: ['nurse', 'rgn', 'rmn', 'registered nurse', 'staff nurse'] },
  { key: 'senior', label: 'Senior Carer', keywords: ['senior carer', 'senior care', 'team leader', 'shift leader'] },
  { key: 'support', label: 'Support Worker', keywords: ['support worker', 'support assistant', 'care support'] },
  { key: 'driver', label: 'Drivers', keywords: [] }, // Special: uses driver field
  { key: 'dbs', label: 'Has DBS', keywords: [] }, // Special: uses dbs field
];

// Message templates
const MESSAGE_TEMPLATES = [
  { name: 'Initial Outreach', text: 'Hi {name}, this is [Your Name] from [Company]. We have care positions available in your area. Are you looking for work? Reply YES if interested or STOP to opt out.' },
  { name: 'Follow-up', text: 'Hi {name}, following up on my earlier message about care work. We have flexible shifts with great pay. Interested? Reply YES or STOP to opt out.' },
  { name: 'Urgent Hiring', text: 'Hi {name}, URGENT: We need carers in your area this week! Great rates, flexible hours. Reply YES for immediate start or STOP to opt out.' },
  { name: 'Nurses Only', text: 'Hi {name}, we have nursing shifts available at excellent rates. Interested in learning more? Reply YES or STOP to opt out.' },
  { name: 'HCA Shifts', text: 'Hi {name}, HCA shifts available near you - days, nights, weekends. Competitive pay. Reply YES if interested or STOP to opt out.' },
];

// Quick replies
const QUICK_REPLIES: Record<string, string[]> = {
  interested: ['Great! When can I call you for a quick chat?', 'Brilliant! What areas are you looking to work in?', 'Thanks! Do you have any care experience?'],
  question: ['Happy to help! Pay starts at £12/hr. When can I call?', 'Good question! We have flexible shifts. What works for you?'],
  callback_request: ['I\'ll call you shortly!', 'Calling you in 30 mins.', 'What time works best?'],
  not_interested: ['No problem. Best of luck!', 'Understood, thanks for letting me know.']
};

export default function SMSCampaignView() {
  const [activeTab, setActiveTab] = useState<'compose' | 'conversations' | 'history'>('compose');
  const [activeSubTab, setActiveSubTab] = useState<'select' | 'message' | 'send'>('select');
  
  // Candidates & Selection
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [calledFilter, setCalledFilter] = useState<string>('all');
  const [excludeOptOut, setExcludeOptOut] = useState(true);
  const [excludeRecentlySent, setExcludeRecentlySent] = useState(true);
  const [recentDays, setRecentDays] = useState(7);
  const [sentPhones, setSentPhones] = useState<Set<string>>(new Set());
  
  // Saved audiences
  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[]>([]);
  const [audienceName, setAudienceName] = useState('');
  const [showSaveAudience, setShowSaveAudience] = useState(false);
  
  // Message
  const [message, setMessage] = useState(MESSAGE_TEMPLATES[0].text);
  const [campaignName, setCampaignName] = useState('');
  
  // Gateway
  const [gatewayUrl, setGatewayUrl] = useState('http://192.168.1.100:8080');
  const [gatewayUsername, setGatewayUsername] = useState('');
  const [gatewayPassword, setGatewayPassword] = useState('');
  const [sendDelay, setSendDelay] = useState(30);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null);
  
  // Sending
  const [isSending, setIsSending] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sendLog, setSendLog] = useState<SendLog[]>([]);
  const [sendStats, setSendStats] = useState({ sent: 0, failed: 0, skipped: 0 });
  const abortRef = useRef(false);
  const pausedRef = useRef(false);
  const [isPausedDisplay, setIsPausedDisplay] = useState(false);
  
  // Conversations
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [convoFilter, setConvoFilter] = useState<string>('all');
  const [convoSearch, setConvoSearch] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [handledConvos, setHandledConvos] = useState<Set<string>>(new Set());
  
  // History
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Test
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('smsGatewaySettings');
      if (saved) {
        const s = JSON.parse(saved);
        setGatewayUrl(s.url || 'http://192.168.1.100:8080');
        setGatewayUsername(s.username || '');
        setGatewayPassword(s.password || '');
        setSendDelay(s.delay || 30);
      }
    } catch (e) {
      console.error('Error loading gateway settings:', e);
    }
    
    try {
      const savedHandled = localStorage.getItem('handledConversations');
      if (savedHandled) setHandledConvos(new Set(JSON.parse(savedHandled)));
    } catch (e) {
      console.error('Error loading handled conversations:', e);
    }
    
    try {
      const savedAuds = localStorage.getItem('smsAudiences');
      if (savedAuds) setSavedAudiences(JSON.parse(savedAuds));
    } catch (e) {
      console.error('Error loading audiences:', e);
    }
    
    loadCandidates();
    loadConversations();
    loadCampaigns();
    loadSentPhones();
  }, []);

  useEffect(() => { loadSentPhones(); }, [recentDays]);
  
  useEffect(() => { 
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('handledConversations', JSON.stringify([...handledConvos])); 
      } catch (e) {
        console.error('Error saving handled conversations:', e);
      }
    }
  }, [handledConvos]);
  
  useEffect(() => { 
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('smsAudiences', JSON.stringify(savedAudiences)); 
      } catch (e) {
        console.error('Error saving audiences:', e);
      }
    }
  }, [savedAudiences]);

  const saveGatewaySettings = () => {
    localStorage.setItem('smsGatewaySettings', JSON.stringify({ url: gatewayUrl, username: gatewayUsername, password: gatewayPassword, delay: sendDelay }));
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  async function loadCandidates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, name, phone_e164, status, source, last_called_at, sms_opt_out, roles, driver, dbs_update_service, created_at')
        .not('phone_e164', 'is', null)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading candidates:', error);
      }
      if (data) setCandidates(data);
    } catch (e) {
      console.error('Error loading candidates:', e);
    }
    setLoading(false);
  }

  async function loadSentPhones() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - recentDays);
      const { data, error } = await supabase.from('sms_messages').select('phone_e164').eq('direction', 'outbound').gte('created_at', cutoff.toISOString());
      if (error) {
        console.error('Error loading sent phones:', error);
        return;
      }
      if (data) setSentPhones(new Set(data.map(m => m.phone_e164)));
    } catch (e) {
      console.error('Error loading sent phones:', e);
    }
  }

  async function loadConversations() {
    try {
      const { data, error } = await supabase.from('sms_messages').select('*, candidates(id, name, roles, status)').order('created_at', { ascending: false }).limit(500);
      if (error) {
        console.error('Error loading conversations:', error);
        return;
      }
      if (data && data.length > 0) {
      const grouped = new Map<string, any[]>();
      data.forEach(msg => {
        const existing = grouped.get(msg.phone_e164) || [];
        existing.push(msg);
        grouped.set(msg.phone_e164, existing);
      });
      
      const convos: Conversation[] = Array.from(grouped.entries()).map(([phone, msgs]) => {
        const sorted = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const latestIn = msgs.filter(m => m.direction === 'inbound').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const latestOut = msgs.filter(m => m.direction === 'outbound').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        let unread = 0;
        if (latestIn) {
          if (latestOut) unread = msgs.filter(m => m.direction === 'inbound' && new Date(m.created_at) > new Date(latestOut.created_at)).length;
          else unread = msgs.filter(m => m.direction === 'inbound').length;
        }
        return {
          phone,
          name: msgs.find(m => m.candidates?.name)?.candidates?.name || null,
          candidateId: msgs.find(m => m.candidates?.id)?.candidates?.id || null,
          roles: msgs.find(m => m.candidates?.roles)?.candidates?.roles || null,
          messages: sorted,
          lastMessage: msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0],
          hasResponse: msgs.some(m => m.direction === 'inbound'),
          latestIntent: latestIn?.ai_intent || null,
          latestSentiment: latestIn?.ai_sentiment || null,
          lastActivity: new Date(msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at),
          unreadCount: unread,
          isHandled: handledConvos.has(phone)
        };
      });
      convos.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      setConversations(convos);
      }
    } catch (e) {
      console.error('Error loading conversations:', e);
    }
  }

  async function loadCampaigns() {
    try {
      const { data, error } = await supabase.from('sms_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) {
        console.error('Error loading campaigns:', error);
        return;
      }
      if (data) setCampaigns(data);
    } catch (e) {
      console.error('Error loading campaigns:', e);
    }
  }

  // Parse roles from string (could be comma-separated, JSON array, or plain text)
  const parseRoles = (rolesStr: string | null | undefined): string[] => {
    if (!rolesStr) return [];
    try {
      const parsed = JSON.parse(rolesStr);
      if (Array.isArray(parsed)) return parsed.map(r => r.toLowerCase().trim());
    } catch {}
    return rolesStr.toLowerCase().split(/[,;|]/).map(r => r.trim()).filter(Boolean);
  };

  // Check if candidate matches a role filter
  const matchesRole = (candidate: Candidate, roleKey: string): boolean => {
    if (roleKey === 'all') return true;
    
    const role = CARE_ROLES.find(r => r.key === roleKey);
    if (!role) return true;
    
    // Special cases
    if (roleKey === 'driver') return candidate.driver?.toLowerCase() === 'yes';
    if (roleKey === 'dbs') return candidate.dbs_update_service?.toLowerCase() === 'yes';
    
    const candidateRoles = parseRoles(candidate.roles);
    return role.keywords.some(kw => 
      candidateRoles.some(cr => cr.includes(kw)) || 
      candidate.roles?.toLowerCase().includes(kw)
    );
  };

  // Phone validation
  const isValidPhone = (phone: string | null | undefined): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    try {
      const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
      let e164 = cleaned;
      if (cleaned.startsWith('0')) e164 = '+44' + cleaned.slice(1);
      else if (!cleaned.startsWith('+')) e164 = '+' + cleaned;
      return e164.startsWith('+447') && e164.length === 13;
    } catch {
      return false;
    }
  };

  // Filtered candidates (for display)
  const filteredCandidates = useMemo(() => {
    if (!candidates || candidates.length === 0) return [];
    return candidates.filter(c => {
      if (!c || !c.phone_e164 || !isValidPhone(c.phone_e164)) return false;
      if (excludeOptOut && c.sms_opt_out) return false;
      if (excludeRecentlySent && sentPhones.has(c.phone_e164)) return false;
      if (!matchesRole(c, roleFilter)) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
      if (calledFilter === 'called' && !c.last_called_at) return false;
      if (calledFilter === 'not-called' && c.last_called_at) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = c.name?.toLowerCase().includes(q);
        const phoneMatch = c.phone_e164.includes(q);
        const roleMatch = c.roles?.toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !roleMatch) return false;
      }
      return true;
    });
  }, [candidates, excludeOptOut, excludeRecentlySent, sentPhones, roleFilter, statusFilter, sourceFilter, calledFilter, searchQuery]);

  // Selected candidates (for sending)
  const selectedCandidates = useMemo(() => {
    if (!candidates || candidates.length === 0) return [];
    return candidates.filter(c => c && c.phone_e164 && selectedIds.has(c.id) && isValidPhone(c.phone_e164));
  }, [candidates, selectedIds]);

  // Get unique values for filters
  const uniqueSources = useMemo(() => {
    if (!candidates || candidates.length === 0) return [];
    return [...new Set(candidates.map(c => c.source).filter(Boolean))];
  }, [candidates]);
  
  const uniqueStatuses = useMemo(() => {
    if (!candidates || candidates.length === 0) return [];
    return [...new Set(candidates.map(c => c.status).filter(Boolean))];
  }, [candidates]);

  // Role counts
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredCandidates?.length || 0 };
    if (!candidates || candidates.length === 0) return counts;
    CARE_ROLES.forEach(role => {
      counts[role.key] = candidates.filter(c => 
        c && c.phone_e164 && isValidPhone(c.phone_e164) && 
        (!excludeOptOut || !c.sms_opt_out) && 
        (!excludeRecentlySent || !sentPhones.has(c.phone_e164)) &&
        matchesRole(c, role.key)
      ).length;
    });
    return counts;
  }, [candidates, filteredCandidates?.length, excludeOptOut, excludeRecentlySent, sentPhones]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredCandidates.map(c => c.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectByRole = (roleKey: string) => {
    const matching = candidates.filter(c => 
      c && c.phone_e164 && isValidPhone(c.phone_e164) && 
      (!excludeOptOut || !c.sms_opt_out) && 
      matchesRole(c, roleKey)
    );
    setSelectedIds(new Set(matching.map(c => c.id)));
  };

  const loadAudience = (audience: SavedAudience) => {
    setSelectedIds(new Set(audience.candidateIds));
  };

  const saveAudience = () => {
    if (!audienceName.trim() || selectedIds.size === 0) return;
    const newAud: SavedAudience = {
      id: Date.now().toString(),
      name: audienceName.trim(),
      candidateIds: [...selectedIds],
      createdAt: new Date().toISOString()
    };
    setSavedAudiences(prev => [newAud, ...prev]);
    setAudienceName('');
    setShowSaveAudience(false);
  };

  const deleteAudience = (id: string) => {
    setSavedAudiences(prev => prev.filter(a => a.id !== id));
  };

  // Message helpers
  const personalizeMessage = (template: string, candidate: Candidate) => {
    const firstName = candidate.name?.split(' ')[0] || 'there';
    return template.replace(/{name}/gi, firstName).replace(/{full_name}/gi, candidate.name || 'there');
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  // Gateway
  async function sendViaGateway(phone: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      const creds = btoa(`${gatewayUsername}:${gatewayPassword}`);
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(`${gatewayUrl}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${creds}` },
        body: JSON.stringify({ message: text, phoneNumbers: [phone] }),
        signal: ctrl.signal
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.message || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.name === 'AbortError' ? 'Timeout' : e.message };
    }
  }

  async function testGateway() {
    try {
      const creds = btoa(`${gatewayUsername}:${gatewayPassword}`);
      const res = await fetch(`${gatewayUrl}/health`, { headers: { 'Authorization': `Basic ${creds}` } });
      setGatewayConnected(res.ok);
    } catch { setGatewayConnected(false); }
  }

  async function sendTestSMS() {
    if (!testPhone) return;
    setTestSending(true);
    setTestResult(null);
    let phone = testPhone.replace(/\s/g, '');
    if (phone.startsWith('0')) phone = '+44' + phone.slice(1);
    if (!phone.startsWith('+')) phone = '+' + phone;
    const result = await sendViaGateway(phone, personalizeMessage(message, { id: 'test', name: 'Test', phone_e164: phone, status: 'test', source: null, last_called_at: null }));
    setTestResult({ success: result.success, message: result.success ? '✓ Sent!' : `✗ ${result.error}` });
    setTestSending(false);
  }

  // Campaign sending
  async function startSending() {
    if (selectedCandidates.length === 0) { alert('No candidates selected!'); return; }
    if (!gatewayUsername) { alert('Enter gateway credentials first!'); return; }
    
    setIsSending(true);
    pausedRef.current = false;
    setIsPausedDisplay(false);
    abortRef.current = false;
    setCurrentIndex(0);
    setSendLog([]);
    setSendStats({ sent: 0, failed: 0, skipped: 0 });
    
    const campaignSent = new Set<string>();
    const { data: campaign } = await supabase.from('sms_campaigns').insert({
      name: campaignName || `Campaign ${new Date().toLocaleDateString('en-GB')}`,
      template: message,
      total_recipients: selectedCandidates.length,
      sent_count: 0,
      status: 'sending',
      started_at: new Date().toISOString()
    }).select().single();

    let sent = 0, failed = 0, skipped = 0;

    for (let i = 0; i < selectedCandidates.length; i++) {
      if (abortRef.current) break;
      while (pausedRef.current && !abortRef.current) await new Promise(r => setTimeout(r, 500));
      if (abortRef.current) break;

      const c = selectedCandidates[i];
      setCurrentIndex(i);
      
      if (campaignSent.has(c.phone_e164)) {
        setSendLog(prev => [...prev, { phone: c.phone_e164, name: c.name || 'Unknown', status: 'skipped', reason: 'Duplicate' }]);
        skipped++;
        setSendStats({ sent, failed, skipped });
        continue;
      }

      setSendLog(prev => [...prev, { phone: c.phone_e164, name: c.name || 'Unknown', status: 'pending' }]);
      const result = await sendViaGateway(c.phone_e164, personalizeMessage(message, c));
      
      if (result.success) {
        await supabase.from('sms_messages').insert({
          candidate_id: c.id,
          phone_e164: c.phone_e164,
          direction: 'outbound',
          message_text: personalizeMessage(message, c),
          campaign_id: campaign?.id,
          status: 'sent',
          sent_at: new Date().toISOString()
        });
        campaignSent.add(c.phone_e164);
        sent++;
        setSendLog(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, status: 'sent' } : item));
      } else {
        failed++;
        setSendLog(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, status: 'failed', error: result.error } : item));
      }
      setSendStats({ sent, failed, skipped });

      if (i < selectedCandidates.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, sendDelay * 1000));
      }
    }

    if (campaign?.id) {
      await supabase.from('sms_campaigns').update({ status: abortRef.current ? 'stopped' : 'completed', sent_count: sent, completed_at: new Date().toISOString() }).eq('id', campaign.id);
    }
    setIsSending(false);
    loadCampaigns();
    loadSentPhones();
  }

  // Reply
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
      setHandledConvos(prev => new Set([...prev, selectedConvo.phone]));
      loadConversations();
    } else {
      alert('Failed: ' + result.error);
    }
    setSendingReply(false);
  }

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    if (!conversations || conversations.length === 0) return [];
    return conversations.filter(c => {
      if (convoSearch) {
        const q = convoSearch.toLowerCase();
        if (!c.name?.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      }
      if (convoFilter === 'needs_action') return c.hasResponse && ['interested', 'callback_request', 'question'].includes(c.latestIntent || '') && !c.isHandled;
      if (convoFilter === 'interested') return c.latestIntent === 'interested';
      if (convoFilter === 'handled') return c.isHandled;
      return true;
    });
  }, [conversations, convoSearch, convoFilter]);

  const convoStats = useMemo(() => ({
    total: conversations?.length || 0,
    needsAction: (conversations || []).filter(c => c.hasResponse && ['interested', 'callback_request', 'question'].includes(c.latestIntent || '') && !c.isHandled).length,
    interested: (conversations || []).filter(c => c.latestIntent === 'interested').length
  }), [conversations]);

  const getIntentConfig = (intent: string | null) => {
    switch (intent) {
      case 'interested': return { bg: '#dcfce7', text: '#166534', icon: '✓' };
      case 'callback_request': return { bg: '#dbeafe', text: '#1e40af', icon: '📞' };
      case 'question': return { bg: '#fef3c7', text: '#92400e', icon: '❓' };
      case 'not_interested': case 'stop_request': return { bg: '#fee2e2', text: '#991b1b', icon: '✗' };
      default: return { bg: '#f3f4f6', text: '#6b7280', icon: '•' };
    }
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(diff / 86400000);
    return `${days}d`;
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .sms-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#fff;padding:0 24px}
        .sms-tab{padding:16px 24px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;border-bottom:3px solid transparent;display:flex;align-items:center;gap:8px}
        .sms-tab:hover{color:#111;background:#f9fafb}
        .sms-tab.active{color:#4f46e5;border-bottom-color:#4f46e5}
        .sms-badge{padding:2px 8px;background:#ef4444;color:#fff;border-radius:10px;font-size:11px;font-weight:700}
        .sms-badge.green{background:#22c55e}
        
        .sms-content{padding:24px}
        .sms-grid{display:grid;grid-template-columns:1fr 400px;gap:24px}
        @media(max-width:1200px){.sms-grid{grid-template-columns:1fr}}
        
        .sms-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
        .sms-panel-header{padding:14px 18px;border-bottom:1px solid #e5e7eb;font-weight:600;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
        .sms-panel-body{padding:18px}
        
        .sms-sub-tabs{display:flex;gap:4px;margin-bottom:16px;background:#f3f4f6;padding:4px;border-radius:8px}
        .sms-sub-tab{flex:1;padding:10px;text-align:center;font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;color:#6b7280}
        .sms-sub-tab:hover{background:#e5e7eb}
        .sms-sub-tab.active{background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.1)}
        
        .sms-input{width:100%;padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box}
        .sms-input:focus{outline:none;border-color:#4f46e5}
        .sms-textarea{width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;min-height:100px;resize:vertical;font-family:inherit;box-sizing:border-box}
        .sms-textarea:focus{outline:none;border-color:#4f46e5}
        .sms-select{padding:8px 12px;border:2px solid #e5e7eb;border-radius:6px;font-size:13px;background:#fff}
        
        .sms-btn{padding:12px 18px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;border:none;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .sms-btn:disabled{opacity:.5;cursor:not-allowed}
        .sms-btn.primary{background:#22c55e;color:#fff}
        .sms-btn.primary:hover:not(:disabled){background:#16a34a}
        .sms-btn.secondary{background:#f3f4f6;color:#374151}
        .sms-btn.secondary:hover:not(:disabled){background:#e5e7eb}
        .sms-btn.purple{background:#4f46e5;color:#fff}
        .sms-btn.purple:hover:not(:disabled){background:#4338ca}
        .sms-btn.danger{background:#fee2e2;color:#dc2626}
        .sms-btn.small{padding:8px 12px;font-size:12px}
        .sms-btn.block{width:100%}
        
        .sms-role-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
        .sms-role-btn{padding:8px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;transition:all .2s}
        .sms-role-btn:hover{border-color:#4f46e5;background:#eef2ff}
        .sms-role-btn.active{border-color:#4f46e5;background:#4f46e5;color:#fff}
        .sms-role-btn span{font-weight:400;opacity:.7;margin-left:4px}
        
        .sms-candidate-list{max-height:400px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px}
        .sms-candidate{padding:12px 14px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:12px;cursor:pointer}
        .sms-candidate:hover{background:#f9fafb}
        .sms-candidate.selected{background:#eef2ff}
        .sms-candidate-check{width:20px;height:20px;border:2px solid #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;flex-shrink:0}
        .sms-candidate.selected .sms-candidate-check{background:#4f46e5;border-color:#4f46e5}
        .sms-candidate-info{flex:1;min-width:0}
        .sms-candidate-name{font-weight:600;font-size:14px}
        .sms-candidate-meta{font-size:12px;color:#6b7280;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
        .sms-candidate-role{padding:2px 8px;background:#f3f4f6;border-radius:4px;font-size:11px;font-weight:500}
        
        .sms-selection-bar{display:flex;justify-content:space-between;align-items:center;padding:12px;background:#eef2ff;border-radius:8px;margin-bottom:12px}
        
        .sms-audiences{margin-bottom:16px}
        .sms-audience{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f9fafb;border-radius:6px;margin-bottom:6px}
        .sms-audience-name{font-weight:500;font-size:13px}
        .sms-audience-count{font-size:12px;color:#6b7280}
        
        .sms-templates{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
        .sms-template{padding:6px 12px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;cursor:pointer;background:#fff}
        .sms-template:hover{border-color:#4f46e5}
        .sms-template.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
        
        .sms-preview{margin-top:12px;padding:14px;background:#f0f9ff;border:1px solid #7dd3fc;border-radius:8px}
        .sms-preview-title{font-size:12px;font-weight:600;color:#0369a1;margin-bottom:6px}
        .sms-preview-text{font-size:13px;color:#0c4a6e;line-height:1.5;white-space:pre-wrap}
        
        .sms-progress{margin-top:16px;padding:14px;background:#f9fafb;border-radius:8px}
        .sms-progress-bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden}
        .sms-progress-fill{height:100%;background:#4f46e5;transition:width .3s}
        .sms-progress-stats{display:flex;justify-content:space-between;margin-top:10px;font-size:12px}
        
        .sms-log{max-height:200px;overflow-y:auto;margin-top:12px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px}
        .sms-log-item{padding:8px 12px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between}
        .sms-log-item.sent{background:#f0fdf4}
        .sms-log-item.failed{background:#fef2f2}
        .sms-log-item.skipped{background:#fffbeb}
        
        .sms-convo-container{display:flex;height:calc(100vh - 120px)}
        .sms-convo-sidebar{width:380px;border-right:1px solid #e5e7eb;background:#fff;display:flex;flex-direction:column}
        .sms-convo-header{padding:16px;border-bottom:1px solid #e5e7eb}
        .sms-convo-list{flex:1;overflow-y:auto}
        .sms-convo{padding:14px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;gap:12px;align-items:center}
        .sms-convo:hover{background:#f9fafb}
        .sms-convo.active{background:#eef2ff;border-left:3px solid #4f46e5}
        .sms-convo-avatar{width:40px;height:40px;border-radius:10px;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
        .sms-convo-info{flex:1;min-width:0}
        .sms-convo-name{font-weight:600;font-size:14px}
        .sms-convo-preview{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sms-convo-badge{padding:4px 8px;border-radius:6px;font-size:10px;font-weight:700}
        
        .sms-detail{flex:1;display:flex;flex-direction:column;background:#f8fafc}
        .sms-detail-header{padding:16px 20px;background:#fff;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .sms-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
        .sms-message{max-width:75%;padding:10px 14px;border-radius:12px}
        .sms-message.out{background:#4f46e5;color:#fff;align-self:flex-end}
        .sms-message.in{background:#fff;border:1px solid #e5e7eb;align-self:flex-start}
        .sms-ai-box{max-width:75%;padding:10px;background:#fefce8;border:1px solid #fde047;border-radius:8px;font-size:12px;align-self:flex-start;margin-top:-4px}
        .sms-quick-replies{padding:12px 20px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:8px;flex-wrap:wrap}
        .sms-quick-reply{padding:6px 12px;background:#f3f4f6;border-radius:6px;font-size:12px;cursor:pointer}
        .sms-quick-reply:hover{background:#e5e7eb}
        .sms-reply-box{padding:14px 20px;background:#fff;border-top:1px solid #e5e7eb;display:flex;gap:10px}
        .sms-reply-input{flex:1;padding:10px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;resize:none}
        .sms-reply-input:focus{outline:none;border-color:#4f46e5}
        .sms-reply-btn{padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
        .sms-reply-btn:disabled{opacity:.5}
        
        .sms-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9ca3af}
        .sms-empty-icon{font-size:40px;margin-bottom:12px;opacity:.5}
        
        .sms-history-table{width:100%;border-collapse:collapse}
        .sms-history-table th{padding:12px;text-align:left;font-size:12px;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb}
        .sms-history-table td{padding:12px;font-size:13px;border-bottom:1px solid #f3f4f6}
        .sms-campaign-status{padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600}
        .sms-campaign-status.completed{background:#dcfce7;color:#166534}
        .sms-campaign-status.sending{background:#dbeafe;color:#1e40af}
        .sms-campaign-status.stopped{background:#fee2e2;color:#991b1b}
      `}</style>

      {/* Tabs */}
      <div className="sms-tabs">
        <div className={`sms-tab ${activeTab === 'compose' ? 'active' : ''}`} onClick={() => setActiveTab('compose')}>📱 SMS Campaign</div>
        <div className={`sms-tab ${activeTab === 'conversations' ? 'active' : ''}`} onClick={() => { setActiveTab('conversations'); loadConversations(); }}>
          💬 Conversations
          {convoStats.needsAction > 0 && <span className="sms-badge">{convoStats.needsAction}</span>}
        </div>
        <div className={`sms-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); loadCampaigns(); }}>📊 History</div>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="sms-content">
          {/* Sub-tabs for workflow */}
          <div className="sms-sub-tabs">
            <div className={`sms-sub-tab ${activeSubTab === 'select' ? 'active' : ''}`} onClick={() => setActiveSubTab('select')}>
              1. Select Recipients {selectedIds.size > 0 && `(${selectedIds.size})`}
            </div>
            <div className={`sms-sub-tab ${activeSubTab === 'message' ? 'active' : ''}`} onClick={() => setActiveSubTab('message')}>
              2. Write Message
            </div>
            <div className={`sms-sub-tab ${activeSubTab === 'send' ? 'active' : ''}`} onClick={() => setActiveSubTab('send')}>
              3. Send Campaign
            </div>
          </div>

          {/* Step 1: Select Recipients */}
          {activeSubTab === 'select' && (
            <div className="sms-grid">
              <div>
                <div className="sms-panel">
                  <div className="sms-panel-header">
                    <span>🎯 Select Recipients</span>
                    <span style={{ fontWeight: 700, color: selectedIds.size > 0 ? '#16a34a' : '#6b7280' }}>
                      {selectedIds.size} selected
                    </span>
                  </div>
                  <div className="sms-panel-body">
                    {/* Quick Role Buttons */}
                    <div className="sms-role-btns">
                      <button 
                        className={`sms-role-btn ${roleFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setRoleFilter('all')}
                      >
                        All <span>({roleCounts.all})</span>
                      </button>
                      {CARE_ROLES.map(role => (
                        <button 
                          key={role.key}
                          className={`sms-role-btn ${roleFilter === role.key ? 'active' : ''}`}
                          onClick={() => setRoleFilter(role.key)}
                        >
                          {role.label} <span>({roleCounts[role.key] || 0})</span>
                        </button>
                      ))}
                    </div>

                    {/* Search & Filters */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      <input 
                        className="sms-input" 
                        style={{ flex: 1, minWidth: 200, marginBottom: 0 }}
                        placeholder="🔍 Search name, phone, role..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                      <select className="sms-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="all">All Statuses</option>
                        {uniqueStatuses.map(s => <option key={s} value={s!}>{s}</option>)}
                      </select>
                      <select className="sms-select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                        <option value="all">All Sources</option>
                        {uniqueSources.map(s => <option key={s} value={s!}>{s}</option>)}
                      </select>
                    </div>

                    {/* Selection Bar */}
                    <div className="sms-selection-bar">
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="sms-btn small secondary" onClick={selectAll}>Select All ({filteredCandidates.length})</button>
                        <button className="sms-btn small secondary" onClick={selectNone}>Clear</button>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="sms-btn small purple" onClick={() => selectByRole('hca')}>All HCAs</button>
                        <button className="sms-btn small purple" onClick={() => selectByRole('nurse')}>All Nurses</button>
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={excludeOptOut} onChange={e => setExcludeOptOut(e.target.checked)} />
                        Exclude opted-out
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={excludeRecentlySent} onChange={e => setExcludeRecentlySent(e.target.checked)} />
                        Exclude sent in last {recentDays} days
                      </label>
                    </div>

                    {/* Candidate List */}
                    <div className="sms-candidate-list">
                      {loading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
                      ) : filteredCandidates.length === 0 ? (
                        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No candidates match filters</div>
                      ) : filteredCandidates.map(c => (
                        <div 
                          key={c.id} 
                          className={`sms-candidate ${selectedIds.has(c.id) ? 'selected' : ''}`}
                          onClick={() => toggleSelect(c.id)}
                        >
                          <div className="sms-candidate-check">{selectedIds.has(c.id) && '✓'}</div>
                          <div className="sms-candidate-info">
                            <div className="sms-candidate-name">{c.name || 'Unknown'}</div>
                            <div className="sms-candidate-meta">
                              <span>{c.phone_e164}</span>
                              {c.roles && <span className="sms-candidate-role">{c.roles}</span>}
                              {c.driver === 'Yes' && <span className="sms-candidate-role">🚗 Driver</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar: Saved Audiences */}
              <div>
                <div className="sms-panel">
                  <div className="sms-panel-header">
                    <span>📁 Saved Audiences</span>
                    <button className="sms-btn small secondary" onClick={() => setShowSaveAudience(!showSaveAudience)}>
                      {showSaveAudience ? 'Cancel' : '+ Save'}
                    </button>
                  </div>
                  <div className="sms-panel-body">
                    {showSaveAudience && (
                      <div style={{ marginBottom: 16 }}>
                        <input 
                          className="sms-input"
                          placeholder="Audience name..."
                          value={audienceName}
                          onChange={e => setAudienceName(e.target.value)}
                          style={{ marginBottom: 8 }}
                        />
                        <button 
                          className="sms-btn primary block"
                          onClick={saveAudience}
                          disabled={!audienceName.trim() || selectedIds.size === 0}
                        >
                          Save {selectedIds.size} Recipients
                        </button>
                      </div>
                    )}
                    
                    {savedAudiences.length === 0 ? (
                      <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 }}>
                        No saved audiences yet. Select candidates and save for quick access later.
                      </div>
                    ) : savedAudiences.map(aud => (
                      <div key={aud.id} className="sms-audience">
                        <div>
                          <div className="sms-audience-name">{aud.name}</div>
                          <div className="sms-audience-count">{aud.candidateIds.length} recipients</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="sms-btn small secondary" onClick={() => loadAudience(aud)}>Load</button>
                          <button className="sms-btn small danger" onClick={() => deleteAudience(aud.id)}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="sms-panel" style={{ marginTop: 16 }}>
                  <div className="sms-panel-header">📊 Selection Summary</div>
                  <div className="sms-panel-body">
                    <div style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', color: selectedIds.size > 0 ? '#16a34a' : '#dc2626' }}>
                      {selectedIds.size}
                    </div>
                    <div style={{ textAlign: 'center', color: '#6b7280', marginBottom: 16 }}>recipients selected</div>
                    
                    <button 
                      className="sms-btn primary block"
                      onClick={() => setActiveSubTab('message')}
                      disabled={selectedIds.size === 0}
                    >
                      Continue to Message →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Write Message */}
          {activeSubTab === 'message' && (
            <div className="sms-grid">
              <div>
                <div className="sms-panel">
                  <div className="sms-panel-header">
                    <span>✍️ Write Message</span>
                    <span style={{ fontSize: 12, color: charCount > 160 ? '#f59e0b' : '#6b7280' }}>
                      {charCount} chars • {smsCount} SMS
                    </span>
                  </div>
                  <div className="sms-panel-body">
                    {/* Templates */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Quick Templates:</div>
                      <div className="sms-templates">
                        {MESSAGE_TEMPLATES.map((t, i) => (
                          <button 
                            key={i}
                            className={`sms-template ${message === t.text ? 'active' : ''}`}
                            onClick={() => setMessage(t.text)}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <input 
                      className="sms-input"
                      placeholder="Campaign name (optional)"
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      style={{ marginBottom: 12 }}
                    />

                    <textarea 
                      className="sms-textarea"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Type your message..."
                      style={{ minHeight: 150 }}
                    />

                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                      Variables: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{'{name}'}</code>
                    </div>

                    {/* Preview */}
                    <div className="sms-preview">
                      <div className="sms-preview-title">📱 Preview (to {selectedCandidates[0]?.name || 'John'})</div>
                      <div className="sms-preview-text">
                        {personalizeMessage(message, selectedCandidates[0] || { id: '1', name: 'John', phone_e164: '+447123456789', status: 'new', source: null, last_called_at: null })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="sms-panel">
                  <div className="sms-panel-header">📋 Summary</div>
                  <div className="sms-panel-body">
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#6b7280' }}>Recipients:</span>
                        <strong>{selectedIds.size}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#6b7280' }}>SMS per person:</span>
                        <strong>{smsCount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#6b7280' }}>Total messages:</span>
                        <strong>{selectedIds.size * smsCount}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#6b7280' }}>Est. time:</span>
                        <strong>{Math.ceil((selectedIds.size * sendDelay) / 60)}m</strong>
                      </div>
                    </div>

                    <button 
                      className="sms-btn secondary block"
                      onClick={() => setActiveSubTab('select')}
                      style={{ marginBottom: 8 }}
                    >
                      ← Back to Selection
                    </button>
                    <button 
                      className="sms-btn primary block"
                      onClick={() => setActiveSubTab('send')}
                      disabled={selectedIds.size === 0 || !message.trim()}
                    >
                      Continue to Send →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Send */}
          {activeSubTab === 'send' && (
            <div className="sms-grid">
              <div>
                <div className="sms-panel">
                  <div className="sms-panel-header">🚀 Send Campaign</div>
                  <div className="sms-panel-body">
                    {/* Summary */}
                    <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, textAlign: 'center' }}>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 700 }}>{selectedIds.size}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>Recipients</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 700 }}>{smsCount}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>SMS Each</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 700 }}>{sendDelay}s</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>Delay</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.ceil((selectedIds.size * sendDelay) / 60)}m</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>Est. Time</div>
                        </div>
                      </div>
                    </div>

                    {!isSending ? (
                      <>
                        <button className="sms-btn primary block" onClick={startSending} disabled={selectedIds.size === 0}>
                          📱 Start Sending ({selectedIds.size} recipients)
                        </button>
                        <button className="sms-btn secondary block" onClick={() => setActiveSubTab('message')} style={{ marginTop: 8 }}>
                          ← Back to Message
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="sms-btn secondary block" onClick={() => { pausedRef.current = !pausedRef.current; setIsPausedDisplay(!isPausedDisplay); }}>
                          {isPausedDisplay ? '▶️ Resume' : '⏸️ Pause'}
                        </button>
                        <button className="sms-btn danger block" onClick={() => { abortRef.current = true; }} style={{ marginTop: 8 }}>
                          ⏹️ Stop
                        </button>
                      </>
                    )}

                    {isSending && (
                      <div className="sms-progress">
                        <div className="sms-progress-bar">
                          <div className="sms-progress-fill" style={{ width: `${((currentIndex + 1) / selectedCandidates.length) * 100}%` }} />
                        </div>
                        <div className="sms-progress-stats">
                          <span>{currentIndex + 1}/{selectedCandidates.length} {isPausedDisplay && '(Paused)'}</span>
                          <span>✓ {sendStats.sent} | ✗ {sendStats.failed} | ⊘ {sendStats.skipped}</span>
                        </div>
                      </div>
                    )}

                    {sendLog.length > 0 && (
                      <div className="sms-log">
                        {sendLog.slice().reverse().slice(0, 30).map((log, i) => (
                          <div key={i} className={`sms-log-item ${log.status}`}>
                            <div>
                              <strong>{log.name}</strong>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>{log.phone}</div>
                              {log.error && <div style={{ fontSize: 10, color: '#dc2626' }}>{log.error}</div>}
                            </div>
                            <span>{log.status === 'sent' ? '✓' : log.status === 'failed' ? '✗' : '⊘'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                {/* Gateway Settings */}
                <div className="sms-panel">
                  <div className="sms-panel-header">
                    <span>⚙️ Gateway</span>
                    <span 
                      style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                        background: gatewayConnected === true ? '#dcfce7' : gatewayConnected === false ? '#fee2e2' : '#f3f4f6',
                        color: gatewayConnected === true ? '#166534' : gatewayConnected === false ? '#991b1b' : '#6b7280'
                      }}
                      onClick={testGateway}
                    >
                      {gatewayConnected === true ? '✓ Connected' : gatewayConnected === false ? '✗ Offline' : '? Test'}
                    </span>
                  </div>
                  <div className="sms-panel-body">
                    <input className="sms-input" value={gatewayUrl} onChange={e => setGatewayUrl(e.target.value)} placeholder="Gateway URL" style={{ marginBottom: 8 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <input className="sms-input" value={gatewayUsername} onChange={e => setGatewayUsername(e.target.value)} placeholder="Username" style={{ marginBottom: 0 }} />
                      <input className="sms-input" type="password" value={gatewayPassword} onChange={e => setGatewayPassword(e.target.value)} placeholder="Password" style={{ marginBottom: 0 }} />
                    </div>
                    <button 
                      className="sms-btn secondary block"
                      onClick={saveGatewaySettings}
                      style={{ background: settingsSaved ? '#dcfce7' : undefined, color: settingsSaved ? '#166534' : undefined }}
                    >
                      {settingsSaved ? '✓ Saved!' : 'Save Settings'}
                    </button>
                    
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 12, color: '#6b7280' }}>Delay: {sendDelay}s</label>
                      <input type="range" min="10" max="120" value={sendDelay} onChange={e => setSendDelay(parseInt(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>

                {/* Test SMS */}
                <div className="sms-panel" style={{ marginTop: 16 }}>
                  <div className="sms-panel-header">🧪 Test SMS</div>
                  <div className="sms-panel-body">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        className="sms-input"
                        style={{ flex: 1, marginBottom: 0 }}
                        placeholder="07123456789"
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                      />
                      <button className="sms-btn purple" onClick={sendTestSMS} disabled={testSending || !testPhone}>
                        {testSending ? '...' : 'Test'}
                      </button>
                    </div>
                    {testResult && (
                      <div style={{ marginTop: 10, padding: 10, borderRadius: 6, fontSize: 13, background: testResult.success ? '#dcfce7' : '#fee2e2', color: testResult.success ? '#166534' : '#991b1b' }}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="sms-convo-container">
          <div className="sms-convo-sidebar">
            <div className="sms-convo-header">
              <input 
                className="sms-input"
                placeholder="🔍 Search..."
                value={convoSearch}
                onChange={e => setConvoSearch(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'needs_action', 'interested', 'handled'].map(f => (
                  <button 
                    key={f}
                    className={`sms-btn small ${convoFilter === f ? 'purple' : 'secondary'}`}
                    onClick={() => setConvoFilter(f)}
                  >
                    {f === 'all' ? `All (${convoStats.total})` : 
                     f === 'needs_action' ? `🔔 Action (${convoStats.needsAction})` :
                     f === 'interested' ? `✓ Hot (${convoStats.interested})` : '✔ Done'}
                  </button>
                ))}
              </div>
            </div>
            <div className="sms-convo-list">
              {filteredConversations.length === 0 ? (
                <div className="sms-empty"><div className="sms-empty-icon">💬</div></div>
              ) : filteredConversations.map(c => {
                const cfg = getIntentConfig(c.latestIntent);
                return (
                  <div key={c.phone} className={`sms-convo ${selectedConvo?.phone === c.phone ? 'active' : ''}`} onClick={() => setSelectedConvo(c)}>
                    <div className="sms-convo-avatar">{c.name?.[0]?.toUpperCase() || '?'}</div>
                    <div className="sms-convo-info">
                      <div className="sms-convo-name">{c.name || 'Unknown'}</div>
                      <div className="sms-convo-preview">{c.lastMessage?.message_text?.substring(0, 30)}...</div>
                    </div>
                    {c.hasResponse && <span className="sms-convo-badge" style={{ background: cfg.bg, color: cfg.text }}>{cfg.icon}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sms-detail">
            {selectedConvo ? (
              <>
                <div className="sms-detail-header">
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedConvo.name || 'Unknown'}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{selectedConvo.phone}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="sms-btn small secondary" onClick={() => setHandledConvos(prev => { const n = new Set(prev); n.has(selectedConvo.phone) ? n.delete(selectedConvo.phone) : n.add(selectedConvo.phone); return n; })}>
                      {handledConvos.has(selectedConvo.phone) ? '↩ Reopen' : '✔ Done'}
                    </button>
                    <a href={`tel:${selectedConvo.phone}`} className="sms-btn small primary" style={{ textDecoration: 'none' }}>📞 Call</a>
                  </div>
                </div>
                <div className="sms-messages">
                  {selectedConvo.messages.map((m: any) => (
                    <div key={m.id}>
                      <div className={`sms-message ${m.direction === 'outbound' ? 'out' : 'in'}`}>
                        {m.message_text}
                        <div style={{ fontSize: 10, opacity: .7, marginTop: 4 }}>
                          {new Date(m.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      {m.direction === 'inbound' && m.ai_summary && (
                        <div className="sms-ai-box">
                          <strong>🤖 AI:</strong> {m.ai_summary}
                          {m.ai_suggested_action && <span> → {m.ai_suggested_action.replace(/_/g, ' ')}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {selectedConvo.latestIntent && QUICK_REPLIES[selectedConvo.latestIntent] && (
                  <div className="sms-quick-replies">
                    {QUICK_REPLIES[selectedConvo.latestIntent].map((r, i) => (
                      <div key={i} className="sms-quick-reply" onClick={() => setReplyMessage(r)}>{r.substring(0, 40)}...</div>
                    ))}
                  </div>
                )}
                <div className="sms-reply-box">
                  <textarea 
                    className="sms-reply-input"
                    placeholder="Type reply..."
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  />
                  <button className="sms-reply-btn" onClick={sendReply} disabled={sendingReply || !replyMessage.trim()}>
                    {sendingReply ? '...' : '→'}
                  </button>
                </div>
              </>
            ) : (
              <div className="sms-empty"><div className="sms-empty-icon">👈</div></div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="sms-content">
          <div className="sms-panel">
            <div className="sms-panel-header">📊 Campaign History</div>
            <div className="sms-panel-body" style={{ padding: 0 }}>
              {campaigns.length === 0 ? (
                <div className="sms-empty" style={{ padding: 60 }}><div className="sms-empty-icon">📊</div></div>
              ) : (
                <table className="sms-history-table">
                  <thead><tr><th>Campaign</th><th>Recipients</th><th>Sent</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td>{c.total_recipients}</td>
                        <td>{c.sent_count || 0}</td>
                        <td><span className={`sms-campaign-status ${c.status}`}>{c.status}</span></td>
                        <td style={{ color: '#6b7280' }}>{new Date(c.started_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
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
