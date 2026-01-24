'use client';
import { useState, useEffect, useRef } from 'react';
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
}

interface SendLog {
  phone: string;
  name: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
}

export default function SMSCampaignView() {
  const [activeTab, setActiveTab] = useState<'compose' | 'conversations' | 'campaigns'>('compose');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Hi {name}, this is [Your Name] from [Company]. We have care positions available. Are you looking for work? Reply YES if interested or STOP to opt out.');
  const [campaignName, setCampaignName] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterCalled, setFilterCalled] = useState('all');
  const [excludeOptOut, setExcludeOptOut] = useState(true);
  const [gatewayUrl, setGatewayUrl] = useState('http://192.168.1.100:8080');
  const [sendDelay, setSendDelay] = useState(30);
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sendLog, setSendLog] = useState<SendLog[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<any>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    loadCandidates();
    loadConversations();
  }, []);

  async function loadCandidates() {
    setLoading(true);
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, source, last_called_at, sms_opt_out')
      .not('phone_e164', 'is', null)
      .order('created_at', { ascending: false });
    if (data) setCandidates(data);
    setLoading(false);
  }

  async function loadConversations() {
    const { data } = await supabase
      .from('sms_messages')
      .select('*, candidates(id, name, roles, status)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) {
      // Group by phone
      const grouped = new Map<string, any[]>();
      data.forEach(msg => {
        const existing = grouped.get(msg.phone_e164) || [];
        existing.push(msg);
        grouped.set(msg.phone_e164, existing);
      });
      const convos = Array.from(grouped.entries()).map(([phone, msgs]) => ({
        phone,
        name: msgs.find(m => m.candidates?.name)?.candidates?.name || null,
        messages: msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        lastMessage: msgs[0],
        hasResponse: msgs.some(m => m.direction === 'inbound'),
        latestIntent: msgs.find(m => m.direction === 'inbound')?.ai_intent
      }));
      setConversations(convos);
    }
  }

  const filteredCandidates = candidates.filter(c => {
    if (!c.phone_e164) return false;
    if (excludeOptOut && c.sms_opt_out) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterSource !== 'all' && c.source !== filterSource) return false;
    if (filterCalled === 'called' && !c.last_called_at) return false;
    if (filterCalled === 'not-called' && c.last_called_at) return false;
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
    return template.replace(/{name}/g, firstName).replace(/{full_name}/g, candidate.name || 'Candidate');
  };

  async function sendViaGateway(phone: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${gatewayUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: text })
      });
      return response.ok;
    } catch { return false; }
  }

  async function startSending() {
    if (filteredCandidates.length === 0) return;
    setIsSending(true);
    setIsPaused(false);
    abortRef.current = false;
    setCurrentIndex(0);
    setSendLog([]);

    // Create campaign record
    const { data: campaign } = await supabase.from('sms_campaigns').insert({
      name: campaignName || `Campaign ${new Date().toLocaleDateString('en-GB')}`,
      template: message,
      total_recipients: filteredCandidates.length,
      status: 'sending',
      started_at: new Date().toISOString()
    }).select().single();

    for (let i = 0; i < filteredCandidates.length; i++) {
      if (abortRef.current) break;
      while (isPaused && !abortRef.current) await new Promise(r => setTimeout(r, 500));
      if (abortRef.current) break;

      const candidate = filteredCandidates[i];
      const personalizedMsg = personalizeMessage(message, candidate);
      setCurrentIndex(i);
      setSendLog(prev => [...prev, { phone: candidate.phone_e164, name: candidate.name || 'Unknown', status: 'pending' }]);

      try {
        const success = await sendViaGateway(candidate.phone_e164, personalizedMsg);
        if (success) {
          await supabase.from('sms_messages').insert({
            candidate_id: candidate.id,
            phone_e164: candidate.phone_e164,
            direction: 'outbound',
            message_text: personalizedMsg,
            campaign_id: campaign?.id,
            status: 'sent',
            sent_at: new Date().toISOString()
          });
          setSendLog(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, status: 'sent' } : item));
        } else {
          setSendLog(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, status: 'failed', error: 'Gateway error' } : item));
        }
      } catch (err: any) {
        setSendLog(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, status: 'failed', error: err.message } : item));
      }

      if (i < filteredCandidates.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, sendDelay * 1000));
      }
    }

    if (campaign?.id) {
      await supabase.from('sms_campaigns').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', campaign.id);
    }
    setIsSending(false);
  }

  function exportToCSV() {
    const rows = [['Phone', 'Name', 'Message']];
    filteredCandidates.forEach(c => rows.push([c.phone_e164, c.name || '', personalizeMessage(message, c)]));
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sms-campaign-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const getIntentColor = (intent: string | null) => {
    switch (intent) {
      case 'interested': return { bg: '#dcfce7', text: '#166534' };
      case 'callback_request': return { bg: '#dbeafe', text: '#1e40af' };
      case 'question': return { bg: '#fef3c7', text: '#92400e' };
      case 'not_interested': case 'stop_request': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .sms-tabs{display:flex;border-bottom:1px solid #e5e7eb;background:#fff;padding:0 20px}
        .sms-tab{padding:14px 24px;font-size:14px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent}
        .sms-tab:hover{color:#111}
        .sms-tab.active{color:#4f46e5;border-bottom-color:#4f46e5}
        .sms-badge{margin-left:8px;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:10px;font-size:11px;font-weight:600}
        .sms-compose{display:grid;grid-template-columns:1fr 380px;gap:24px;padding:24px}
        @media(max-width:1100px){.sms-compose{grid-template-columns:1fr}}
        .sms-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .sms-panel-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:15px;font-weight:600}
        .sms-panel-body{padding:20px}
        .sms-input{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box}
        .sms-textarea{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;resize:vertical;min-height:100px;box-sizing:border-box;font-family:inherit}
        .sms-filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
        .sms-filter select{padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px}
        .sms-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
        .sms-stat{text-align:center;padding:12px;background:#f9fafb;border-radius:8px}
        .sms-stat strong{display:block;font-size:20px;color:#111}
        .sms-stat small{font-size:10px;color:#6b7280}
        .sms-btn{padding:12px 20px;font-size:14px;font-weight:500;border-radius:8px;cursor:pointer;border:none;width:100%;margin-bottom:8px}
        .sms-btn.primary{background:#22c55e;color:#fff}
        .sms-btn.secondary{background:#f3f4f6;color:#374151}
        .sms-btn.danger{background:#fee2e2;color:#dc2626}
        .sms-progress{margin-top:16px;padding:12px;background:#f9fafb;border-radius:8px}
        .sms-progress-bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden}
        .sms-progress-fill{height:100%;background:#4f46e5;transition:width .3s}
        .sms-log{max-height:200px;overflow-y:auto;font-size:12px;margin-top:12px}
        .sms-log-item{padding:6px 10px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between}
        .sms-log-item.sent{background:#f0fdf4}
        .sms-log-item.failed{background:#fef2f2}
        .sms-convo-list{max-height:500px;overflow-y:auto}
        .sms-convo{padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;gap:12px;align-items:center}
        .sms-convo:hover{background:#f9fafb}
        .sms-convo.active{background:#eef2ff}
        .sms-convo-avatar{width:40px;height:40px;border-radius:10px;background:#4f46e5;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600}
        .sms-convo-info{flex:1;min-width:0}
        .sms-convo-name{font-weight:600;font-size:14px}
        .sms-convo-preview{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sms-detail{flex:1;display:flex;flex-direction:column}
        .sms-detail-header{padding:16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .sms-messages{flex:1;padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
        .sms-message{max-width:80%;padding:10px 14px;border-radius:12px}
        .sms-message.out{background:#4f46e5;color:#fff;align-self:flex-end}
        .sms-message.in{background:#f3f4f6;align-self:flex-start}
        .sms-ai-box{margin-top:8px;padding:10px;background:#fefce8;border:1px solid #fef08a;border-radius:8px;font-size:12px}
      `}</style>

      {/* Tabs */}
      <div className="sms-tabs">
        <div className={`sms-tab ${activeTab === 'compose' ? 'active' : ''}`} onClick={() => setActiveTab('compose')}>
          📝 Compose
        </div>
        <div className={`sms-tab ${activeTab === 'conversations' ? 'active' : ''}`} onClick={() => { setActiveTab('conversations'); loadConversations(); }}>
          💬 Conversations
          {conversations.filter(c => c.hasResponse).length > 0 && (
            <span className="sms-badge">{conversations.filter(c => c.hasResponse).length}</span>
          )}
        </div>
      </div>

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div className="sms-compose">
          <div>
            <div className="sms-panel">
              <div className="sms-panel-header">📝 Message Template</div>
              <div className="sms-panel-body">
                <input className="sms-input" placeholder="Campaign name (optional)" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
                <textarea className="sms-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Type message... Use {name} for first name" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  <span>Variables: {'{name}'}, {'{full_name}'}</span>
                  <span>{charCount} chars • {smsCount} SMS</span>
                </div>
              </div>
            </div>

            <div className="sms-panel" style={{ marginTop: 20 }}>
              <div className="sms-panel-header">🎯 Target ({filteredCandidates.length} recipients)</div>
              <div className="sms-panel-body">
                <div className="sms-filters">
                  <div className="sms-filter">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="all">All Statuses</option>
                      <option value="new">New</option>
                      <option value="screening">Screening</option>
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
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={excludeOptOut} onChange={e => setExcludeOptOut(e.target.checked)} />
                  Exclude opted-out candidates
                </label>
              </div>
            </div>

            {/* AI Info */}
            <div className="sms-ai-box" style={{ marginTop: 20 }}>
              <strong>🤖 AI Response Analysis</strong>
              <p style={{ margin: '8px 0 0', color: '#854d0e' }}>
                When candidates reply, AI automatically analyzes responses to detect interest level, 
                callback requests, and opt-outs. View analyzed responses in the Conversations tab.
              </p>
            </div>
          </div>

          <div>
            <div className="sms-panel">
              <div className="sms-panel-header">🚀 Send</div>
              <div className="sms-panel-body">
                <div className="sms-stats">
                  <div className="sms-stat"><strong>{filteredCandidates.length}</strong><small>Recipients</small></div>
                  <div className="sms-stat"><strong>{smsCount}</strong><small>SMS each</small></div>
                  <div className="sms-stat"><strong>{sendDelay}s</strong><small>Delay</small></div>
                  <div className="sms-stat"><strong>{hours}h {minutes}m</strong><small>Est. time</small></div>
                </div>

                <input className="sms-input" value={gatewayUrl} onChange={e => setGatewayUrl(e.target.value)} placeholder="Gateway URL" />
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: '#6b7280' }}>Delay: {sendDelay}s</label>
                  <input type="range" min="5" max="120" value={sendDelay} onChange={e => setSendDelay(parseInt(e.target.value))} style={{ width: '100%' }} />
                </div>

                {!isSending ? (
                  <>
                    <button className="sms-btn primary" onClick={startSending} disabled={filteredCandidates.length === 0}>
                      📱 Start Sending ({filteredCandidates.length})
                    </button>
                    <button className="sms-btn secondary" onClick={exportToCSV}>📥 Export CSV</button>
                  </>
                ) : (
                  <>
                    <button className="sms-btn secondary" onClick={() => setIsPaused(!isPaused)}>
                      {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                    </button>
                    <button className="sms-btn danger" onClick={() => { abortRef.current = true; setIsSending(false); }}>
                      ⏹️ Stop
                    </button>
                  </>
                )}

                {isSending && (
                  <div className="sms-progress">
                    <div className="sms-progress-bar">
                      <div className="sms-progress-fill" style={{ width: `${(currentIndex / filteredCandidates.length) * 100}%` }} />
                    </div>
                    <div style={{ fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                      {currentIndex} / {filteredCandidates.length} {isPaused ? '(Paused)' : ''}
                    </div>
                  </div>
                )}

                {sendLog.length > 0 && (
                  <div className="sms-log">
                    {sendLog.slice().reverse().map((log, i) => (
                      <div key={i} className={`sms-log-item ${log.status}`}>
                        <span>{log.name}</span>
                        <span>{log.status === 'sent' ? '✓' : log.status === 'failed' ? '✗' : '...'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div style={{ display: 'flex', height: 'calc(100vh - 180px)' }}>
          {/* List */}
          <div style={{ width: 350, borderRight: '1px solid #e5e7eb', background: '#fff' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>
              💬 {conversations.length} Conversations
            </div>
            <div className="sms-convo-list">
              {conversations.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  No conversations yet. Send your first campaign!
                </div>
              ) : conversations.map(convo => {
                const intentColors = getIntentColor(convo.latestIntent);
                return (
                  <div 
                    key={convo.phone} 
                    className={`sms-convo ${selectedConvo?.phone === convo.phone ? 'active' : ''}`}
                    onClick={() => setSelectedConvo(convo)}
                  >
                    <div className="sms-convo-avatar">{convo.name?.[0]?.toUpperCase() || '?'}</div>
                    <div className="sms-convo-info">
                      <div className="sms-convo-name">{convo.name || convo.phone}</div>
                      <div className="sms-convo-preview">
                        {convo.lastMessage?.direction === 'inbound' ? '← ' : '→ '}
                        {convo.lastMessage?.message_text?.substring(0, 40)}...
                      </div>
                    </div>
                    {convo.latestIntent && (
                      <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: intentColors.bg, color: intentColors.text }}>
                        {convo.latestIntent}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          <div className="sms-detail" style={{ background: '#fff' }}>
            {selectedConvo ? (
              <>
                <div className="sms-detail-header">
                  <div>
                    <div style={{ fontWeight: 600 }}>{selectedConvo.name || 'Unknown'}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{selectedConvo.phone}</div>
                  </div>
                  <a href={`tel:${selectedConvo.phone}`} style={{ padding: '8px 16px', background: '#22c55e', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13 }}>
                    📞 Call
                  </a>
                </div>
                <div className="sms-messages">
                  {selectedConvo.messages.map((msg: any) => (
                    <div key={msg.id}>
                      <div className={`sms-message ${msg.direction === 'outbound' ? 'out' : 'in'}`}>
                        {msg.message_text}
                        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                          {new Date(msg.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      {msg.direction === 'inbound' && msg.ai_summary && (
                        <div className="sms-ai-box" style={{ maxWidth: '80%', marginTop: 4 }}>
                          <strong>🤖 AI:</strong> {msg.ai_summary}
                          {msg.ai_suggested_action && <span style={{ marginLeft: 8 }}>→ {msg.ai_suggested_action.replace(/_/g, ' ')}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                Select a conversation
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
