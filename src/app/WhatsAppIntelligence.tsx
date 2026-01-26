'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WhatsAppMessage {
  timestamp: Date;
  sender: 'me' | 'them';
  text: string;
  isMedia?: boolean;
  mediaType?: string;
}

interface ParsedConversation {
  phone: string;
  contactName: string;
  messages: WhatsAppMessage[];
  firstMessage: Date;
  lastMessage: Date;
  messageCount: number;
}

interface CandidateIntelligence {
  id?: string;
  candidate_id?: string;
  phone_e164: string;
  name: string;
  
  // Extracted information
  availability?: string[];
  preferred_days?: string[];
  preferred_shifts?: string[];
  skills?: string[];
  qualifications?: string[];
  experience_years?: number;
  experience_details?: string;
  location_preferences?: string[];
  travel_distance?: string;
  rate_expectations?: string;
  transport?: string;
  dbs_status?: string;
  
  // Personality/work style
  communication_style?: string;
  reliability_score?: number;
  red_flags?: string[];
  positive_signals?: string[];
  
  // Summary
  ai_summary?: string;
  last_analyzed?: string;
  conversation_count?: number;
  
  // Raw data
  raw_conversations?: any;
  created_at?: string;
  updated_at?: string;
}

interface Candidate {
  id: string;
  name: string | null;
  phone_e164: string;
  roles?: string;
  status?: string;
}

