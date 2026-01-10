'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Avatar from './Avatar';
import Badge from './Badge';
import StatusBadge from './StatusBadge';

// ============ TYPES ============
interface MessageTemplate {
  id: string;
  name: string;
  packageType: string;
  location: string;
  rate: string;
  rateType: string;
  additionalInfo: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  template: MessageTemplate;
  candidates: QueuedMessage[];
  settings: CampaignSettings;
  stats: CampaignStats;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface CampaignSettings {
  intervalMin: number;
  intervalMax: number;
  skipNoPhone: boolean;
  dailyLimit: number;
}

interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
}

interface QueuedMessage {
  id: string;
  candidateId: string;
  name: string;
  phone: string;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled';
  message: string;
  sentAt?: string;
  error?: string;
}

interface MessageLog {
  id: string;
  campaignId: string;
  candidateName: string;
  phone: string;
  message: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  sentAt: string;
  error?: string;
}

interface WhatsAppState {
  status: 'disconnected' | 'qr' | 'connecting' | 'connected';
  qrCode: string | null;
  clientInfo: {
    pushname: string;
    phone: string;
    platform: string;
  } | null;
}

// ============ AI MESSAGE GENERATOR ============
const generateMessageVariation = (template: MessageTemplate, firstName: string, index: number): string => {
  const greetings = [
    `Hi ${firstName}`,
    `Hello ${firstName}`,
    `Hey ${firstName}`,
    `Hi there ${firstName}`,
    `Good day ${firstName}`,
    `Hi ${firstName}, hope you're well`,
    `Hello ${firstName}, hope you're doing great`,
    `Hey ${firstName}, how are you`,
    `Hi ${firstName}! Hope all is well`,
    `Hello there ${firstName}`,
    `Hi ${firstName}, trust you're well`,
    `Hey ${firstName}, hope you're having a good day`,
  ];
  
  const intros = [
    `I wanted to reach out about an opportunity`,
    `We have a new position available`,
    `I'm getting in touch regarding a role`,
    `There's an opening that might interest you`,
    `We've got an opportunity I thought you'd like`,
    `I have something that might be right for you`,
    `Quick message about a new vacancy`,
    `Reaching out about a care position`,
    `Got a role that could be a great fit`,
    `There's a position I'd love to tell you about`,
    `We're looking for someone and thought of you`,
    `An opportunity just came up`,
  ];
  
  const packageDesc = [
    `It's a ${template.packageType} package`,
    `This is a ${template.packageType} role`,
    `The position is ${template.packageType}`,
    `We're offering a ${template.packageType} package`,
    `It's for ${template.packageType} work`,
  ];
  
  const locationPhrases = [
    `located in ${template.location}`,
    `based in ${template.location}`,
    `in ${template.location}`,
    `in the ${template.location} area`,
    `working in ${template.location}`,
    `covering ${template.location}`,
  ];
  
  const ratePhrases = [
    `paying £${template.rate}${template.rateType === 'hourly' ? '/hr' : ' ' + template.rateType}`,
    `at £${template.rate}${template.rateType === 'hourly' ? ' per hour' : ' ' + template.rateType}`,
    `the rate is £${template.rate}${template.rateType === 'hourly' ? '/hour' : ' ' + template.rateType}`,
    `offering £${template.rate}${template.rateType === 'hourly' ? ' hourly' : ' ' + template.rateType}`,
    `£${template.rate}${template.rateType === 'hourly' ? '/hr' : '/' + template.rateType}`,
    `rate of £${template.rate}${template.rateType === 'hourly' ? ' per hour' : ' ' + template.rateType}`,
  ];
  
  const closings = [
    `Let me know if you're interested`,
    `Would this work for you?`,
    `Interested? Let me know`,
    `Drop me a message if you'd like to know more`,
    `Give me a shout if this sounds good`,
    `What do you think?`,
    `Let me know your thoughts`,
    `Sound good? Get back to me`,
    `Reply if you'd like more info`,
    `Message me if you're keen`,
    `Thoughts?`,
    `Interested in hearing more?`,
  ];

  // Use prime numbers for better distribution
  const g = index % greetings.length;
  const i = (index * 7) % intros.length;
  const p = (index * 11) % packageDesc.length;
  const l = (index * 13) % locationPhrases.length;
  const r = (index * 17) % ratePhrases.length;
  const c = (index * 19) % closings.length;

  // Different structures
  const structures = [
    () => `${greetings[g]}! ${intros[i]}. ${packageDesc[p]} ${locationPhrases[l]}, ${ratePhrases[r]}. ${template.additionalInfo ? template.additionalInfo + '. ' : ''}${closings[c]}!`,
    () => `${greetings[g]}, ${intros[i].toLowerCase()}. ${packageDesc[p]} ${locationPhrases[l]}. ${ratePhrases[r].charAt(0).toUpperCase() + ratePhrases[r].slice(1)}. ${template.additionalInfo ? template.additionalInfo + ' ' : ''}${closings[c]}`,
    () => `${greetings[g]}. ${intros[i]} - ${packageDesc[p].toLowerCase()} ${locationPhrases[l]}, ${ratePhrases[r]}. ${template.additionalInfo || ''} ${closings[c]}!`.replace('  ', ' '),
    () => `${greetings[g]}! ${packageDesc[p].charAt(0).toUpperCase() + packageDesc[p].slice(1)} ${locationPhrases[l]}. ${ratePhrases[r].charAt(0).toUpperCase() + ratePhrases[r].slice(1)}. ${template.additionalInfo ? template.additionalInfo + '. ' : ''}${closings[c]}`,
    () => `${greetings[g]}, ${intros[i].toLowerCase()} ${locationPhrases[l]}. ${packageDesc[p].charAt(0).toUpperCase() + packageDesc[p].slice(1)}, ${ratePhrases[r]}. ${closings[c]}! ${template.additionalInfo || ''}`.trim(),
    () => `${greetings[g]}! ${intros[i]}. ${locationPhrases[l].charAt(0).toUpperCase() + locationPhrases[l].slice(1)} - ${packageDesc[p].toLowerCase()}, ${ratePhrases[r]}. ${closings[c]}`,
  ];

  const structureIndex = (index * 23) % structures.length;
  return structures[structureIndex]();
};

// ============ MAIN COMPONENT ============
interface Props {
  candidates: any[];
}

