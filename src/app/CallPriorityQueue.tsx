'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PriorityCandidate {
  id: string;
  name: string | null;
  phone_e164: string;
  status: string;
  roles: string | null;
  
  // Scoring factors
  sms_interest_level: string | null;
  last_sms_at: string | null;
  last_called_at: string | null;
  energy_score: number | null;
  call_count: number;
  
  // SMS data
  latest_sms_intent: string | null;
  latest_sms_sentiment: string | null;
  latest_sms_message: string | null;
  latest_sms_time: string | null;
  sms_response_count: number;
  
  // Computed
  priority_score: number;
  priority_reason: string;
  time_since_response: number | null;
}

export default function CallPriorityQueue() {
  const [candidates, setCandidates] = useState<PriorityCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'hot' | 'warm' | 'callback'>('all');
  const [calling, setCalling] = useState<string | null>(null);

  useEffect(() => {
    loadPriorityQueue();
    // Refresh every 30 seconds
    const interval = setInterval(loadPriorityQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadPriorityQueue() {
    setLoading(true);

    // Get candidates with their SMS data
    const { data: candidatesData } = await supabase
      .from('candidates')
      .select('*')
      .not('phone_e164', 'is', null)
      .neq('sms_opt_out', true);

    // Get latest SMS for each candidate
    const { data: smsData } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false });

    // Get call counts
    const { data: callData } = await supabase
      .from('call_history')
      .select('phone_e164');

    const callCounts = new Map<string, number>();
    callData?.forEach(c => {
      callCounts.set(c.phone_e164, (callCounts.get(c.phone_e164) || 0) + 1);
    });

    // Group SMS by phone
    const smsByPhone = new Map<string, any>();
    smsData?.forEach(sms => {
      if (!smsByPhone.has(sms.phone_e164)) {
        smsByPhone.set(sms.phone_e164, sms);
      }
    });

    // Calculate priority scores
    const now = Date.now();
    const scored: PriorityCandidate[] = (candidatesData || []).map(c => {
      const latestSms = smsByPhone.get(c.phone_e164);
      const callCount = callCounts.get(c.phone_e164) || 0;
      
      let score = 0;
      let reasons: string[] = [];

      // Factor 1: SMS Intent (0-40 points)
      if (latestSms) {
        switch (latestSms.ai_intent) {
          case 'interested':
            score += 40;
            reasons.push('Expressed interest');
            break;
          case 'callback_request':
            score += 50; // Highest priority
            reasons.push('Requested callback');
            break;
          case 'question':
            score += 30;
            reasons.push('Has questions');
            break;
          case 'not_interested':
            score -= 20;
            break;
        }

        // Factor 2: Sentiment (0-15 points)
        if (latestSms.ai_sentiment === 'positive') {
          score += 15;
          reasons.push('Positive sentiment');
        } else if (latestSms.ai_sentiment === 'negative') {
          score -= 10;
        }

        // Factor 3: Response recency (0-30 points)
        const timeSinceResponse = (now - new Date(latestSms.created_at).getTime()) / 1000 / 60; // minutes
        if (timeSinceResponse < 30) {
          score += 30;
          reasons.push('Replied <30 min ago');
        } else if (timeSinceResponse < 60) {
          score += 25;
          reasons.push('Replied <1 hour ago');
        } else if (timeSinceResponse < 180) {
          score += 15;
          reasons.push('Replied <3 hours ago');
        } else if (timeSinceResponse < 1440) {
          score += 5;
        }
      }

      // Factor 4: Previous call energy (0-15 points)
      if (c.energy_score) {
        if (c.energy_score >= 8) {
          score += 15;
          reasons.push(`High energy (${c.energy_score}/10)`);
        } else if (c.energy_score >= 6) {
          score += 10;
        } else if (c.energy_score >= 4) {
          score += 5;
        }
      }

      // Factor 5: Not called yet bonus
      if (callCount === 0 && latestSms) {
        score += 10;
        reasons.push('First call');
      }

      // Factor 6: Interest level from profile
      switch (c.sms_interest_level) {
        case 'hot':
          score += 20;
          if (!reasons.includes('Expressed interest')) reasons.push('Hot lead');
          break;
        case 'warm':
          score += 10;
          break;
      }

      const timeSinceResponseMs = latestSms ? now - new Date(latestSms.created_at).getTime() : null;

      return {
        ...c,
        latest_sms_intent: latestSms?.ai_intent || null,
        latest_sms_sentiment: latestSms?.ai_sentiment || null,
        latest_sms_message: latestSms?.message_text || null,
        latest_sms_time: latestSms?.created_at || null,
        sms_response_count: smsData?.filter(s => s.phone_e164 === c.phone_e164).length || 0,
        call_count: callCount,
        priority_score: Math.max(0, score),
        priority_reason: reasons.slice(0, 3).join(' • ') || 'No recent activity',
        time_since_response: timeSinceResponseMs ? Math.floor(timeSinceResponseMs / 1000 / 60) : null
      };
    });

    // Sort by priority score
    scored.sort((a, b) => b.priority_score - a.priority_score);

    // Filter to only show candidates with some activity
    const filtered = scored.filter(c => c.priority_score > 0 || c.latest_sms_intent);

    setCandidates(filtered);
    setLoading(false);
  }

  const filteredCandidates = candidates.filter(c => {
    if (filter === 'hot') return c.priority_score >= 50;
    if (filter === 'warm') return c.priority_score >= 20 && c.priority_score < 50;
    if (filter === 'callback') return c.latest_sms_intent === 'callback_request';
    return true;
  });

  const handleCall = (candidate: PriorityCandidate) => {
    setCalling(candidate.id);
    window.location.href = `tel:${candidate.phone_e164}`;
    
    // Log the call attempt
    setTimeout(() => {
      setCalling(null);
      loadPriorityQueue();
    }, 2000);
  };

  const formatTime = (minutes: number | null) => {
    if (minutes === null) return '-';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  const getPriorityColor = (score: number) => {
    if (score >= 50) return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', label: '🔥 Hot' };
    if (score >= 30) return { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', label: '⭐ Warm' };
    if (score >= 10) return { bg: '#fefce8', border: '#fef08a', text: '#ca8a04', label: '📊 Medium' };
    return { bg: '#f9fafb', border: '#e5e7eb', text: '#6b7280', label: '❄️ Low' };
  };

  const getIntentIcon = (intent: string | null) => {
    switch (intent) {
      case 'interested': return '✅';
      case 'callback_request': return '📞';
      case 'question': return '❓';
      case 'not_interested': return '❌';
      default: return '💬';
    }
  };

  const stats = {
    total: candidates.length,
    hot: candidates.filter(c => c.priority_score >= 50).length,
    warm: candidates.filter(c => c.priority_score >= 20 && c.priority_score < 50).length,
    callbacks: candidates.filter(c => c.latest_sms_intent === 'callback_request').length
  };

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .cpq-header{margin-bottom:24px}
        .cpq-title{font-size:24px;font-weight:700;color:#111;margin-bottom:4px;display:flex;align-items:center;gap:12px}
        .cpq-subtitle{font-size:14px;color:#6b7280}
        .cpq-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        .cpq-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center;cursor:pointer;transition:all .15s}
        .cpq-stat:hover{border-color:#d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.05)}
        .cpq-stat.active{border-color:#4f46e5;background:#eef2ff}
        .cpq-stat-value{font-size:32px;font-weight:800}
        .cpq-stat-label{font-size:12px;color:#6b7280;margin-top:4px}
        .cpq-list{display:flex;flex-direction:column;gap:12px}
        .cpq-card{background:#fff;border:2px solid #e5e7eb;border-radius:16px;overflow:hidden;transition:all .2s}
        .cpq-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)}
        .cpq-card-header{padding:16px 20px;display:flex;align-items:center;gap:16px}
        .cpq-priority-badge{padding:8px 14px;border-radius:20px;font-size:12px;font-weight:700;white-space:nowrap}
        .cpq-score{font-size:24px;font-weight:800;min-width:50px;text-align:center}
        .cpq-info{flex:1;min-width:0}
        .cpq-name{font-size:16px;font-weight:600;color:#111;margin-bottom:4px}
        .cpq-phone{font-size:13px;color:#6b7280;font-family:monospace}
        .cpq-meta{display:flex;align-items:center;gap:16px;margin-top:8px}
        .cpq-tag{padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;background:#f3f4f6;color:#374151}
        .cpq-reason{font-size:12px;color:#6b7280;flex:1}
        .cpq-actions{display:flex;gap:8px}
        .cpq-btn{padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;display:flex;align-items:center;gap:8px;transition:all .15s}
        .cpq-btn.call{background:#22c55e;color:#fff}
        .cpq-btn.call:hover{background:#16a34a}
        .cpq-btn.sms{background:#f3f4f6;color:#374151}
        .cpq-btn.sms:hover{background:#e5e7eb}
        .cpq-sms-preview{padding:12px 20px;background:#f9fafb;border-top:1px solid #f3f4f6;font-size:13px;color:#374151}
        .cpq-sms-preview strong{color:#111}
        .cpq-empty{text-align:center;padding:60px;color:#9ca3af}
        .cpq-empty-icon{font-size:48px;margin-bottom:16px;opacity:.5}
        .cpq-timer{font-size:11px;color:#9ca3af;display:flex;align-items:center;gap:4px}
        .cpq-refresh{padding:8px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;cursor:pointer}
        .cpq-refresh:hover{background:#f9fafb}
      `}</style>

      {/* Header */}
      <div className="cpq-header">
        <div className="cpq-title">
          📞 Smart Call Queue
          <button className="cpq-refresh" onClick={loadPriorityQueue}>🔄 Refresh</button>
        </div>
        <p className="cpq-subtitle">AI-ranked candidates based on interest, response time & engagement</p>
      </div>

      {/* Stats */}
      <div className="cpq-stats">
        <div className={`cpq-stat ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <div className="cpq-stat-value">{stats.total}</div>
          <div className="cpq-stat-label">Total Queue</div>
        </div>
        <div className={`cpq-stat ${filter === 'hot' ? 'active' : ''}`} onClick={() => setFilter('hot')}>
          <div className="cpq-stat-value" style={{ color: '#dc2626' }}>{stats.hot}</div>
          <div className="cpq-stat-label">🔥 Hot Leads</div>
        </div>
        <div className={`cpq-stat ${filter === 'warm' ? 'active' : ''}`} onClick={() => setFilter('warm')}>
          <div className="cpq-stat-value" style={{ color: '#ea580c' }}>{stats.warm}</div>
          <div className="cpq-stat-label">⭐ Warm Leads</div>
        </div>
        <div className={`cpq-stat ${filter === 'callback' ? 'active' : ''}`} onClick={() => setFilter('callback')}>
          <div className="cpq-stat-value" style={{ color: '#2563eb' }}>{stats.callbacks}</div>
          <div className="cpq-stat-label">📞 Callback Requests</div>
        </div>
      </div>

      {/* Queue List */}
      <div className="cpq-list">
        {loading ? (
          <div className="cpq-empty">
            <div className="cpq-empty-icon">⏳</div>
            Loading priority queue...
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="cpq-empty">
            <div className="cpq-empty-icon">📭</div>
            <div>No candidates in queue</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Send SMS campaigns to build your call list</div>
          </div>
        ) : (
          filteredCandidates.map((candidate, index) => {
            const priority = getPriorityColor(candidate.priority_score);
            return (
              <div 
                key={candidate.id} 
                className="cpq-card"
                style={{ borderColor: priority.border }}
              >
                <div className="cpq-card-header">
                  <div className="cpq-score" style={{ color: priority.text }}>
                    #{index + 1}
                  </div>
                  <span 
                    className="cpq-priority-badge"
                    style={{ background: priority.bg, color: priority.text, border: `1px solid ${priority.border}` }}
                  >
                    {priority.label} ({candidate.priority_score} pts)
                  </span>
                  <div className="cpq-info">
                    <div className="cpq-name">{candidate.name || 'Unknown Candidate'}</div>
                    <div className="cpq-phone">{candidate.phone_e164}</div>
                    <div className="cpq-meta">
                      {candidate.latest_sms_intent && (
                        <span className="cpq-tag">
                          {getIntentIcon(candidate.latest_sms_intent)} {candidate.latest_sms_intent.replace('_', ' ')}
                        </span>
                      )}
                      {candidate.call_count > 0 && (
                        <span className="cpq-tag">📞 {candidate.call_count} calls</span>
                      )}
                      {candidate.energy_score && (
                        <span className="cpq-tag">⚡ Energy: {candidate.energy_score}/10</span>
                      )}
                      <span className="cpq-reason">{candidate.priority_reason}</span>
                    </div>
                  </div>
                  {candidate.time_since_response !== null && (
                    <div className="cpq-timer">
                      🕐 {formatTime(candidate.time_since_response)}
                    </div>
                  )}
                  <div className="cpq-actions">
                    <button 
                      className="cpq-btn call"
                      onClick={() => handleCall(candidate)}
                      disabled={calling === candidate.id}
                    >
                      {calling === candidate.id ? '📞 Calling...' : '📞 Call Now'}
                    </button>
                  </div>
                </div>
                {candidate.latest_sms_message && (
                  <div className="cpq-sms-preview">
                    <strong>Latest SMS:</strong> "{candidate.latest_sms_message.substring(0, 150)}{candidate.latest_sms_message.length > 150 ? '...' : ''}"
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
