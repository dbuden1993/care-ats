'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CandidateFullProfile {
  id: string;
  name: string | null;
  phone_e164: string;
  email: string | null;
  status: string;
  roles: string | null;
  experience_summary: string | null;
  driver: string | null;
  dbs_update_service: string | null;
  source: string | null;
  created_at: string;
  
  // AI Scores
  ai_score: number | null;
  ai_grade: string | null;
  ai_summary: string | null;
  sms_interest_level: string | null;
  sms_opt_out: boolean;
  
  // Interactions
  calls: CallRecord[];
  smsMessages: SMSRecord[];
  
  // Computed
  totalInteractions: number;
  lastInteraction: string | null;
  timeline: TimelineEvent[];
}

interface CallRecord {
  id: string;
  call_time: string;
  duration: number | null;
  energy_score: number | null;
  quality_assessment: string | null;
  call_summary: string | null;
  key_points: string | null;
}

interface SMSRecord {
  id: string;
  direction: string;
  message_text: string;
  ai_intent: string | null;
  ai_sentiment: string | null;
  ai_summary: string | null;
  created_at: string;
}

interface TimelineEvent {
  type: 'call' | 'sms_out' | 'sms_in' | 'status_change' | 'created';
  timestamp: string;
  title: string;
  description: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  score?: number;
}

interface Props {
  candidateId: string;
  onClose?: () => void;
}