export default function WhatsAppIntelligence() {
  const [activeTab, setActiveTab] = useState<'import' | 'intelligence' | 'search'>('import');
  
  // Import state
  const [importText, setImportText] = useState('');
  const [parsedConversations, setParsedConversations] = useState<ParsedConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ParsedConversation | null>(null);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0 });
  
  // Intelligence state
  const [intelligence, setIntelligence] = useState<CandidateIntelligence[]>([]);
  const [selectedIntel, setSelectedIntel] = useState<CandidateIntelligence | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CandidateIntelligence[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchSuggestions] = useState([
    'HCAs available weekends',
    'Nurses with dementia experience',
    'Drivers available immediately',
    'Night shift workers near London',
    'Experienced carers with good reliability',
    'Anyone available tomorrow'
  ]);
  
  // Candidates for matching
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    loadIntelligence();
    loadCandidates();
  }, []);

  async function loadIntelligence() {
    setLoadingIntel(true);
    const { data } = await supabase
      .from('candidate_intelligence')
      .select('*')
      .order('updated_at', { ascending: false });
    if (data) setIntelligence(data);
    setLoadingIntel(false);
  }

  async function loadCandidates() {
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, roles, status')
      .not('phone_e164', 'is', null);
    if (data) setCandidates(data);
  }

  // Parse WhatsApp export format
  // Format: [DD/MM/YYYY, HH:MM:SS] Contact Name: Message text
  // Or: DD/MM/YYYY, HH:MM - Contact Name: Message text
  const parseWhatsAppExport = (text: string): ParsedConversation[] => {
    const lines = text.split('\n');
    const conversations = new Map<string, ParsedConversation>();
    
    // Detect format patterns
    const patterns = [
      // iOS format: [DD/MM/YYYY, HH:MM:SS] Name: Message
      /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s+([^:]+):\s*(.*)$/,
      // Android format: DD/MM/YYYY, HH:MM - Name: Message
      /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[-–]\s*([^:]+):\s*(.*)$/,
      // Alternative: MM/DD/YY, HH:MM - Name: Message
      /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[-–]\s*([^:]+):\s*(.*)$/i,
    ];
    
    let currentConvo: { name: string; messages: WhatsAppMessage[] } | null = null;
    const myNames = new Set(['You', 'Me', '~You', '~Me']); // Names that indicate sender is "me"
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      let matched = false;
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          matched = true;
          const [, dateStr, timeStr, sender, text] = match;
          
          // Determine if sender is me or them
          const senderTrimmed = sender.trim();
          const isMe = myNames.has(senderTrimmed) || (sender.includes('~') && !sender.includes(':'));
          
          // Parse date
          let timestamp: Date;
          try {
            const [d, m, y] = dateStr.split('/').map(Number);
            const year = y < 100 ? 2000 + y : y;
            const [hour, minute] = timeStr.replace(/\s*[AP]M/i, '').split(':').map(Number);
            const isPM = /PM/i.test(timeStr);
            timestamp = new Date(year, m - 1, d, isPM && hour !== 12 ? hour + 12 : hour, minute || 0);
          } catch {
            timestamp = new Date();
          }
          
          // Determine contact name - if it's me, use existing convo name, otherwise use sender
          let contactName: string;
          if (isMe) {
            contactName = currentConvo?.name || 'Unknown';
          } else {
            contactName = senderTrimmed;
          }
          
          if (!currentConvo || (currentConvo.name !== contactName && !isMe)) {
            currentConvo = { name: contactName, messages: [] };
          }
          
          // Check if media
          const isMedia = text.includes('<Media omitted>') || 
                          text.includes('image omitted') || 
                          text.includes('video omitted') ||
                          text.includes('audio omitted') ||
                          text.includes('.jpg') ||
                          text.includes('.pdf');
          
          const message: WhatsAppMessage = {
            timestamp,
            sender: isMe ? 'me' : 'them',
            text: text.trim(),
            isMedia,
            mediaType: isMedia ? (text.includes('image') ? 'image' : text.includes('video') ? 'video' : 'document') : undefined
          };
          
          // Add to or create conversation
          const key = contactName.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!conversations.has(key)) {
            conversations.set(key, {
              phone: '',
              contactName,
              messages: [],
              firstMessage: timestamp,
              lastMessage: timestamp,
              messageCount: 0
            });
          }
          
          const convo = conversations.get(key)!;
          convo.messages.push(message);
          convo.messageCount++;
          if (timestamp < convo.firstMessage) convo.firstMessage = timestamp;
          if (timestamp > convo.lastMessage) convo.lastMessage = timestamp;
          
          break;
        }
      }
      
      // If no pattern matched, it might be a continuation of the previous message
      if (!matched && currentConvo && currentConvo.messages.length > 0) {
        const lastMsg = currentConvo.messages[currentConvo.messages.length - 1];
        lastMsg.text += '\n' + line.trim();
      }
    }
    
    return Array.from(conversations.values())
      .filter(c => c.messageCount > 0)
      .sort((a, b) => b.lastMessage.getTime() - a.lastMessage.getTime());
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const text = await file.text();
      setImportText(text);
      const parsed = parseWhatsAppExport(text);
      setParsedConversations(parsed);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing file. Make sure it\'s a WhatsApp export (.txt)');
    }
    setImporting(false);
  };

  // Handle paste
  const handlePaste = () => {
    const parsed = parseWhatsAppExport(importText);
    setParsedConversations(parsed);
  };

  // Match conversation to candidate
  const findMatchingCandidate = (convo: ParsedConversation): Candidate | null => {
    // Try to match by phone in contact name
    const phoneMatch = convo.contactName.match(/\+?\d{10,}/);
    if (phoneMatch) {
      let phone = phoneMatch[0];
      if (!phone.startsWith('+')) phone = '+' + phone;
      return candidates.find(c => c.phone_e164 === phone) || null;
    }
    
    // Try to match by name
    const name = convo.contactName.toLowerCase();
    return candidates.find(c => c.name?.toLowerCase().includes(name) || name.includes(c.name?.toLowerCase() || '')) || null;
  };

  // Analyze conversation with AI
  const analyzeConversation = async (convo: ParsedConversation): Promise<CandidateIntelligence> => {
    // Prepare conversation text for analysis
    const conversationText = convo.messages
      .map(m => `${m.sender === 'me' ? 'Recruiter' : convo.contactName}: ${m.text}`)
      .join('\n');
    
    // Call AI analysis endpoint
    try {
      const response = await fetch('/api/analyze-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationText,
          contactName: convo.contactName,
          messageCount: convo.messageCount,
          dateRange: {
            from: convo.firstMessage.toISOString(),
            to: convo.lastMessage.toISOString()
          }
        })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      
      const analysis = await response.json();
      
      return {
        phone_e164: '',
        name: convo.contactName,
        availability: analysis.availability || [],
        preferred_days: analysis.preferred_days || [],
        preferred_shifts: analysis.preferred_shifts || [],
        skills: analysis.skills || [],
        qualifications: analysis.qualifications || [],
        experience_years: analysis.experience_years,
        experience_details: analysis.experience_details,
        location_preferences: analysis.location_preferences || [],
        travel_distance: analysis.travel_distance,
        rate_expectations: analysis.rate_expectations,
        transport: analysis.transport,
        dbs_status: analysis.dbs_status,
        communication_style: analysis.communication_style,
        reliability_score: analysis.reliability_score,
        red_flags: analysis.red_flags || [],
        positive_signals: analysis.positive_signals || [],
        ai_summary: analysis.summary,
        last_analyzed: new Date().toISOString(),
        conversation_count: convo.messageCount,
        raw_conversations: conversationText
      };
    } catch (error) {
      console.error('Analysis error:', error);
      // Return basic intelligence without AI analysis
      return {
        phone_e164: '',
        name: convo.contactName,
        ai_summary: `Conversation with ${convo.messageCount} messages from ${convo.firstMessage.toLocaleDateString()} to ${convo.lastMessage.toLocaleDateString()}. AI analysis unavailable.`,
        last_analyzed: new Date().toISOString(),
        conversation_count: convo.messageCount,
        raw_conversations: conversationText
      };
    }
  };

  // Save intelligence to database
  const saveIntelligence = async (intel: CandidateIntelligence, candidateId?: string) => {
    const data = {
      ...intel,
      candidate_id: candidateId,
      updated_at: new Date().toISOString()
    };
    
    // Check if exists
    const { data: existing } = await supabase
      .from('candidate_intelligence')
      .select('id')
      .eq('phone_e164', intel.phone_e164)
      .single();
    
    if (existing) {
      await supabase
        .from('candidate_intelligence')
        .update(data)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('candidate_intelligence')
        .insert({ ...data, created_at: new Date().toISOString() });
    }
  };

  // Analyze all conversations
  const analyzeAllConversations = async () => {
    setAnalyzing(true);
    setAnalysisProgress({ current: 0, total: parsedConversations.length });
    
    for (let i = 0; i < parsedConversations.length; i++) {
      const convo = parsedConversations[i];
      setAnalysisProgress({ current: i + 1, total: parsedConversations.length });
      
      try {
        const intel = await analyzeConversation(convo);
        const candidate = findMatchingCandidate(convo);
        
        if (candidate) {
          intel.candidate_id = candidate.id;
          intel.phone_e164 = candidate.phone_e164;
        }
        
        await saveIntelligence(intel, candidate?.id);
      } catch (error) {
        console.error(`Error analyzing ${convo.contactName}:`, error);
      }
      
      // Small delay between analyses
      await new Promise(r => setTimeout(r, 500));
    }
    
    setAnalyzing(false);
    loadIntelligence();
  };

  // Search intelligence with natural language
  const searchIntelligence = async () => {
    if (!searchQuery.trim()) return;
    
    setSearching(true);
    
    try {
      // Call AI search endpoint
      const response = await fetch('/api/search-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          intelligence: intelligence
        })
      });
      
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results.matches || []);
      } else {
        // Fallback to simple text search
        const query = searchQuery.toLowerCase();
        const results = intelligence.filter(i => 
          i.name.toLowerCase().includes(query) ||
          i.ai_summary?.toLowerCase().includes(query) ||
          i.skills?.some(s => s.toLowerCase().includes(query)) ||
          i.qualifications?.some(q => q.toLowerCase().includes(query)) ||
          i.availability?.some(a => a.toLowerCase().includes(query))
        );
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fallback
      const query = searchQuery.toLowerCase();
      const results = intelligence.filter(i => 
        i.name.toLowerCase().includes(query) ||
        i.ai_summary?.toLowerCase().includes(query)
      );
      setSearchResults(results);
    }
    
    setSearching(false);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .wa-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#fff;padding:0 24px}
        .wa-tab{padding:16px 24px;font-size:14px;font-weight:600;color:#6b7280;cursor:pointer;border-bottom:3px solid transparent;display:flex;align-items:center;gap:8px}
        .wa-tab:hover{color:#111;background:#f9fafb}
        .wa-tab.active{color:#25d366;border-bottom-color:#25d366}
        .wa-badge{padding:2px 8px;background:#25d366;color:#fff;border-radius:10px;font-size:11px;font-weight:700}
        
        .wa-content{padding:24px;max-width:1400px;margin:0 auto}
        .wa-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media(max-width:1000px){.wa-grid{grid-template-columns:1fr}}
        
        .wa-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
        .wa-panel-header{padding:14px 18px;border-bottom:1px solid #e5e7eb;font-weight:600;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
        .wa-panel-body{padding:18px}
        
        .wa-input{width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:14px;box-sizing:border-box}
        .wa-input:focus{outline:none;border-color:#25d366}
        .wa-textarea{width:100%;padding:12px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:13px;min-height:200px;resize:vertical;font-family:monospace;box-sizing:border-box}
        .wa-textarea:focus{outline:none;border-color:#25d366}
        
        .wa-btn{padding:12px 18px;font-size:14px;font-weight:600;border-radius:8px;cursor:pointer;border:none;transition:all .2s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
        .wa-btn:disabled{opacity:.5;cursor:not-allowed}
        .wa-btn.primary{background:#25d366;color:#fff}
        .wa-btn.primary:hover:not(:disabled){background:#128c7e}
        .wa-btn.secondary{background:#f3f4f6;color:#374151}
        .wa-btn.secondary:hover:not(:disabled){background:#e5e7eb}
        .wa-btn.block{width:100%}
        .wa-btn.small{padding:8px 14px;font-size:12px}
        
        .wa-drop-zone{border:2px dashed #d1d5db;border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all .2s}
        .wa-drop-zone:hover{border-color:#25d366;background:#f0fdf4}
        .wa-drop-zone.active{border-color:#25d366;background:#dcfce7}
        
        .wa-convo-list{max-height:400px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px}
        .wa-convo{padding:12px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
        .wa-convo:hover{background:#f9fafb}
        .wa-convo.selected{background:#dcfce7}
        .wa-convo-name{font-weight:600;font-size:14px}
        .wa-convo-meta{font-size:12px;color:#6b7280;margin-top:2px}
        .wa-convo-count{padding:4px 10px;background:#f3f4f6;border-radius:12px;font-size:12px;font-weight:600}
        
        .wa-messages{max-height:300px;overflow-y:auto;padding:12px;background:#ece5dd;border-radius:8px}
        .wa-message{max-width:80%;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px}
        .wa-message.me{background:#dcf8c6;margin-left:auto}
        .wa-message.them{background:#fff}
        .wa-message-time{font-size:10px;color:#6b7280;text-align:right;margin-top:4px}
        
        .wa-intel-list{display:grid;gap:12px}
        .wa-intel-card{padding:16px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .2s}
        .wa-intel-card:hover{border-color:#25d366;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .wa-intel-card.selected{border-color:#25d366;background:#f0fdf4}
        .wa-intel-name{font-weight:600;font-size:15px;margin-bottom:4px}
        .wa-intel-summary{font-size:13px;color:#6b7280;line-height:1.5;margin-bottom:8px}
        .wa-intel-tags{display:flex;flex-wrap:wrap;gap:6px}
        .wa-intel-tag{padding:4px 10px;background:#f3f4f6;border-radius:6px;font-size:11px;font-weight:500}
        .wa-intel-tag.skill{background:#dbeafe;color:#1e40af}
        .wa-intel-tag.availability{background:#dcfce7;color:#166534}
        .wa-intel-tag.warning{background:#fee2e2;color:#991b1b}
        .wa-intel-tag.positive{background:#fef3c7;color:#92400e}
        
        .wa-search-box{position:relative}
        .wa-search-input{width:100%;padding:16px 20px;border:2px solid #e5e7eb;border-radius:12px;font-size:16px;box-sizing:border-box}
        .wa-search-input:focus{outline:none;border-color:#25d366;box-shadow:0 0 0 3px rgba(37,211,102,.1)}
        .wa-search-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);padding:10px 20px;background:#25d366;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer}
        
        .wa-suggestions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .wa-suggestion{padding:8px 14px;background:#f3f4f6;border-radius:8px;font-size:13px;cursor:pointer;transition:all .2s}
        .wa-suggestion:hover{background:#e5e7eb}
        
        .wa-detail{padding:20px}
        .wa-detail-section{margin-bottom:20px}
        .wa-detail-title{font-weight:600;font-size:13px;color:#6b7280;margin-bottom:8px;text-transform:uppercase}
        .wa-detail-content{font-size:14px;line-height:1.6}
        .wa-detail-list{list-style:none;padding:0;margin:0}
        .wa-detail-list li{padding:6px 0;border-bottom:1px solid #f3f4f6}
        .wa-detail-list li:last-child{border-bottom:none}
        
        .wa-progress{background:#e5e7eb;height:8px;border-radius:4px;overflow:hidden;margin:12px 0}
        .wa-progress-fill{height:100%;background:#25d366;transition:width .3s}
        
        .wa-empty{text-align:center;padding:60px 20px;color:#9ca3af}
        .wa-empty-icon{font-size:48px;margin-bottom:12px;opacity:.5}
      `}</style>

      {/* Tabs */}
      <div className="wa-tabs">
        <div className={`wa-tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>
          📥 Import Chats
        </div>
        <div className={`wa-tab ${activeTab === 'intelligence' ? 'active' : ''}`} onClick={() => setActiveTab('intelligence')}>
          🧠 Candidate Intelligence
          {intelligence.length > 0 && <span className="wa-badge">{intelligence.length}</span>}
        </div>
        <div className={`wa-tab ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
          🔍 AI Search
        </div>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="wa-content">
          <div className="wa-grid">
            <div>
              <div className="wa-panel">
                <div className="wa-panel-header">
                  <span>📱 Import WhatsApp Chats</span>
                </div>
                <div className="wa-panel-body">
                  <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.6 }}>
                    Export chats from WhatsApp and import them here. The AI will analyze conversations 
                    to extract availability, skills, preferences, and other candidate information.
                  </p>
                  
                  <label className="wa-drop-zone" style={{ display: 'block', marginBottom: 16 }}>
                    <input 
                      type="file" 
                      accept=".txt" 
                      style={{ display: 'none' }} 
                      onChange={handleFileUpload}
                    />
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop WhatsApp export here</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>or click to browse (.txt file)</div>
                  </label>
                  
                  <div style={{ textAlign: 'center', color: '#6b7280', margin: '12px 0' }}>— or paste text —</div>
                  
                  <textarea 
                    className="wa-textarea"
                    placeholder="Paste WhatsApp chat export here..."
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                  />
                  
                  <button 
                    className="wa-btn primary block"
                    onClick={handlePaste}
                    disabled={!importText.trim()}
                    style={{ marginTop: 12 }}
                  >
                    Parse Conversations
                  </button>
                </div>
              </div>

              {/* How to export */}
              <div className="wa-panel" style={{ marginTop: 16 }}>
                <div className="wa-panel-header">📖 How to Export from WhatsApp</div>
                <div className="wa-panel-body">
                  <ol style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8, paddingLeft: 20 }}>
                    <li>Open the WhatsApp chat you want to export</li>
                    <li>Tap ⋮ (menu) → More → Export chat</li>
                    <li>Choose "Without media" (faster)</li>
                    <li>Save the .txt file or copy the text</li>
                    <li>Import it here</li>
                  </ol>
                </div>
              </div>
            </div>

            <div>
              <div className="wa-panel">
                <div className="wa-panel-header">
                  <span>💬 Parsed Conversations</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{parsedConversations.length} found</span>
                </div>
                <div className="wa-panel-body">
                  {parsedConversations.length === 0 ? (
                    <div className="wa-empty">
                      <div className="wa-empty-icon">💬</div>
                      <div>Import a WhatsApp export to see conversations</div>
                    </div>
                  ) : (
                    <>
                      <div className="wa-convo-list" style={{ marginBottom: 16 }}>
                        {parsedConversations.map((convo, i) => (
                          <div 
                            key={i}
                            className={`wa-convo ${selectedConversation === convo ? 'selected' : ''}`}
                            onClick={() => setSelectedConversation(convo)}
                          >
                            <div>
                              <div className="wa-convo-name">{convo.contactName}</div>
                              <div className="wa-convo-meta">
                                {formatDate(convo.firstMessage)} - {formatDate(convo.lastMessage)}
                              </div>
                            </div>
                            <div className="wa-convo-count">{convo.messageCount} msgs</div>
                          </div>
                        ))}
                      </div>
                      
                      {analyzing ? (
                        <div>
                          <div style={{ fontSize: 13, marginBottom: 8 }}>
                            Analyzing... {analysisProgress.current}/{analysisProgress.total}
                          </div>
                          <div className="wa-progress">
                            <div 
                              className="wa-progress-fill"
                              style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <button 
                          className="wa-btn primary block"
                          onClick={analyzeAllConversations}
                        >
                          🤖 Analyze All with AI ({parsedConversations.length})
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Preview selected conversation */}
              {selectedConversation && (
                <div className="wa-panel" style={{ marginTop: 16 }}>
                  <div className="wa-panel-header">
                    <span>👀 Preview: {selectedConversation.contactName}</span>
                  </div>
                  <div className="wa-panel-body" style={{ padding: 0 }}>
                    <div className="wa-messages">
                      {selectedConversation.messages.slice(0, 20).map((msg, i) => (
                        <div key={i} className={`wa-message ${msg.sender}`}>
                          {msg.text}
                          <div className="wa-message-time">
                            {msg.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                      {selectedConversation.messages.length > 20 && (
                        <div style={{ textAlign: 'center', padding: 12, color: '#6b7280', fontSize: 12 }}>
                          + {selectedConversation.messages.length - 20} more messages
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Intelligence Tab */}
      {activeTab === 'intelligence' && (
        <div className="wa-content">
          <div className="wa-grid">
            <div>
              <div className="wa-panel">
                <div className="wa-panel-header">
                  <span>🧠 Candidate Intelligence</span>
                  <button className="wa-btn small secondary" onClick={loadIntelligence}>🔄 Refresh</button>
                </div>
                <div className="wa-panel-body">
                  {loadingIntel ? (
                    <div className="wa-empty">Loading...</div>
                  ) : intelligence.length === 0 ? (
                    <div className="wa-empty">
                      <div className="wa-empty-icon">🧠</div>
                      <div>No intelligence yet. Import WhatsApp chats to get started.</div>
                    </div>
                  ) : (
                    <div className="wa-intel-list">
                      {intelligence.map(intel => (
                        <div 
                          key={intel.id}
                          className={`wa-intel-card ${selectedIntel?.id === intel.id ? 'selected' : ''}`}
                          onClick={() => setSelectedIntel(intel)}
                        >
                          <div className="wa-intel-name">{intel.name}</div>
                          <div className="wa-intel-summary">
                            {intel.ai_summary?.substring(0, 150)}...
                          </div>
                          <div className="wa-intel-tags">
                            {intel.skills?.slice(0, 3).map((s, i) => (
                              <span key={i} className="wa-intel-tag skill">{s}</span>
                            ))}
                            {intel.availability?.slice(0, 2).map((a, i) => (
                              <span key={i} className="wa-intel-tag availability">{a}</span>
                            ))}
                            {intel.red_flags?.slice(0, 1).map((r, i) => (
                              <span key={i} className="wa-intel-tag warning">⚠️ {r}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              {selectedIntel ? (
                <div className="wa-panel">
                  <div className="wa-panel-header">
                    <span>📋 {selectedIntel.name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      Last analyzed: {selectedIntel.last_analyzed ? formatDate(selectedIntel.last_analyzed) : 'Never'}
                    </span>
                  </div>
                  <div className="wa-detail">
                    <div className="wa-detail-section">
                      <div className="wa-detail-title">AI Summary</div>
                      <div className="wa-detail-content">{selectedIntel.ai_summary || 'No summary available'}</div>
                    </div>

                    {selectedIntel.availability && selectedIntel.availability.length > 0 && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">📅 Availability</div>
                        <ul className="wa-detail-list">
                          {selectedIntel.availability.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedIntel.skills && selectedIntel.skills.length > 0 && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">🛠️ Skills & Experience</div>
                        <ul className="wa-detail-list">
                          {selectedIntel.skills.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedIntel.location_preferences && selectedIntel.location_preferences.length > 0 && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">📍 Location Preferences</div>
                        <ul className="wa-detail-list">
                          {selectedIntel.location_preferences.map((l, i) => <li key={i}>{l}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedIntel.positive_signals && selectedIntel.positive_signals.length > 0 && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">✅ Positive Signals</div>
                        <ul className="wa-detail-list">
                          {selectedIntel.positive_signals.map((p, i) => <li key={i} style={{ color: '#166534' }}>{p}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedIntel.red_flags && selectedIntel.red_flags.length > 0 && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">⚠️ Red Flags</div>
                        <ul className="wa-detail-list">
                          {selectedIntel.red_flags.map((r, i) => <li key={i} style={{ color: '#991b1b' }}>{r}</li>)}
                        </ul>
                      </div>
                    )}

                    {selectedIntel.rate_expectations && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">💰 Rate Expectations</div>
                        <div className="wa-detail-content">{selectedIntel.rate_expectations}</div>
                      </div>
                    )}

                    {selectedIntel.transport && (
                      <div className="wa-detail-section">
                        <div className="wa-detail-title">🚗 Transport</div>
                        <div className="wa-detail-content">{selectedIntel.transport}</div>
                      </div>
                    )}

                    <div className="wa-detail-section">
                      <div className="wa-detail-title">📊 Stats</div>
                      <div className="wa-detail-content">
                        {selectedIntel.conversation_count} messages analyzed
                        {selectedIntel.reliability_score && ` • Reliability: ${selectedIntel.reliability_score}/10`}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="wa-panel">
                  <div className="wa-panel-body">
                    <div className="wa-empty">
                      <div className="wa-empty-icon">👈</div>
                      <div>Select a candidate to view their intelligence</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="wa-content">
          <div className="wa-panel" style={{ marginBottom: 24 }}>
            <div className="wa-panel-body">
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>🔍 AI Candidate Search</h2>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
                Ask in natural language to find candidates based on their intelligence data.
              </p>
              
              <div className="wa-search-box">
                <input 
                  className="wa-search-input"
                  placeholder="e.g., Find HCAs available weekends with dementia experience..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchIntelligence()}
                />
                <button 
                  className="wa-search-btn"
                  onClick={searchIntelligence}
                  disabled={searching || !searchQuery.trim()}
                >
                  {searching ? '...' : 'Search'}
                </button>
              </div>
              
              <div className="wa-suggestions">
                {searchSuggestions.map((s, i) => (
                  <div 
                    key={i}
                    className="wa-suggestion"
                    onClick={() => { setSearchQuery(s); }}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="wa-panel">
              <div className="wa-panel-header">
                <span>🎯 Search Results</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{searchResults.length} matches</span>
              </div>
              <div className="wa-panel-body">
                <div className="wa-intel-list">
                  {searchResults.map(intel => (
                    <div key={intel.id} className="wa-intel-card">
                      <div className="wa-intel-name">{intel.name}</div>
                      <div className="wa-intel-summary">{intel.ai_summary}</div>
                      <div className="wa-intel-tags">
                        {intel.skills?.slice(0, 3).map((s, i) => (
                          <span key={i} className="wa-intel-tag skill">{s}</span>
                        ))}
                        {intel.availability?.slice(0, 2).map((a, i) => (
                          <span key={i} className="wa-intel-tag availability">{a}</span>
                        ))}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <a href={`tel:${intel.phone_e164}`} className="wa-btn small primary" style={{ textDecoration: 'none', marginRight: 8 }}>
                          📞 Call
                        </a>
                        <a href={`https://wa.me/${intel.phone_e164?.replace(/\D/g, '')}`} target="_blank" className="wa-btn small secondary" style={{ textDecoration: 'none' }}>
                          💬 WhatsApp
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !searching && (
            <div className="wa-panel">
              <div className="wa-panel-body">
                <div className="wa-empty">
                  <div className="wa-empty-icon">🔍</div>
                  <div>No matches found. Try a different search or import more conversations.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