export default function WhatsAppCampaign({ candidates }: Props) {
  // Connection state
  const [wsState, setWsState] = useState<WhatsAppState>({
    status: 'disconnected',
    qrCode: null,
    clientInfo: null,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Navigation
  const [activeView, setActiveView] = useState<'dashboard' | 'create' | 'campaigns' | 'queue' | 'templates' | 'logs'>('dashboard');

  // Campaign data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
  
  // ALL candidates (including imported)
  const [allCandidates, setAllCandidates] = useState<any[]>([]);
  const [candidateSource, setCandidateSource] = useState<'all' | 'called' | 'imported'>('all');

  // Load ALL candidates from database (both called and imported)
  useEffect(() => {
    const loadAllCandidates = async () => {
      try {
        const { createBrowserClient } = await import('@supabase/ssr');
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data } = await supabase
          .from('candidates')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (data) {
          setAllCandidates(data);
        }
      } catch (e) {
        console.error('Failed to load candidates:', e);
        // Fallback to passed candidates
        setAllCandidates(candidates);
      }
    };
    loadAllCandidates();
  }, [candidates]);

  // Check for pre-selected candidates from Imported Pool
  useEffect(() => {
    const preSelected = (window as any).__importedCampaignCandidates;
    if (preSelected && Array.isArray(preSelected) && preSelected.length > 0) {
      // Pre-select these candidates and go to create view
      setSelectedCandidates(new Set(preSelected.map((c: any) => c.id)));
      setCandidateSource('imported');
      setActiveView('create');
      // Clear the global reference
      delete (window as any).__importedCampaignCandidates;
    }
  }, []);

  // Load saved data from localStorage on mount
  useEffect(() => {
    try {
      const savedCampaigns = localStorage.getItem('whatsapp_campaigns');
      const savedTemplates = localStorage.getItem('whatsapp_templates');
      const savedLogs = localStorage.getItem('whatsapp_logs');
      
      if (savedCampaigns) setCampaigns(JSON.parse(savedCampaigns));
      if (savedTemplates) setTemplates(JSON.parse(savedTemplates));
      if (savedLogs) setMessageLogs(JSON.parse(savedLogs));
    } catch (e) {
      console.error('Failed to load saved data:', e);
    }
  }, []);

  // Save campaigns to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('whatsapp_campaigns', JSON.stringify(campaigns));
    } catch (e) {
      console.error('Failed to save campaigns:', e);
    }
  }, [campaigns]);

  // Save templates to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('whatsapp_templates', JSON.stringify(templates));
    } catch (e) {
      console.error('Failed to save templates:', e);
    }
  }, [templates]);

  // Save message logs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('whatsapp_logs', JSON.stringify(messageLogs));
    } catch (e) {
      console.error('Failed to save logs:', e);
    }
  }, [messageLogs]);

  // Create campaign form
  const [campaignName, setCampaignName] = useState('');
  const [newTemplate, setNewTemplate] = useState<Partial<MessageTemplate>>({
    packageType: '',
    location: '',
    rate: '',
    rateType: 'hourly',
    additionalInfo: '',
  });
  const [intervalMin, setIntervalMin] = useState(30);
  const [intervalMax, setIntervalMax] = useState(60);
  const [skipNoPhone, setSkipNoPhone] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(200);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState('all');

  // Running state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Stats
  const totalSent = messageLogs.length;
  const totalCampaigns = campaigns.length;

  // ============ WEBSOCKET MESSAGE HANDLER (must be defined first) ============
  const handleWsMessage = useCallback((data: any) => {
    console.log('WS received:', data.type, data.status || '');
    
    switch (data.type) {
      case 'init':
      case 'status_update':
      case 'state_update':
        const statusMap: Record<string, string> = {
          'not_started': 'disconnected',
          'not_initialized': 'disconnected',
          'initializing': 'connecting',
          'loading': 'connecting',
          'qr_ready': 'qr',
          'authenticated': 'connecting',
          'ready': 'connected',
          'disconnected': 'disconnected',
          'error': 'disconnected'
        };
        const mappedStatus = statusMap[data.status] || data.status;
        setWsState({
          status: mappedStatus,
          qrCode: data.qrCode || null,
          clientInfo: data.clientInfo || null,
        });
        setIsPaused(data.isPaused || false);
        setServiceError(null);
        break;
        
      case 'qr_code':
        setWsState(prev => ({ ...prev, status: 'qr', qrCode: data.qr }));
        break;
        
      case 'status':
        const sMap: Record<string, string> = {
          'not_started': 'disconnected',
          'initializing': 'connecting',
          'loading': 'connecting',
          'qr_ready': 'qr',
          'authenticated': 'connecting',
          'ready': 'connected',
          'disconnected': 'disconnected',
          'auth_failed': 'disconnected'
        };
        const newStatus = sMap[data.status] || data.status;
        setWsState(prev => ({ 
          ...prev, 
          status: newStatus,
          qrCode: data.status === 'qr_ready' ? prev.qrCode : (newStatus === 'connected' ? null : prev.qrCode)
        }));
        if (data.error) setServiceError(data.error);
        break;
        
      case 'ready':
        setWsState({ 
          status: 'connected', 
          qrCode: null,
          clientInfo: data.clientInfo 
        });
        setServiceError(null);
        break;
        
      case 'message_sending':
        // Handle in campaign
        break;
        
      case 'message_sent':
        // Handle in campaign
        break;
        
      case 'message_failed':
        // Handle in campaign
        break;
        
      case 'queue_delay':
        setCountdown(Math.round(data.delay / 1000));
        break;
        
      case 'queue_complete':
        setIsRunning(false);
        setCountdown(0);
        break;
        
      case 'queue_paused':
        setIsPaused(true);
        break;
        
      case 'queue_resumed':
        setIsPaused(false);
        break;
        
      case 'queue_stopped':
        setIsRunning(false);
        setIsPaused(false);
        setCountdown(0);
        break;
        
      case 'error':
        setServiceError(data.error);
        break;
    }
  }, []);

  // ============ WEBSOCKET CONNECTION ============
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isConnectingRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    isConnectingRef.current = true;
    
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
      wsRef.current = null;
    }
    
    const wsUrl = 'ws://localhost:3001';
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        isConnectingRef.current = false;
        setServiceError(null);
        ws.send(JSON.stringify({ action: 'get-status' }));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWsMessage(data);
        } catch (e) {
          console.error('Parse error:', e);
        }
      };
      
      ws.onclose = () => {
        isConnectingRef.current = false;
        wsRef.current = null;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
      };
      
      ws.onerror = () => {
        isConnectingRef.current = false;
        setServiceError('Cannot connect to WhatsApp service. Run: node start-dev.js');
      };
      
      wsRef.current = ws;
    } catch (error) {
      isConnectingRef.current = false;
      setServiceError('Failed to connect');
    }
  }, [handleWsMessage]);

  // Send action via WebSocket
  const sendAction = useCallback((action: string, data?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  // Update candidate status in current campaign
  const updateCandidateStatus = (id: string, status: string, sentAt?: string, error?: string) => {
    setSelectedCampaign(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      const candidate = updated.candidates.find(c => c.id === id);
      if (candidate) {
        const oldStatus = candidate.status;
        candidate.status = status as any;
        if (sentAt) candidate.sentAt = sentAt;
        if (error) candidate.error = error;
        
        // Update stats
        if (oldStatus === 'pending' && status === 'sent') {
          updated.stats.sent++;
          updated.stats.pending--;
        } else if (oldStatus === 'pending' && status === 'failed') {
          updated.stats.failed++;
          updated.stats.pending--;
        } else if (status === 'delivered' && oldStatus !== 'delivered') {
          updated.stats.delivered++;
        } else if (status === 'read' && oldStatus !== 'read') {
          updated.stats.read++;
          if (oldStatus !== 'delivered') updated.stats.delivered++;
        }
      }
      return updated;
    });
    
    // Also update in campaigns list
    setCampaigns(prev => prev.map(c => {
      if (c.id !== selectedCampaign?.id) return c;
      const candidate = c.candidates.find(cand => cand.id === id);
      if (candidate) {
        candidate.status = status as any;
        if (sentAt) candidate.sentAt = sentAt;
        if (error) candidate.error = error;
      }
      return { ...c };
    }));
  };

  // Update by phone number (for ACK updates)
  const updateCandidateStatusByPhone = (phone: string, status: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    setSelectedCampaign(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      const candidate = updated.candidates.find(c => 
        c.phone.replace(/\D/g, '').includes(cleanPhone) || cleanPhone.includes(c.phone.replace(/\D/g, ''))
      );
      if (candidate && (status === 'delivered' || status === 'read')) {
        const oldStatus = candidate.status;
        candidate.status = status as any;
        
        if (status === 'delivered' && oldStatus !== 'delivered' && oldStatus !== 'read') {
          updated.stats.delivered++;
        } else if (status === 'read' && oldStatus !== 'read') {
          updated.stats.read++;
          if (oldStatus !== 'delivered') updated.stats.delivered++;
        }
      }
      return updated;
    });
  };

  // Add to message logs
  const addToLogs = (item: any, status: string, error?: string) => {
    setMessageLogs(prev => [{
      id: item.id,
      campaignId: selectedCampaign?.id || '',
      candidateName: item.name,
      phone: item.phone,
      message: item.message,
      status: status as any,
      sentAt: item.sentAt || new Date().toISOString(),
      error,
    }, ...prev]);
  };

  // Update log status
  const updateLogStatus = (phone: string, status: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    setMessageLogs(prev => prev.map(log => {
      if (log.phone.replace(/\D/g, '').includes(cleanPhone) || cleanPhone.includes(log.phone.replace(/\D/g, ''))) {
        return { ...log, status: status as any };
      }
      return log;
    }));
  };

  // Mark campaign complete
  const completeCurrentCampaign = () => {
    if (!selectedCampaign) return;
    
    const allDone = selectedCampaign.candidates.every(c => 
      c.status === 'sent' || c.status === 'delivered' || c.status === 'read' || c.status === 'failed'
    );
    
    if (allDone) {
      setSelectedCampaign(prev => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString() } : null);
      setCampaigns(prev => prev.map(c => 
        c.id === selectedCampaign.id ? { ...c, status: 'completed', completedAt: new Date().toISOString() } : c
      ));
    }
  };

  // Connect on mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // ============ CAMPAIGN ACTIONS ============
  const createCampaign = () => {
    if (!campaignName.trim()) return alert('Please enter a campaign name');
    if (!newTemplate.packageType || !newTemplate.location || !newTemplate.rate) {
      return alert('Please fill in the template details');
    }
    if (selectedCandidates.size === 0) return alert('Please select at least one candidate');

    const template: MessageTemplate = {
      id: Date.now().toString(),
      name: `${campaignName} Template`,
      packageType: newTemplate.packageType || '',
      location: newTemplate.location || '',
      rate: newTemplate.rate || '',
      rateType: newTemplate.rateType || 'hourly',
      additionalInfo: newTemplate.additionalInfo || '',
      createdAt: new Date().toISOString(),
    };

    setTemplates(prev => [...prev, template]);

    // Generate messages for each candidate
    const queuedMessages: QueuedMessage[] = [];
    let index = 0;
    
    // Use allCandidates (which includes imported) instead of just candidates prop
    const candidatePool = allCandidates.length > 0 ? allCandidates : candidates;
    
    selectedCandidates.forEach(candidateId => {
      const candidate = candidatePool.find(c => c.id === candidateId);
      if (candidate && candidate.phone_e164) {
        const firstName = candidate.name?.split(' ')[0] || 'there';
        queuedMessages.push({
          id: `${Date.now()}-${index}`,
          candidateId: candidate.id,
          name: candidate.name,
          phone: candidate.phone_e164,
          status: 'pending',
          message: generateMessageVariation(template, firstName, index),
        });
        index++;
      }
    });
    
    console.log('Creating campaign with', queuedMessages.length, 'messages from', selectedCandidates.size, 'selected candidates');

    const campaign: Campaign = {
      id: Date.now().toString(),
      name: campaignName,
      status: 'draft',
      template,
      candidates: queuedMessages,
      settings: { intervalMin, intervalMax, skipNoPhone, dailyLimit },
      stats: {
        total: queuedMessages.length,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        pending: queuedMessages.length,
      },
      createdAt: new Date().toISOString(),
    };

    setCampaigns(prev => [...prev, campaign]);
    setSelectedCampaign(campaign);
    setActiveView('queue');
    
    // Reset form
    setCampaignName('');
    setSelectedCandidates(new Set());
    setNewTemplate({ packageType: '', location: '', rate: '', rateType: 'hourly', additionalInfo: '' });
  };

  const startCampaign = async () => {
    if (!selectedCampaign) return;
    if (wsState.status !== 'connected') {
      return alert('Please connect WhatsApp first');
    }

    // Update campaign status
    const updated = { ...selectedCampaign, status: 'running' as const, startedAt: new Date().toISOString() };
    setSelectedCampaign(updated);
    setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
    setIsRunning(true);
    setIsPaused(false);

    // Send messages via API - include campaign info for logging
    const pendingMessages = updated.candidates.filter(c => c.status === 'pending');
    
    if (pendingMessages.length > 0) {
      await sendAction('send-bulk', {
        messages: pendingMessages.map(m => ({
          id: m.id,
          candidateId: m.candidateId, // For database logging
          phone: m.phone,
          name: m.name,
          message: m.message,
          campaignId: updated.id, // For database logging
          campaignName: updated.name, // For database logging
        })),
      });
    }
  };

  const pauseCampaign = async () => {
    await sendAction('pause');
    setSelectedCampaign(prev => prev ? { ...prev, status: 'paused' } : null);
    setCampaigns(prev => prev.map(c => c.id === selectedCampaign?.id ? { ...c, status: 'paused' } : c));
  };

  const resumeCampaign = async () => {
    await sendAction('resume');
    setSelectedCampaign(prev => prev ? { ...prev, status: 'running' } : null);
    setCampaigns(prev => prev.map(c => c.id === selectedCampaign?.id ? { ...c, status: 'running' } : c));
  };

  const stopCampaign = async () => {
    await sendAction('stop');
    setSelectedCampaign(prev => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString() } : null);
    setCampaigns(prev => prev.map(c => c.id === selectedCampaign?.id ? { ...c, status: 'completed' } : c));
    setIsRunning(false);
    setIsPaused(false);
  };

  // ============ FILTERED CANDIDATES ============
  const availableCandidates = (() => {
    let list = allCandidates.length > 0 ? allCandidates : candidates;
    
    // Filter by source
    if (candidateSource === 'called') {
      list = list.filter(c => c.is_called === true || c.last_called_at || c.transcript);
    } else if (candidateSource === 'imported') {
      list = list.filter(c => {
        if (c.is_called === true) return false;
        if (c.transcript && c.transcript.length > 0) return false;
        if (c.last_called_at) return false;
        return true;
      });
    }
    
    return list;
  })();

  const filteredCandidates = availableCandidates.filter(c => {
    if (skipNoPhone && !c.phone_e164) return false;
    if (candidateSearch) {
      const search = candidateSearch.toLowerCase();
      if (!c.name?.toLowerCase().includes(search) && !c.phone_e164?.includes(search)) return false;
    }
    if (candidateStatusFilter !== 'all' && c.status !== candidateStatusFilter) return false;
    return true;
  });

  // ============ HELPERS ============
  const fmtPhone = (p: string) => {
    if (!p) return '';
    if (p.startsWith('+44')) return `0${p.slice(3, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
    return p;
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'sending': return '📤';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '👁️';
      case 'failed': return '❌';
      default: return '•';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#6b7280';
      case 'sending': return '#f59e0b';
      case 'sent': return '#10b981';
      case 'delivered': return '#3b82f6';
      case 'read': return '#6366f1';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'create', icon: '➕', label: 'New Campaign' },
    { id: 'campaigns', icon: '📋', label: 'Campaigns', badge: campaigns.length },
    { id: 'templates', icon: '📄', label: 'Templates', badge: templates.length },
    { id: 'logs', icon: '📜', label: 'Message Logs', badge: messageLogs.length },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#f8fafc' }}>
      <style>{`
        .wa-sidebar{width:220px;background:#fff;border-right:1px solid #e5e7eb;display:flex;flex-direction:column}
        .wa-sidebar-header{padding:20px;border-bottom:1px solid #e5e7eb}
        .wa-sidebar-title{font-size:16px;font-weight:700;color:#111;display:flex;align-items:center;gap:10px}
        .wa-sidebar-title span{font-size:22px}
        .wa-account{margin-top:16px;padding:12px;background:#f9fafb;border-radius:10px}
        .wa-account-status{display:flex;align-items:center;gap:8px;font-size:12px;color:#6b7280}
        .wa-account-dot{width:8px;height:8px;border-radius:50%;animation:pulse 2s infinite}
        .wa-account-dot.connected{background:#10b981}
        .wa-account-dot.disconnected{background:#ef4444}
        .wa-account-dot.connecting{background:#f59e0b}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .wa-account-info{margin-top:8px;font-size:13px;font-weight:600;color:#111}
        .wa-account-phone{font-size:12px;color:#6b7280;margin-top:2px}
        .wa-nav{flex:1;padding:12px 0}
        .wa-nav-item{display:flex;align-items:center;gap:12px;padding:12px 20px;font-size:13px;color:#4b5563;cursor:pointer;transition:all .15s;margin:2px 8px;border-radius:8px}
        .wa-nav-item:hover{background:#f3f4f6;color:#111}
        .wa-nav-item.active{background:linear-gradient(135deg,#ecfdf5,#d1fae5);color:#059669;font-weight:600}
        .wa-nav-icon{font-size:16px}
        .wa-nav-badge{margin-left:auto;background:#e5e7eb;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
        .wa-nav-item.active .wa-nav-badge{background:#a7f3d0;color:#059669}
        .wa-main{flex:1;overflow-y:auto;padding:24px}
        .wa-header{margin-bottom:24px}
        .wa-header h1{font-size:24px;font-weight:700;color:#111;margin:0 0 4px}
        .wa-header p{font-size:14px;color:#6b7280;margin:0}
        .wa-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:20px}
        .wa-card-title{font-size:14px;font-weight:600;color:#111;margin-bottom:16px;display:flex;align-items:center;gap:8px}
        .wa-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        .wa-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center}
        .wa-stat-value{font-size:32px;font-weight:800;color:#111}
        .wa-stat-label{font-size:12px;color:#6b7280;margin-top:4px}
        .wa-qr-box{background:#f9fafb;border:2px dashed #d1d5db;border-radius:12px;padding:40px;text-align:center}
        .wa-connect-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:#25d366;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
        .wa-connect-btn:hover{background:#128c7e}
        .wa-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .wa-form-field{margin-bottom:16px}
        .wa-form-field.full{grid-column:span 2}
        .wa-form-label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:6px}
        .wa-form-input{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;transition:all .15s}
        .wa-form-input:focus{outline:none;border-color:#25d366;box-shadow:0 0 0 3px rgba(37,211,102,.1)}
        .wa-form-select{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;background:#fff}
        .wa-form-textarea{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;min-height:80px;resize:vertical;font-family:inherit}
        .wa-candidate-list{max-height:300px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:10px}
        .wa-candidate-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .15s}
        .wa-candidate-item:hover{background:#f9fafb}
        .wa-candidate-item:last-child{border-bottom:none}
        .wa-candidate-item.selected{background:#ecfdf5}
        .wa-candidate-check{width:20px;height:20px;border:2px solid #d1d5db;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;transition:all .15s}
        .wa-candidate-item.selected .wa-candidate-check{background:#10b981;border-color:#10b981}
        .wa-candidate-info{flex:1}
        .wa-candidate-name{font-size:14px;font-weight:500;color:#111}
        .wa-candidate-phone{font-size:12px;color:#6b7280}
        .wa-preview-box{background:#dcf8c6;border-radius:12px;padding:16px;margin-top:16px;position:relative}
        .wa-preview-text{font-size:14px;color:#111;line-height:1.6}
        .wa-preview-time{font-size:11px;color:#6b7280;text-align:right;margin-top:8px}
        .wa-btn{padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s;display:inline-flex;align-items:center;gap:8px}
        .wa-btn.primary{background:#25d366;color:#fff}
        .wa-btn.primary:hover{background:#128c7e}
        .wa-btn.secondary{background:#f3f4f6;color:#374151}
        .wa-btn.secondary:hover{background:#e5e7eb}
        .wa-btn.danger{background:#fef2f2;color:#dc2626}
        .wa-btn.danger:hover{background:#fee2e2}
        .wa-btn:disabled{opacity:.5;cursor:not-allowed}
        .wa-queue-item{display:flex;align-items:center;gap:16px;padding:16px;border-bottom:1px solid #f3f4f6;transition:background .2s}
        .wa-queue-item:last-child{border-bottom:none}
        .wa-queue-item.sending{background:linear-gradient(90deg,#ecfdf5,#d1fae5);animation:sending 1.5s ease-in-out infinite}
        @keyframes sending{0%,100%{opacity:1}50%{opacity:.7}}
        .wa-queue-num{width:32px;height:32px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#6b7280}
        .wa-queue-info{flex:1;min-width:0}
        .wa-queue-name{font-size:14px;font-weight:500;color:#111}
        .wa-queue-msg{font-size:12px;color:#6b7280;margin-top:4px;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .wa-queue-status{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;white-space:nowrap}
        .wa-running-banner{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #a7f3d0;border-radius:12px;padding:20px;margin-bottom:20px;display:flex;align-items:center;gap:20px}
        .wa-running-info{flex:1}
        .wa-running-title{font-size:16px;font-weight:700;color:#059669}
        .wa-running-stats{font-size:13px;color:#047857;margin-top:4px}
        .wa-running-progress{height:8px;background:#a7f3d0;border-radius:4px;overflow:hidden;margin-top:12px}
        .wa-running-bar{height:100%;background:#10b981;border-radius:4px;transition:width .3s}
        .wa-running-countdown{text-align:center}
        .wa-running-countdown-num{font-size:36px;font-weight:800;color:#059669}
        .wa-running-countdown-label{font-size:11px;color:#047857}
        .wa-running-actions{display:flex;gap:8px}
        .wa-campaign-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;transition:all .15s}
        .wa-campaign-card:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.04)}
        .wa-campaign-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .wa-campaign-name{font-size:15px;font-weight:600;color:#111}
        .wa-campaign-stats{display:flex;gap:16px;font-size:12px;color:#6b7280}
        .wa-campaign-progress{height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
        .wa-campaign-bar{height:100%;background:#10b981;border-radius:3px;transition:width .3s}
        .wa-error{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:20px;color:#dc2626;font-size:13px}
        .wa-error-title{font-weight:600;margin-bottom:4px}
        .wa-log-item{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #f3f4f6}
        .wa-log-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px}
        .wa-log-info{flex:1}
        .wa-log-name{font-size:13px;font-weight:500;color:#111}
        .wa-log-msg{font-size:12px;color:#6b7280;margin-top:2px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .wa-log-time{font-size:11px;color:#9ca3af}
        .wa-select-actions{display:flex;gap:8px;margin-bottom:12px}
        .wa-select-btn{padding:6px 12px;font-size:12px;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer}
        .wa-select-btn:hover{background:#e5e7eb}
      `}</style>

      {/* Sidebar */}
      <div className="wa-sidebar">
        <div className="wa-sidebar-header">
          <div className="wa-sidebar-title"><span>💬</span> WhatsApp</div>
          <div className="wa-account">
            <div className="wa-account-status">
              <div className={`wa-account-dot ${wsState.status === 'connected' ? 'connected' : wsState.status === 'connecting' || wsState.status === 'qr' ? 'connecting' : 'disconnected'}`} />
              {wsState.status === 'connected' ? 'Connected' : wsState.status === 'qr' ? 'Scan QR Code' : wsState.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </div>
            {wsState.clientInfo && (
              <>
                <div className="wa-account-info">{wsState.clientInfo.pushname}</div>
                <div className="wa-account-phone">+{wsState.clientInfo.phone}</div>
              </>
            )}
          </div>
        </div>

        <nav className="wa-nav">
          {navItems.map(item => (
            <div key={item.id} className={`wa-nav-item ${activeView === item.id ? 'active' : ''}`} onClick={() => setActiveView(item.id as any)}>
              <span className="wa-nav-icon">{item.icon}</span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && <span className="wa-nav-badge">{item.badge}</span>}
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="wa-main">
        {serviceError && (
          <div className="wa-error">
            <div className="wa-error-title">⚠️ Connection Error</div>
            {serviceError}
            <div style={{ marginTop: 8, fontSize: 12 }}>
              Run: <code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>node whatsapp-service.js</code>
            </div>
          </div>
        )}

        {/* Running Campaign Banner */}
        {isRunning && selectedCampaign && (
          <div className="wa-running-banner">
            <div className="wa-running-info">
              <div className="wa-running-title">🚀 {selectedCampaign.name}</div>
              <div className="wa-running-stats">
                ✓ {selectedCampaign.stats.sent} sent • ✓✓ {selectedCampaign.stats.delivered} delivered • ⏳ {selectedCampaign.stats.pending} pending • ❌ {selectedCampaign.stats.failed} failed
              </div>
              <div className="wa-running-progress">
                <div className="wa-running-bar" style={{ width: `${((selectedCampaign.stats.sent + selectedCampaign.stats.failed) / selectedCampaign.stats.total) * 100}%` }} />
              </div>
            </div>
            {countdown > 0 && (
              <div className="wa-running-countdown">
                <div className="wa-running-countdown-num">{countdown}s</div>
                <div className="wa-running-countdown-label">Next message</div>
              </div>
            )}
            <div className="wa-running-actions">
              {isPaused ? (
                <button className="wa-btn primary" onClick={resumeCampaign}>▶️ Resume</button>
              ) : (
                <button className="wa-btn secondary" onClick={pauseCampaign}>⏸️ Pause</button>
              )}
              <button className="wa-btn danger" onClick={stopCampaign}>⏹️ Stop</button>
            </div>
          </div>
        )}

        {/* ============ DASHBOARD ============ */}
        {activeView === 'dashboard' && (
          <>
            <div className="wa-header">
              <h1>Dashboard</h1>
              <p>WhatsApp campaign overview</p>
            </div>

            <div className="wa-stats">
              <div className="wa-stat">
                <div className="wa-stat-value">{totalSent}</div>
                <div className="wa-stat-label">Messages Sent</div>
              </div>
              <div className="wa-stat">
                <div className="wa-stat-value">{totalCampaigns}</div>
                <div className="wa-stat-label">Campaigns</div>
              </div>
              <div className="wa-stat">
                <div className="wa-stat-value">{campaigns.filter(c => c.status === 'running').length}</div>
                <div className="wa-stat-label">Active</div>
              </div>
              <div className="wa-stat">
                <div className="wa-stat-value">{messageLogs.filter(l => l.status === 'delivered' || l.status === 'read').length}</div>
                <div className="wa-stat-label">Delivered</div>
              </div>
            </div>

            <div className="wa-card">
              <div className="wa-card-title">📱 WhatsApp Connection</div>
              
              {serviceError && (
                <div className="wa-error">
                  <div className="wa-error-title">⚠️ Connection Error</div>
                  <div>{serviceError}</div>
                  <div style={{ marginTop: 12, padding: 12, background: '#fff', borderRadius: 6, fontSize: 11 }}>
                    <strong>To fix this:</strong>
                    <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                      <li>Open a terminal in your project folder</li>
                      <li>Run: <code style={{ background: '#fee2e2', padding: '2px 6px', borderRadius: 4 }}>node whatsapp-service.js</code></li>
                      <li>Wait for "WhatsApp service ready" message</li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                </div>
              )}
              
              {wsState.status === 'disconnected' && !serviceError && (
                <div className="wa-qr-box">
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📱</div>
                  <p style={{ color: '#6b7280', marginBottom: 16 }}>Connecting to WhatsApp service...</p>
                  <div style={{ marginTop: 16 }}>
                    <div style={{ width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: '#25d366', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
                    If this takes too long, make sure the WhatsApp service is running:<br/>
                    <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>node whatsapp-service.js</code>
                  </p>
                </div>
              )}

              {wsState.status === 'qr' && wsState.qrCode && (
                <div className="wa-qr-box" style={{ background: '#fff', border: '2px solid #25d366' }}>
                  <div style={{ marginBottom: 16, color: '#25d366', fontWeight: 600 }}>📱 Scan QR Code with WhatsApp</div>
                  <div style={{ width: 220, height: 220, margin: '0 auto 16px', background: '#fff', borderRadius: 12, padding: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(wsState.qrCode)}`} 
                      alt="WhatsApp QR Code" 
                      style={{ width: 200, height: 200, display: 'block' }} 
                    />
                  </div>
                  <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, marginTop: 12 }}>
                    <p style={{ color: '#166534', fontSize: 13, fontWeight: 500, margin: 0 }}>How to scan:</p>
                    <ol style={{ color: '#166534', fontSize: 12, margin: '8px 0 0', paddingLeft: 20 }}>
                      <li>Open WhatsApp on your phone</li>
                      <li>Tap Menu (⋮) or Settings</li>
                      <li>Tap Linked Devices</li>
                      <li>Tap "Link a Device"</li>
                      <li>Point your phone at this QR code</li>
                    </ol>
                  </div>
                </div>
              )}

              {wsState.status === 'connecting' && (
                <div className="wa-qr-box">
                  <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
                  <p style={{ color: '#6b7280', fontWeight: 600 }}>Connecting to WhatsApp...</p>
                  <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>This may take a few seconds</p>
                  <div style={{ marginTop: 16 }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#25d366', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                  </div>
                </div>
              )}

              {wsState.status === 'connected' && wsState.clientInfo && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ width: 80, height: 80, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <span style={{ fontSize: 40 }}>✅</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111', marginBottom: 4 }}>{wsState.clientInfo.pushname}</div>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>+{wsState.clientInfo.phone}</div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button className="wa-btn primary" onClick={() => setActiveView('create')}>➕ Create Campaign</button>
                    <button className="wa-btn secondary" onClick={() => sendAction('logout')}>🚪 Logout</button>
                  </div>
                </div>
              )}
              
              {wsState.status === 'connected' && !wsState.clientInfo && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <div style={{ width: 80, height: 80, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <span style={{ fontSize: 40 }}>✅</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#059669', marginBottom: 4 }}>WhatsApp Connected!</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Loading account info...</div>
                  <button className="wa-btn primary" onClick={() => setActiveView('create')}>➕ Create Campaign</button>
                </div>
              )}
            </div>

            {campaigns.length > 0 && (
              <div className="wa-card">
                <div className="wa-card-title">📋 Recent Campaigns</div>
                {campaigns.slice(0, 3).map(campaign => (
                  <div key={campaign.id} className="wa-campaign-card" onClick={() => { setSelectedCampaign(campaign); setActiveView('queue'); }}>
                    <div className="wa-campaign-header">
                      <span className="wa-campaign-name">{campaign.name}</span>
                      <Badge variant={campaign.status === 'completed' ? 'success' : campaign.status === 'running' ? 'info' : 'default'} size="sm">{campaign.status}</Badge>
                    </div>
                    <div className="wa-campaign-stats">
                      <span>📤 {campaign.stats.sent} sent</span>
                      <span>✓✓ {campaign.stats.delivered} delivered</span>
                      <span>⏳ {campaign.stats.pending} pending</span>
                    </div>
                    <div className="wa-campaign-progress">
                      <div className="wa-campaign-bar" style={{ width: `${((campaign.stats.sent + campaign.stats.failed) / campaign.stats.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ============ CREATE CAMPAIGN ============ */}
        {activeView === 'create' && (
          <>
            <div className="wa-header">
              <h1>Create Campaign</h1>
              <p>Set up a new WhatsApp outreach campaign</p>
            </div>

            <div className="wa-card">
              <div className="wa-card-title">📝 Campaign Details</div>
              <div className="wa-form-field">
                <label className="wa-form-label">Campaign Name</label>
                <input className="wa-form-input" placeholder="e.g., January Care Worker Outreach" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
              </div>
            </div>

            <div className="wa-card">
              <div className="wa-card-title">💬 Message Template</div>
              <div className="wa-form-grid">
                <div className="wa-form-field">
                  <label className="wa-form-label">Package Type</label>
                  <input className="wa-form-input" placeholder="e.g., Live-in Care, Hourly Care" value={newTemplate.packageType} onChange={e => setNewTemplate({...newTemplate, packageType: e.target.value})} />
                </div>
                <div className="wa-form-field">
                  <label className="wa-form-label">Location</label>
                  <input className="wa-form-input" placeholder="e.g., London, Manchester" value={newTemplate.location} onChange={e => setNewTemplate({...newTemplate, location: e.target.value})} />
                </div>
                <div className="wa-form-field">
                  <label className="wa-form-label">Rate (£)</label>
                  <input className="wa-form-input" placeholder="e.g., 12.50" value={newTemplate.rate} onChange={e => setNewTemplate({...newTemplate, rate: e.target.value})} />
                </div>
                <div className="wa-form-field">
                  <label className="wa-form-label">Rate Type</label>
                  <select className="wa-form-select" value={newTemplate.rateType} onChange={e => setNewTemplate({...newTemplate, rateType: e.target.value})}>
                    <option value="hourly">Per Hour</option>
                    <option value="daily">Per Day</option>
                    <option value="weekly">Per Week</option>
                  </select>
                </div>
                <div className="wa-form-field full">
                  <label className="wa-form-label">Additional Info (optional)</label>
                  <textarea className="wa-form-textarea" placeholder="Any extra details..." value={newTemplate.additionalInfo} onChange={e => setNewTemplate({...newTemplate, additionalInfo: e.target.value})} />
                </div>
              </div>

              {newTemplate.packageType && newTemplate.location && newTemplate.rate && (
                <div style={{ marginTop: 20 }}>
                  <div className="wa-form-label">Message Preview (AI varies each message)</div>
                  <div className="wa-preview-box">
                    <div className="wa-preview-text">{generateMessageVariation(newTemplate as MessageTemplate, 'Sarah', 0)}</div>
                    <div className="wa-preview-time">Just now ✓✓</div>
                  </div>
                  <div className="wa-preview-box" style={{ background: '#e8f5e9', marginTop: 8 }}>
                    <div className="wa-preview-text">{generateMessageVariation(newTemplate as MessageTemplate, 'John', 7)}</div>
                    <div className="wa-preview-time">Just now ✓✓</div>
                  </div>
                </div>
              )}
            </div>

            <div className="wa-card">
              <div className="wa-card-title">⚙️ Campaign Settings</div>
              <div className="wa-form-grid">
                <div className="wa-form-field">
                  <label className="wa-form-label">Min Interval (seconds)</label>
                  <input type="number" className="wa-form-input" value={intervalMin} onChange={e => setIntervalMin(parseInt(e.target.value) || 30)} />
                </div>
                <div className="wa-form-field">
                  <label className="wa-form-label">Max Interval (seconds)</label>
                  <input type="number" className="wa-form-input" value={intervalMax} onChange={e => setIntervalMax(parseInt(e.target.value) || 60)} />
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>⚠️ Recommended: 30-60 seconds between messages to avoid WhatsApp detection</p>
            </div>

            <div className="wa-card">
              <div className="wa-card-title">👥 Select Candidates {selectedCandidates.size > 0 && <Badge variant="success" size="sm">{selectedCandidates.size} selected</Badge>}</div>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <select className="wa-form-select" value={candidateSource} onChange={e => setCandidateSource(e.target.value as any)} style={{ width: 180 }}>
                  <option value="all">📋 All Candidates ({allCandidates.length})</option>
                  <option value="imported">📥 Imported Pool ({allCandidates.filter(c => !c.is_called && !c.last_called_at && !c.transcript).length})</option>
                  <option value="called">📞 Called Only ({allCandidates.filter(c => c.is_called || c.last_called_at || c.transcript).length})</option>
                </select>
                <input className="wa-form-input" placeholder="Search by name or phone..." value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
                <select className="wa-form-select" value={candidateStatusFilter} onChange={e => setCandidateStatusFilter(e.target.value)} style={{ width: 150 }}>
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="imported">Imported</option>
                  <option value="screening">Screening</option>
                  <option value="interview">Interview</option>
                </select>
              </div>

              {candidateSource === 'imported' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
                  📥 Showing imported candidates who haven't been called yet. Select candidates to include in your WhatsApp campaign.
                </div>
              )}

              <div className="wa-select-actions">
                <button className="wa-select-btn" onClick={() => setSelectedCandidates(new Set(filteredCandidates.map(c => c.id)))}>Select All ({filteredCandidates.length})</button>
                <button className="wa-select-btn" onClick={() => setSelectedCandidates(new Set())}>Clear Selection</button>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
                  Showing {Math.min(200, filteredCandidates.length)} of {filteredCandidates.length} candidates
                </span>
              </div>

              <div className="wa-candidate-list">
                {filteredCandidates.slice(0, 200).map(c => (
                  <div key={c.id} className={`wa-candidate-item ${selectedCandidates.has(c.id) ? 'selected' : ''}`} onClick={() => {
                    const newSelected = new Set(selectedCandidates);
                    newSelected.has(c.id) ? newSelected.delete(c.id) : newSelected.add(c.id);
                    setSelectedCandidates(newSelected);
                  }}>
                    <div className="wa-candidate-check">{selectedCandidates.has(c.id) && '✓'}</div>
                    <Avatar name={c.name} size="sm" />
                    <div className="wa-candidate-info">
                      <div className="wa-candidate-name">{c.name}</div>
                      <div className="wa-candidate-phone">{fmtPhone(c.phone_e164) || 'No phone'}</div>
                    </div>
                    <StatusBadge status={c.status} size="sm" />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="wa-btn secondary" onClick={() => setActiveView('dashboard')}>Cancel</button>
              <button className="wa-btn primary" onClick={createCampaign} disabled={!campaignName || !newTemplate.packageType || !newTemplate.location || !newTemplate.rate || selectedCandidates.size === 0}>
                Create Campaign ({selectedCandidates.size} recipients)
              </button>
            </div>
          </>
        )}

        {/* ============ CAMPAIGNS LIST ============ */}
        {activeView === 'campaigns' && (
          <>
            <div className="wa-header">
              <h1>Campaigns</h1>
              <p>Manage your WhatsApp campaigns</p>
            </div>

            {campaigns.length === 0 ? (
              <div className="wa-card" style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <p style={{ color: '#6b7280' }}>No campaigns yet</p>
                <button className="wa-btn primary" style={{ marginTop: 16 }} onClick={() => setActiveView('create')}>Create Your First Campaign</button>
              </div>
            ) : (
              campaigns.map(campaign => (
                <div key={campaign.id} className="wa-campaign-card" onClick={() => { setSelectedCampaign(campaign); setActiveView('queue'); }}>
                  <div className="wa-campaign-header">
                    <span className="wa-campaign-name">{campaign.name}</span>
                    <Badge variant={campaign.status === 'completed' ? 'success' : campaign.status === 'running' ? 'info' : campaign.status === 'paused' ? 'warning' : 'default'}>{campaign.status}</Badge>
                  </div>
                  <div className="wa-campaign-stats">
                    <span>👥 {campaign.stats.total} total</span>
                    <span>✓ {campaign.stats.sent} sent</span>
                    <span>✓✓ {campaign.stats.delivered} delivered</span>
                    {campaign.stats.failed > 0 && <span>❌ {campaign.stats.failed} failed</span>}
                  </div>
                  <div className="wa-campaign-progress" style={{ marginTop: 12 }}>
                    <div className="wa-campaign-bar" style={{ width: `${((campaign.stats.sent + campaign.stats.failed) / campaign.stats.total) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ============ QUEUE VIEW ============ */}
        {activeView === 'queue' && selectedCampaign && (
          <>
            <div className="wa-header">
              <h1>{selectedCampaign.name}</h1>
              <p>Message queue and delivery status</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button className="wa-btn secondary" onClick={() => setActiveView('campaigns')}>← Back</button>
              {selectedCampaign.status === 'draft' && (
                <button className="wa-btn primary" onClick={startCampaign} disabled={wsState.status !== 'connected'}>▶️ Start Campaign</button>
              )}
              {selectedCampaign.status === 'paused' && (
                <button className="wa-btn primary" onClick={resumeCampaign} disabled={wsState.status !== 'connected'}>▶️ Resume</button>
              )}
            </div>

            <div className="wa-stats" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="wa-stat"><div className="wa-stat-value">{selectedCampaign.stats.total}</div><div className="wa-stat-label">Total</div></div>
              <div className="wa-stat"><div className="wa-stat-value" style={{ color: '#10b981' }}>{selectedCampaign.stats.sent}</div><div className="wa-stat-label">Sent</div></div>
              <div className="wa-stat"><div className="wa-stat-value" style={{ color: '#3b82f6' }}>{selectedCampaign.stats.delivered}</div><div className="wa-stat-label">Delivered</div></div>
              <div className="wa-stat"><div className="wa-stat-value" style={{ color: '#f59e0b' }}>{selectedCampaign.stats.pending}</div><div className="wa-stat-label">Pending</div></div>
              <div className="wa-stat"><div className="wa-stat-value" style={{ color: '#ef4444' }}>{selectedCampaign.stats.failed}</div><div className="wa-stat-label">Failed</div></div>
            </div>

            <div className="wa-card" style={{ padding: 0 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>📤 Message Queue</div>
              {selectedCampaign.candidates.map((item, index) => (
                <div key={item.id} className={`wa-queue-item ${item.status === 'sending' ? 'sending' : ''}`}>
                  <div className="wa-queue-num">{index + 1}</div>
                  <Avatar name={item.name} size="sm" />
                  <div className="wa-queue-info">
                    <div className="wa-queue-name">{item.name} • {fmtPhone(item.phone)}</div>
                    <div className="wa-queue-msg">{item.message}</div>
                  </div>
                  <div className="wa-queue-status" style={{ color: getStatusColor(item.status) }}>
                    {getStatusIcon(item.status)} {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    {item.error && <span style={{ color: '#ef4444', fontSize: 11 }}> - {item.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ============ TEMPLATES ============ */}
        {activeView === 'templates' && (
          <>
            <div className="wa-header"><h1>Templates</h1><p>Saved message templates</p></div>
            {templates.length === 0 ? (
              <div className="wa-card" style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                <p style={{ color: '#6b7280' }}>No templates saved yet</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {templates.map(t => (
                  <div key={t.id} className="wa-card">
                    <div className="wa-card-title">{t.name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      <div>📦 {t.packageType}</div>
                      <div>📍 {t.location}</div>
                      <div>💰 £{t.rate}/{t.rateType}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ============ MESSAGE LOGS ============ */}
        {activeView === 'logs' && (
          <>
            <div className="wa-header"><h1>Message Logs</h1><p>History of all sent messages</p></div>
            {messageLogs.length === 0 ? (
              <div className="wa-card" style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
                <p style={{ color: '#6b7280' }}>No messages sent yet</p>
              </div>
            ) : (
              <div className="wa-card" style={{ padding: 0 }}>
                {messageLogs.map(log => (
                  <div key={log.id} className="wa-log-item">
                    <div className="wa-log-icon" style={{ background: log.status === 'read' ? '#e0e7ff' : log.status === 'delivered' ? '#dbeafe' : log.status === 'sent' ? '#ecfdf5' : '#fef2f2', color: getStatusColor(log.status) }}>
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="wa-log-info">
                      <div className="wa-log-name">{log.candidateName} • {fmtPhone(log.phone)}</div>
                      <div className="wa-log-msg">{log.message}</div>
                    </div>
                    <div className="wa-log-time">{fmtDate(log.sentAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