export default function CandidateSummaryModal({ candidateId, onClose }: Props) {
  const [profile, setProfile] = useState<CandidateFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'calls' | 'sms'>('overview');
  const [generatingScore, setGeneratingScore] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [candidateId]);

  async function loadProfile() {
    setLoading(true);

    // Get candidate
    const { data: candidate } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (!candidate) {
      setLoading(false);
      return;
    }

    // Get calls
    const { data: calls } = await supabase
      .from('call_history')
      .select('*')
      .eq('phone_e164', candidate.phone_e164)
      .order('call_time', { ascending: false });

    // Get SMS
    const { data: smsMessages } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('phone_e164', candidate.phone_e164)
      .order('created_at', { ascending: false });

    // Build timeline
    const timeline: TimelineEvent[] = [];

    // Add created event
    timeline.push({
      type: 'created',
      timestamp: candidate.created_at,
      title: 'Candidate Added',
      description: `Added from ${candidate.source || 'manual entry'}`,
      sentiment: 'neutral'
    });

    // Add calls
    (calls || []).forEach(call => {
      timeline.push({
        type: 'call',
        timestamp: call.call_time,
        title: `Phone Call${call.duration ? ` (${Math.round(call.duration / 60)}m)` : ''}`,
        description: call.call_summary || 'No summary recorded',
        sentiment: call.energy_score && call.energy_score >= 7 ? 'positive' : call.energy_score && call.energy_score <= 4 ? 'negative' : 'neutral',
        score: call.energy_score
      });
    });

    // Add SMS
    (smsMessages || []).forEach(sms => {
      timeline.push({
        type: sms.direction === 'outbound' ? 'sms_out' : 'sms_in',
        timestamp: sms.created_at,
        title: sms.direction === 'outbound' ? 'SMS Sent' : 'SMS Received',
        description: sms.direction === 'inbound' && sms.ai_summary ? sms.ai_summary : sms.message_text.substring(0, 100),
        sentiment: sms.ai_sentiment as any || 'neutral'
      });
    });

    // Sort timeline
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const allInteractions = [...(calls || []), ...(smsMessages || [])];
    const lastInteraction = allInteractions.length > 0
      ? allInteractions.sort((a, b) => 
          new Date((b as any).call_time || (b as any).created_at).getTime() - 
          new Date((a as any).call_time || (a as any).created_at).getTime()
        )[0]
      : null;

    setProfile({
      ...candidate,
      calls: calls || [],
      smsMessages: smsMessages || [],
      totalInteractions: allInteractions.length,
      lastInteraction: lastInteraction ? ((lastInteraction as any).call_time || (lastInteraction as any).created_at) : null,
      timeline
    });

    setLoading(false);
  }

  async function recalculateScore() {
    setGeneratingScore(true);
    try {
      await fetch('/api/candidates/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId })
      });
      await loadProfile();
    } catch (error) {
      console.error('Score calculation error:', error);
    }
    setGeneratingScore(false);
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return formatDate(dateStr);
  };

  const getGradeColor = (grade: string | null) => {
    switch (grade) {
      case 'A': return { bg: '#dcfce7', text: '#166534' };
      case 'B': return { bg: '#dbeafe', text: '#1e40af' };
      case 'C': return { bg: '#fef3c7', text: '#92400e' };
      case 'D': return { bg: '#fed7aa', text: '#c2410c' };
      default: return { bg: '#fee2e2', text: '#991b1b' };
    }
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      default: return '😐';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞';
      case 'sms_out': return '📤';
      case 'sms_in': return '📥';
      case 'created': return '✨';
      default: return '📌';
    }
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
        <div style={{ background: '#fff', padding: 40, borderRadius: 16, textAlign: 'center' }}>
          Loading candidate profile...
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const gradeColors = getGradeColor(profile.ai_grade);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <style>{`
        .cs-modal{background:#fff;border-radius:20px;width:100%;max-width:800px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column}
        .cs-header{padding:24px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:start}
        .cs-header-info h2{font-size:24px;font-weight:700;color:#111;margin:0 0 4px}
        .cs-header-info p{font-size:14px;color:#6b7280;margin:0}
        .cs-close{width:36px;height:36px;border-radius:10px;border:none;background:#f3f4f6;cursor:pointer;font-size:18px}
        .cs-close:hover{background:#e5e7eb}
        .cs-score-card{display:flex;align-items:center;gap:16px;padding:16px 24px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
        .cs-grade{width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800}
        .cs-score-info{flex:1}
        .cs-score-bar{height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:6px}
        .cs-score-fill{height:100%;border-radius:4px;background:linear-gradient(to right,#4f46e5,#22c55e)}
        .cs-score-text{font-size:13px;color:#374151}
        .cs-recalc{padding:8px 14px;border-radius:8px;border:1px solid #e5e7eb;background:#fff;font-size:12px;cursor:pointer}
        .cs-recalc:hover{background:#f9fafb}
        .cs-tabs{display:flex;border-bottom:1px solid #e5e7eb;padding:0 24px}
        .cs-tab{padding:12px 20px;font-size:14px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent}
        .cs-tab:hover{color:#111}
        .cs-tab.active{color:#4f46e5;border-bottom-color:#4f46e5}
        .cs-body{flex:1;overflow-y:auto;padding:24px}
        .cs-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
        .cs-stat{text-align:center;padding:16px;background:#f9fafb;border-radius:12px}
        .cs-stat-value{font-size:24px;font-weight:700;color:#111}
        .cs-stat-label{font-size:11px;color:#6b7280;margin-top:4px}
        .cs-section{margin-bottom:24px}
        .cs-section-title{font-size:14px;font-weight:600;color:#111;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .cs-timeline{display:flex;flex-direction:column;gap:0}
        .cs-event{display:flex;gap:16px;padding:16px 0;border-bottom:1px solid #f3f4f6}
        .cs-event:last-child{border-bottom:none}
        .cs-event-icon{width:40px;height:40px;border-radius:10px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .cs-event-content{flex:1;min-width:0}
        .cs-event-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
        .cs-event-title{font-weight:600;color:#111;font-size:14px}
        .cs-event-time{font-size:12px;color:#9ca3af}
        .cs-event-desc{font-size:13px;color:#374151;line-height:1.5}
        .cs-event-score{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;margin-top:8px}
        .cs-call-card{padding:16px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px}
        .cs-call-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .cs-call-date{font-weight:600;color:#111}
        .cs-call-badges{display:flex;gap:8px}
        .cs-badge{padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600}
        .cs-call-summary{font-size:13px;color:#374151;background:#f9fafb;padding:12px;border-radius:8px;line-height:1.5}
        .cs-sms-list{display:flex;flex-direction:column;gap:8px}
        .cs-sms{padding:12px 16px;border-radius:12px;max-width:85%}
        .cs-sms.out{background:#4f46e5;color:#fff;align-self:flex-end}
        .cs-sms.in{background:#f3f4f6;color:#111;align-self:flex-start}
        .cs-sms-text{font-size:13px;line-height:1.5}
        .cs-sms-meta{font-size:10px;opacity:0.7;margin-top:6px}
        .cs-sms-ai{margin-top:8px;padding:8px 10px;background:#fefce8;border-radius:6px;font-size:11px;color:#854d0e}
        .cs-actions{padding:16px 24px;border-top:1px solid #e5e7eb;display:flex;gap:12px}
        .cs-btn{padding:12px 20px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;border:none;flex:1}
        .cs-btn.primary{background:#22c55e;color:#fff}
        .cs-btn.secondary{background:#f3f4f6;color:#374151}
      `}</style>

      <div className="cs-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cs-header">
          <div className="cs-header-info">
            <h2>{profile.name || 'Unknown Candidate'}</h2>
            <p>{profile.phone_e164} • {profile.roles || 'Care Worker'}</p>
          </div>
          <button className="cs-close" onClick={onClose}>✕</button>
        </div>

        {/* Score Card */}
        <div className="cs-score-card">
          <div className="cs-grade" style={{ background: gradeColors.bg, color: gradeColors.text }}>
            {profile.ai_grade || '?'}
          </div>
          <div className="cs-score-info">
            <div className="cs-score-bar">
              <div className="cs-score-fill" style={{ width: `${profile.ai_score || 0}%` }} />
            </div>
            <div className="cs-score-text">
              <strong>{profile.ai_score || 0}/100</strong> AI Score • {profile.ai_summary || 'No AI summary available'}
            </div>
          </div>
          <button className="cs-recalc" onClick={recalculateScore} disabled={generatingScore}>
            {generatingScore ? '⏳' : '🔄'} Recalculate
          </button>
        </div>

        {/* Tabs */}
        <div className="cs-tabs">
          {(['overview', 'timeline', 'calls', 'sms'] as const).map(tab => (
            <div 
              key={tab} 
              className={`cs-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'timeline' && `📅 Timeline (${profile.timeline.length})`}
              {tab === 'calls' && `📞 Calls (${profile.calls.length})`}
              {tab === 'sms' && `💬 SMS (${profile.smsMessages.length})`}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="cs-body">
          {activeTab === 'overview' && (
            <>
              <div className="cs-stats">
                <div className="cs-stat">
                  <div className="cs-stat-value">{profile.totalInteractions}</div>
                  <div className="cs-stat-label">Total Interactions</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-value">{profile.calls.length}</div>
                  <div className="cs-stat-label">Calls</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-value">{profile.smsMessages.filter(s => s.direction === 'inbound').length}</div>
                  <div className="cs-stat-label">SMS Responses</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-value">
                    {profile.calls.length > 0 
                      ? Math.round(profile.calls.reduce((sum, c) => sum + (c.energy_score || 0), 0) / profile.calls.length)
                      : '-'}
                  </div>
                  <div className="cs-stat-label">Avg Energy</div>
                </div>
              </div>

              <div className="cs-section">
                <div className="cs-section-title">📋 Profile</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                  <div><strong>Status:</strong> {profile.status}</div>
                  <div><strong>Source:</strong> {profile.source || 'Unknown'}</div>
                  <div><strong>Driver:</strong> {profile.driver || 'Unknown'}</div>
                  <div><strong>DBS:</strong> {profile.dbs_update_service || 'Unknown'}</div>
                  <div><strong>Interest Level:</strong> {profile.sms_interest_level || 'Unknown'}</div>
                  <div><strong>Added:</strong> {formatDate(profile.created_at)}</div>
                </div>
              </div>

              {profile.experience_summary && (
                <div className="cs-section">
                  <div className="cs-section-title">💼 Experience</div>
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{profile.experience_summary}</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'timeline' && (
            <div className="cs-timeline">
              {profile.timeline.map((event, i) => (
                <div key={i} className="cs-event">
                  <div className="cs-event-icon">{getEventIcon(event.type)}</div>
                  <div className="cs-event-content">
                    <div className="cs-event-header">
                      <span className="cs-event-title">{event.title}</span>
                      <span className="cs-event-time">{formatTimeAgo(event.timestamp)}</span>
                    </div>
                    <div className="cs-event-desc">{event.description}</div>
                    {event.score && (
                      <div className="cs-event-score" style={{ 
                        background: event.score >= 7 ? '#dcfce7' : event.score <= 4 ? '#fee2e2' : '#f3f4f6',
                        color: event.score >= 7 ? '#166534' : event.score <= 4 ? '#991b1b' : '#374151'
                      }}>
                        ⚡ Energy: {event.score}/10
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'calls' && (
            <>
              {profile.calls.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No calls recorded</div>
              ) : (
                profile.calls.map(call => (
                  <div key={call.id} className="cs-call-card">
                    <div className="cs-call-header">
                      <span className="cs-call-date">{formatDate(call.call_time)}</span>
                      <div className="cs-call-badges">
                        {call.quality_assessment && (
                          <span className="cs-badge" style={{ background: getGradeColor(call.quality_assessment).bg, color: getGradeColor(call.quality_assessment).text }}>
                            Grade {call.quality_assessment}
                          </span>
                        )}
                        {call.energy_score && (
                          <span className="cs-badge" style={{ 
                            background: call.energy_score >= 7 ? '#dcfce7' : call.energy_score <= 4 ? '#fee2e2' : '#fef3c7',
                            color: call.energy_score >= 7 ? '#166534' : call.energy_score <= 4 ? '#991b1b' : '#92400e'
                          }}>
                            ⚡ {call.energy_score}/10
                          </span>
                        )}
                      </div>
                    </div>
                    {call.call_summary && (
                      <div className="cs-call-summary">{call.call_summary}</div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'sms' && (
            <div className="cs-sms-list">
              {profile.smsMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>No SMS messages</div>
              ) : (
                profile.smsMessages.slice().reverse().map(sms => (
                  <div key={sms.id} className={`cs-sms ${sms.direction === 'outbound' ? 'out' : 'in'}`}>
                    <div className="cs-sms-text">{sms.message_text}</div>
                    <div className="cs-sms-meta">{formatTimeAgo(sms.created_at)}</div>
                    {sms.direction === 'inbound' && sms.ai_summary && (
                      <div className="cs-sms-ai">
                        🤖 {sms.ai_summary}
                        {sms.ai_intent && <span> • Intent: {sms.ai_intent}</span>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="cs-actions">
          <a href={`tel:${profile.phone_e164}`} className="cs-btn primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
            📞 Call Now
          </a>
          <button className="cs-btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
