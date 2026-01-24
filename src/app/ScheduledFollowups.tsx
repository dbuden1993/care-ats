'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScheduledFollowup {
  id: string;
  candidate_id: string;
  phone_e164: string;
  scheduled_for: string;
  message_text: string;
  follow_up_type: string;
  trigger_reason: string | null;
  ai_generated: boolean;
  status: string;
  candidates?: {
    name: string | null;
    roles: string | null;
  };
}

interface CandidateForFollowup {
  id: string;
  name: string | null;
  phone_e164: string;
  last_sms_at: string | null;
  last_called_at: string | null;
  sms_interest_level: string | null;
  latest_intent: string | null;
}

export default function ScheduledFollowupsView() {
  const [followups, setFollowups] = useState<ScheduledFollowup[]>([]);
  const [candidates, setCandidates] = useState<CandidateForFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string>('');
  const [followupMessage, setFollowupMessage] = useState('');
  const [followupTime, setFollowupTime] = useState('');
  const [followupType, setFollowupType] = useState<'sms' | 'call_reminder'>('sms');
  const [generating, setGenerating] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Load scheduled followups
    const { data: followupsData } = await supabase
      .from('scheduled_followups')
      .select('*, candidates(name, roles)')
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    // Load candidates who might need followups
    const { data: candidatesData } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, last_sms_at, last_called_at, sms_interest_level')
      .not('phone_e164', 'is', null)
      .neq('sms_opt_out', true);

    // Get latest SMS intent for each
    const { data: smsData } = await supabase
      .from('sms_messages')
      .select('phone_e164, ai_intent, created_at')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false });

    const intentByPhone = new Map<string, string>();
    smsData?.forEach(sms => {
      if (!intentByPhone.has(sms.phone_e164)) {
        intentByPhone.set(sms.phone_e164, sms.ai_intent || '');
      }
    });

    const enrichedCandidates = (candidatesData || []).map(c => ({
      ...c,
      latest_intent: intentByPhone.get(c.phone_e164) || null
    }));

    setFollowups(followupsData || []);
    setCandidates(enrichedCandidates);
    setLoading(false);
  }

  // Find candidates who need followups
  const candidatesNeedingFollowup = candidates.filter(c => {
    if (!c.last_sms_at) return false;
    
    const daysSinceSms = (Date.now() - new Date(c.last_sms_at).getTime()) / 1000 / 60 / 60 / 24;
    
    // Interested but not called - needs followup after 1 day
    if (c.sms_interest_level === 'hot' && !c.last_called_at && daysSinceSms > 1) return true;
    
    // Had interest but no recent activity - needs followup after 3 days
    if (c.latest_intent === 'interested' && daysSinceSms > 3) return true;
    
    // Asked question but didn't respond to answer - needs followup after 2 days
    if (c.latest_intent === 'question' && daysSinceSms > 2) return true;
    
    return false;
  });

  async function generateAIMessage(candidate: CandidateForFollowup) {
    setGenerating(true);
    
    try {
      const response = await fetch('/api/sms/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: candidate.name,
          incomingMessage: '', // Follow-up, no incoming message
          intent: candidate.latest_intent,
          sentiment: null,
          candidateInfo: {
            lastCalledAt: candidate.last_called_at,
            status: candidate.sms_interest_level
          }
        })
      });
      
      const data = await response.json();
      if (data.suggestions?.replies?.[0]) {
        setFollowupMessage(data.suggestions.replies[0].text);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      // Fallback message
      const firstName = candidate.name?.split(' ')[0] || 'Hi';
      setFollowupMessage(`Hi ${firstName}, just following up on my earlier message. Are you still interested in care work opportunities? Let me know if you'd like to chat!`);
    }
    
    setGenerating(false);
  }

  async function createFollowup() {
    if (!selectedCandidate || !followupMessage || !followupTime) return;

    const candidate = candidates.find(c => c.id === selectedCandidate);
    if (!candidate) return;

    await supabase.from('scheduled_followups').insert({
      candidate_id: selectedCandidate,
      phone_e164: candidate.phone_e164,
      scheduled_for: new Date(followupTime).toISOString(),
      message_text: followupMessage,
      follow_up_type: followupType,
      trigger_reason: 'manual',
      ai_generated: false,
      status: 'pending'
    });

    setShowCreate(false);
    setSelectedCandidate('');
    setFollowupMessage('');
    setFollowupTime('');
    loadData();
  }

  async function autoScheduleFollowups() {
    setAutoScheduling(true);
    
    for (const candidate of candidatesNeedingFollowup.slice(0, 10)) { // Limit to 10 at a time
      const firstName = candidate.name?.split(' ')[0] || 'Hi';
      
      let message = '';
      let reason = '';
      
      if (candidate.sms_interest_level === 'hot') {
        message = `Hi ${firstName}, I noticed you showed interest in care work. I'd love to chat - when's a good time to call you?`;
        reason = 'hot_lead_no_call';
      } else if (candidate.latest_intent === 'interested') {
        message = `Hi ${firstName}, following up on our conversation. Still interested in care opportunities? I have some great roles available!`;
        reason = 'interested_no_response';
      } else if (candidate.latest_intent === 'question') {
        message = `Hi ${firstName}, just checking in - did my previous message answer your question? Happy to chat if you'd like more info!`;
        reason = 'question_no_followup';
      }
      
      if (message) {
        // Schedule for tomorrow at 10am
        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        scheduledTime.setHours(10, 0, 0, 0);
        
        await supabase.from('scheduled_followups').insert({
          candidate_id: candidate.id,
          phone_e164: candidate.phone_e164,
          scheduled_for: scheduledTime.toISOString(),
          message_text: message,
          follow_up_type: 'sms',
          trigger_reason: reason,
          ai_generated: true,
          status: 'pending'
        });
      }
    }
    
    setAutoScheduling(false);
    loadData();
  }

  async function cancelFollowup(id: string) {
    await supabase
      .from('scheduled_followups')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id);
    loadData();
  }

  async function sendNow(followup: ScheduledFollowup) {
    // This would integrate with your SMS gateway
    // For now, just mark as sent
    await supabase
      .from('scheduled_followups')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', followup.id);
    
    // Log the SMS
    await supabase.from('sms_messages').insert({
      candidate_id: followup.candidate_id,
      phone_e164: followup.phone_e164,
      direction: 'outbound',
      message_text: followup.message_text,
      status: 'sent',
      sent_at: new Date().toISOString()
    });
    
    loadData();
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeUntil = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff < 0) return 'Overdue';
    
    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .sf-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .sf-title{font-size:24px;font-weight:700;color:#111}
        .sf-actions{display:flex;gap:12px}
        .sf-btn{padding:10px 18px;border-radius:8px;font-size:14px;font-weight:500;cursor:pointer;border:none;display:flex;align-items:center;gap:8px}
        .sf-btn.primary{background:#4f46e5;color:#fff}
        .sf-btn.primary:hover{background:#4338ca}
        .sf-btn.secondary{background:#fff;border:1px solid #e5e7eb;color:#374151}
        .sf-btn.secondary:hover{background:#f9fafb}
        .sf-btn.success{background:#22c55e;color:#fff}
        .sf-btn:disabled{opacity:.5;cursor:not-allowed}
        .sf-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media(max-width:1000px){.sf-grid{grid-template-columns:1fr}}
        .sf-panel{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .sf-panel-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .sf-panel-title{font-size:15px;font-weight:600;color:#111;display:flex;align-items:center;gap:8px}
        .sf-panel-badge{padding:4px 10px;background:#fee2e2;color:#dc2626;border-radius:12px;font-size:12px;font-weight:600}
        .sf-panel-body{padding:16px}
        .sf-list{display:flex;flex-direction:column;gap:12px}
        .sf-item{padding:16px;border:1px solid #e5e7eb;border-radius:10px;transition:all .15s}
        .sf-item:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .sf-item-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px}
        .sf-item-name{font-weight:600;color:#111}
        .sf-item-time{font-size:12px;color:#6b7280;display:flex;align-items:center;gap:6px}
        .sf-item-countdown{padding:4px 8px;background:#fef3c7;color:#92400e;border-radius:6px;font-weight:600}
        .sf-item-message{font-size:13px;color:#374151;background:#f9fafb;padding:10px;border-radius:6px;margin-bottom:10px}
        .sf-item-actions{display:flex;gap:8px}
        .sf-item-btn{padding:6px 12px;font-size:12px;border-radius:6px;cursor:pointer;border:none}
        .sf-item-btn.send{background:#22c55e;color:#fff}
        .sf-item-btn.cancel{background:#fee2e2;color:#dc2626}
        .sf-item-btn.edit{background:#f3f4f6;color:#374151}
        .sf-suggest{padding:16px;background:#fefce8;border:1px solid #fef08a;border-radius:10px;margin-bottom:12px}
        .sf-suggest-header{display:flex;align-items:center;gap:8px;font-weight:600;color:#854d0e;margin-bottom:8px}
        .sf-suggest-text{font-size:13px;color:#a16207}
        .sf-empty{text-align:center;padding:40px;color:#9ca3af}
        .sf-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .sf-modal-content{background:#fff;border-radius:16px;padding:24px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto}
        .sf-modal-title{font-size:18px;font-weight:600;margin-bottom:20px}
        .sf-form-group{margin-bottom:16px}
        .sf-form-label{display:block;font-size:13px;font-weight:500;color:#374151;margin-bottom:6px}
        .sf-form-input,.sf-form-select,.sf-form-textarea{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px}
        .sf-form-textarea{min-height:100px;resize:vertical;font-family:inherit}
        .sf-modal-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:20px}
        .sf-ai-tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:#f3e8ff;color:#7c3aed;border-radius:4px;font-size:10px;font-weight:600}
      `}</style>

      {/* Header */}
      <div className="sf-header">
        <h1 className="sf-title">📅 Scheduled Follow-ups</h1>
        <div className="sf-actions">
          <button 
            className="sf-btn secondary"
            onClick={autoScheduleFollowups}
            disabled={autoScheduling || candidatesNeedingFollowup.length === 0}
          >
            {autoScheduling ? '⏳ Scheduling...' : `🤖 Auto-Schedule (${candidatesNeedingFollowup.length})`}
          </button>
          <button className="sf-btn primary" onClick={() => setShowCreate(true)}>
            + Create Follow-up
          </button>
        </div>
      </div>

      <div className="sf-grid">
        {/* Pending Followups */}
        <div className="sf-panel">
          <div className="sf-panel-header">
            <span className="sf-panel-title">
              ⏰ Pending Follow-ups
              {followups.length > 0 && <span className="sf-panel-badge">{followups.length}</span>}
            </span>
          </div>
          <div className="sf-panel-body">
            {loading ? (
              <div className="sf-empty">Loading...</div>
            ) : followups.length === 0 ? (
              <div className="sf-empty">
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                No scheduled follow-ups
              </div>
            ) : (
              <div className="sf-list">
                {followups.map(f => (
                  <div key={f.id} className="sf-item">
                    <div className="sf-item-header">
                      <div>
                        <span className="sf-item-name">{f.candidates?.name || 'Unknown'}</span>
                        {f.ai_generated && <span className="sf-ai-tag">🤖 AI</span>}
                      </div>
                      <div className="sf-item-time">
                        <span className="sf-item-countdown">{getTimeUntil(f.scheduled_for)}</span>
                        <span>{formatDateTime(f.scheduled_for)}</span>
                      </div>
                    </div>
                    <div className="sf-item-message">"{f.message_text}"</div>
                    <div className="sf-item-actions">
                      <button className="sf-item-btn send" onClick={() => sendNow(f)}>
                        📤 Send Now
                      </button>
                      <button className="sf-item-btn cancel" onClick={() => cancelFollowup(f.id)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suggested Followups */}
        <div className="sf-panel">
          <div className="sf-panel-header">
            <span className="sf-panel-title">
              💡 Needs Follow-up
              {candidatesNeedingFollowup.length > 0 && (
                <span className="sf-panel-badge">{candidatesNeedingFollowup.length}</span>
              )}
            </span>
          </div>
          <div className="sf-panel-body">
            {candidatesNeedingFollowup.length === 0 ? (
              <div className="sf-empty">
                <div style={{ fontSize: 32, marginBottom: 8 }}>✨</div>
                All candidates are up to date!
              </div>
            ) : (
              <>
                <div className="sf-suggest">
                  <div className="sf-suggest-header">🤖 AI Suggestion</div>
                  <div className="sf-suggest-text">
                    {candidatesNeedingFollowup.length} candidates haven't been followed up with. 
                    Click "Auto-Schedule" to create AI-generated follow-up messages for all of them.
                  </div>
                </div>
                <div className="sf-list">
                  {candidatesNeedingFollowup.slice(0, 5).map(c => (
                    <div key={c.id} className="sf-item">
                      <div className="sf-item-header">
                        <span className="sf-item-name">{c.name || 'Unknown'}</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          {c.latest_intent || 'No response'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                        Last SMS: {c.last_sms_at ? formatDateTime(c.last_sms_at) : 'Never'}
                      </div>
                      <button 
                        className="sf-btn secondary" 
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                          setSelectedCandidate(c.id);
                          generateAIMessage(c);
                          setShowCreate(true);
                        }}
                      >
                        Schedule Follow-up
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="sf-modal" onClick={() => setShowCreate(false)}>
          <div className="sf-modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="sf-modal-title">Create Follow-up</h2>
            
            <div className="sf-form-group">
              <label className="sf-form-label">Candidate</label>
              <select 
                className="sf-form-select"
                value={selectedCandidate}
                onChange={e => setSelectedCandidate(e.target.value)}
              >
                <option value="">Select candidate...</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.phone_e164}</option>
                ))}
              </select>
            </div>

            <div className="sf-form-group">
              <label className="sf-form-label">Scheduled Time</label>
              <input 
                type="datetime-local"
                className="sf-form-input"
                value={followupTime}
                onChange={e => setFollowupTime(e.target.value)}
              />
            </div>

            <div className="sf-form-group">
              <label className="sf-form-label">Type</label>
              <select 
                className="sf-form-select"
                value={followupType}
                onChange={e => setFollowupType(e.target.value as any)}
              >
                <option value="sms">SMS</option>
                <option value="call_reminder">Call Reminder</option>
              </select>
            </div>

            <div className="sf-form-group">
              <label className="sf-form-label">
                Message
                <button 
                  onClick={() => {
                    const c = candidates.find(c => c.id === selectedCandidate);
                    if (c) generateAIMessage(c);
                  }}
                  disabled={!selectedCandidate || generating}
                  style={{ marginLeft: 8, padding: '4px 8px', fontSize: 11, background: '#f3e8ff', color: '#7c3aed', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  {generating ? '⏳ Generating...' : '🤖 Generate with AI'}
                </button>
              </label>
              <textarea 
                className="sf-form-textarea"
                value={followupMessage}
                onChange={e => setFollowupMessage(e.target.value)}
                placeholder="Type follow-up message..."
              />
            </div>

            <div className="sf-modal-actions">
              <button className="sf-btn secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button 
                className="sf-btn primary"
                onClick={createFollowup}
                disabled={!selectedCandidate || !followupMessage || !followupTime}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
