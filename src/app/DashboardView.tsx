'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DashboardViewProps {
  candidates: any[];
  jobs: any[];
  onNavigate: (action: string, data?: any) => void;
}

interface DashboardStats {
  totalCandidates: number;
  calledCandidates: number;
  importedPool: number;
  gradeACandidates: number;
  callsToday: number;
  callsThisWeek: number;
  pendingProcessing: number;
  avgEnergyScore: number | null;
}

interface RecentCall {
  call_id: string;
  phone_e164: string;
  candidate_name: string | null;
  energy_score: number | null;
  quality_assessment: string | null;
  call_summary: string | null;
  call_time: string;
  processing_status: string;
  direction: string;
  duration_ms: number | null;
}

interface PipelineCounts {
  new: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
}

export default function DashboardView({ candidates, jobs, onNavigate }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalCandidates: 0,
    calledCandidates: 0,
    importedPool: 0,
    gradeACandidates: 0,
    callsToday: 0,
    callsThisWeek: 0,
    pendingProcessing: 0,
    avgEnergyScore: null,
  });
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [pipeline, setPipeline] = useState<PipelineCounts>({ new: 0, screening: 0, interview: 0, offer: 0, hired: 0 });
  const [loading, setLoading] = useState(true);
  const [priorities, setPriorities] = useState<{ urgentWA: number; overdueFollowUps: number; interviewStage: number; waRepliesNeeded: number }>({ urgentWA: 0, overdueFollowUps: 0, interviewStage: 0, waRepliesNeeded: 0 });
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessResult, setReprocessResult] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();

      // Parallel queries for speed
      const [
        totalRes,
        calledRes,
        importedRes,
        gradeARes,
        callsTodayRes,
        callsWeekRes,
        pendingRes,
        recentCallsRes,
        pipelineRes,
        energyRes,
      ] = await Promise.all([
        // Total candidates
        supabase.from('candidates').select('*', { count: 'exact', head: true }),
        // Called candidates (have been called at least once)
        supabase.from('candidates').select('*', { count: 'exact', head: true }).not('last_called_at', 'is', null),
        // Imported pool (never called)
        supabase.from('candidates').select('*', { count: 'exact', head: true }).is('last_called_at', null),
        // Grade A candidates from call_history
        supabase.from('call_history').select('*', { count: 'exact', head: true }).eq('quality_assessment', 'A'),
        // Calls today
        supabase.from('call_history').select('*', { count: 'exact', head: true }).gte('call_time', todayStart),
        // Calls this week
        supabase.from('call_history').select('*', { count: 'exact', head: true }).gte('call_time', weekStart),
        // Pending processing
        supabase.from('call_history').select('*', { count: 'exact', head: true }).eq('processing_status', 'pending'),
        // Recent calls (last 10)
        supabase.from('call_history')
          .select('call_id, phone_e164, candidate_name, energy_score, quality_assessment, call_summary, call_time, processing_status, direction, duration_ms')
          .order('call_time', { ascending: false })
          .limit(10),
        // Pipeline counts - get all candidates with status
        supabase.from('candidates')
          .select('status')
          .not('last_called_at', 'is', null),
        // Average energy score
        supabase.from('call_history')
          .select('energy_score')
          .not('energy_score', 'is', null)
          .limit(100),
      ]);

      // Compute pipeline counts
      const pipelineCounts: PipelineCounts = { new: 0, screening: 0, interview: 0, offer: 0, hired: 0 };
      (pipelineRes.data || []).forEach((c: any) => {
        const s = c.status as keyof PipelineCounts;
        if (s in pipelineCounts) pipelineCounts[s]++;
      });

      // Compute average energy
      const energyScores = (energyRes.data || []).map((r: any) => r.energy_score).filter((s: any) => typeof s === 'number');
      const avgEnergy = energyScores.length > 0 ? energyScores.reduce((a: number, b: number) => a + b, 0) / energyScores.length : null;

      setStats({
        totalCandidates: totalRes.count ?? 0,
        calledCandidates: calledRes.count ?? 0,
        importedPool: importedRes.count ?? 0,
        gradeACandidates: gradeARes.count ?? 0,
        callsToday: callsTodayRes.count ?? 0,
        callsThisWeek: callsWeekRes.count ?? 0,
        pendingProcessing: pendingRes.count ?? 0,
        avgEnergyScore: avgEnergy,
      });

      setRecentCalls(recentCallsRes.data || []);
      setPipeline(pipelineCounts);

      // Fetch today's priorities — use 7-day window to match the WhatsApp inbox
      const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const cutoff14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const [urgentWARes, overdueRes, interviewRes, waInboxRes] = await Promise.all([
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound').eq('ai_suggested_action', 'urgent_response').gte('captured_at', cutoff7d),
        supabase.from('candidates').select('*', { count: 'exact', head: true })
          .in('status', ['new', 'screening']).or(`last_called_at.is.null,last_called_at.lt.${cutoff14d}`),
        supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('status', 'interview'),
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true })
          .eq('direction', 'inbound').neq('ai_suggested_action', 'no_action').gte('captured_at', cutoff7d),
      ]);
      setPriorities({
        urgentWA: urgentWARes.count ?? 0,
        overdueFollowUps: overdueRes.count ?? 0,
        interviewStage: interviewRes.count ?? 0,
        waRepliesNeeded: waInboxRes.count ?? 0,
      });
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 2 minutes — dashboard is a summary view, not real-time
    const interval = setInterval(fetchDashboardData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Auto-reprocess pending calls whenever they appear — no manual click needed
  useEffect(() => {
    if (stats.pendingProcessing > 0 && !reprocessing) {
      reprocessCalls();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.pendingProcessing]);

  const reprocessCalls = async () => {
    setReprocessing(true);
    setReprocessResult(null);
    try {
      const res = await fetch('/api/dialpad/reprocess?all=true', { method: 'POST' });
      const data = await res.json();
      const count = data.results?.length || 0;
      setReprocessResult(count > 0 ? `✓ Triggered ${count} call(s) for processing` : 'No pending calls found');
      // Refresh stats after a short delay
      setTimeout(fetchDashboardData, 3000);
    } catch {
      setReprocessResult('Failed to trigger reprocessing');
    }
    setReprocessing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const formatTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const gradeColor = (grade: string | null) => {
    switch (grade) {
      case 'A': return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' };
      case 'B': return { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' };
      case 'C': return { bg: '#fef9c3', color: '#a16207', border: '#fef08a' };
      case 'D': return { bg: '#fed7aa', color: '#c2410c', border: '#fdba74' };
      case 'F': return { bg: '#fecaca', color: '#dc2626', border: '#fca5a5' };
      default: return { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
    }
  };

  const energyColor = (score: number | null) => {
    if (!score) return '#9ca3af';
    if (score >= 8) return '#15803d';
    if (score >= 6) return '#2563eb';
    if (score >= 4) return '#d97706';
    return '#dc2626';
  };

  const processingBadge = (status: string) => {
    switch (status) {
      case 'completed': return null;
      case 'processing': return { label: 'Processing...', bg: '#dbeafe', color: '#2563eb' };
      case 'pending': return { label: 'Queued', bg: '#fef9c3', color: '#a16207' };
      case 'failed': return { label: 'Failed', bg: '#fecaca', color: '#dc2626' };
      case 'no_recording': return { label: 'No recording', bg: '#f3f4f6', color: '#6b7280' };
      default: return null;
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        .dash-header { margin-bottom: 28px; }
        .dash-greeting { font-size: 26px; font-weight: 800; color: #111827; letter-spacing: -0.5px; }
        .dash-subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
        .stat-tile {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px;
          cursor: pointer; transition: all 0.15s ease;
          position: relative; overflow: hidden;
        }
        .stat-tile:hover { border-color: #c7d2fe; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .stat-tile .accent-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .stat-number { font-size: 32px; font-weight: 800; color: #111827; line-height: 1; }
        .stat-label { font-size: 12px; font-weight: 600; color: #6b7280; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat-detail { font-size: 11px; color: #9ca3af; margin-top: 4px; }

        .dash-grid { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
        .dash-section {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
          overflow: hidden;
        }
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid #f3f4f6;
        }
        .section-title { font-size: 15px; font-weight: 700; color: #111827; display: flex; align-items: center; gap: 8px; }
        .section-link {
          font-size: 12px; font-weight: 600; color: #4f46e5; cursor: pointer;
          text-decoration: none; transition: color 0.15s;
        }
        .section-link:hover { color: #3730a3; }

        .call-row {
          display: flex; align-items: center; gap: 14px; padding: 14px 20px;
          border-bottom: 1px solid #f9fafb; cursor: pointer; transition: background 0.1s;
        }
        .call-row:last-child { border-bottom: none; }
        .call-row:hover { background: #fafbfc; }
        .call-avatar {
          width: 40px; height: 40px; border-radius: 10px; display: flex;
          align-items: center; justify-content: center; font-weight: 700;
          font-size: 14px; flex-shrink: 0;
        }
        .call-info { flex: 1; min-width: 0; }
        .call-name { font-size: 13px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .call-phone { font-size: 11px; color: #9ca3af; font-family: 'SF Mono', 'Fira Code', monospace; letter-spacing: 0.3px; }
        .call-summary { font-size: 11px; color: #6b7280; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
        .call-meta { text-align: right; flex-shrink: 0; }
        .call-energy { font-size: 22px; font-weight: 800; line-height: 1; }
        .call-energy-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .call-time { font-size: 11px; color: #9ca3af; margin-top: 2px; }

        .grade-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 7px; font-size: 12px;
          font-weight: 800; border: 1.5px solid;
        }
        .processing-badge {
          display: inline-block; padding: 2px 8px; border-radius: 6px;
          font-size: 10px; font-weight: 600;
        }

        .pipeline-bar { padding: 20px; }
        .pipeline-stage {
          display: flex; align-items: center; gap: 12px; padding: 10px 0;
          border-bottom: 1px solid #f9fafb;
        }
        .pipeline-stage:last-child { border-bottom: none; }
        .pipeline-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .pipeline-label { font-size: 13px; color: #374151; flex: 1; font-weight: 500; }
        .pipeline-count { font-size: 15px; font-weight: 800; color: #111827; min-width: 30px; text-align: right; }
        .pipeline-bar-fill {
          height: 6px; border-radius: 3px; transition: width 0.5s ease;
        }

        .quick-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 16px 20px; }
        .quick-btn {
          display: flex; align-items: center; gap: 10px; padding: 12px 14px;
          border: 1px solid #e5e7eb; border-radius: 10px; cursor: pointer;
          background: #fff; font-size: 12px; font-weight: 600; color: #374151;
          transition: all 0.15s;
        }
        .quick-btn:hover { background: #f9fafb; border-color: #c7d2fe; color: #4f46e5; }
        .quick-btn .qicon { font-size: 16px; }

        .empty-calls { padding: 40px 20px; text-align: center; color: #9ca3af; font-size: 13px; }

        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f3f4f6 0px, #e5e7eb 40px, #f3f4f6 80px);
          background-size: 200px 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
      `}</style>

      {/* Header */}
      <div className="dash-header">
        <div className="dash-greeting">{greeting()}! 👋</div>
        <div className="dash-subtitle">
          Here&apos;s what needs your attention today
          {stats.pendingProcessing > 0 && (
            <button
              onClick={reprocessCalls}
              disabled={reprocessing}
              title="Reprocess queued calls"
              style={{ marginLeft: 12, padding: '2px 10px', background: reprocessing ? '#e5e7eb' : '#fef9c3', color: reprocessing ? '#9ca3af' : '#a16207', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fde68a', cursor: reprocessing ? 'not-allowed' : 'pointer' }}
            >
              {reprocessing ? '⏳ Processing...' : `⚡ ${stats.pendingProcessing} queued — reprocess`}
            </button>
          )}
          {reprocessResult && (
            <span style={{ marginLeft: 8, fontSize: 11, color: '#059669' }}>{reprocessResult}</span>
          )}
        </div>
      </div>

      {/* Today's priorities strip */}
      {!loading && (priorities.urgentWA > 0 || priorities.overdueFollowUps > 0 || priorities.interviewStage > 0 || priorities.waRepliesNeeded > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          {priorities.urgentWA > 0 && (
            <button onClick={() => onNavigate('assistant')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
              🚨 {priorities.urgentWA} urgent WhatsApp{priorities.urgentWA !== 1 ? 's' : ''} — reply now
            </button>
          )}
          {priorities.waRepliesNeeded > 0 && priorities.urgentWA === 0 && (
            <button onClick={() => onNavigate('assistant')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#059669' }}>
              💬 {priorities.waRepliesNeeded} WhatsApp message{priorities.waRepliesNeeded !== 1 ? 's' : ''} to action
            </button>
          )}
          {priorities.overdueFollowUps > 0 && (
            <button onClick={() => onNavigate('assistant')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#d97706' }}>
              📞 {priorities.overdueFollowUps} candidate{priorities.overdueFollowUps !== 1 ? 's' : ''} overdue for follow-up
            </button>
          )}
          {priorities.interviewStage > 0 && (
            <button onClick={() => onNavigate('candidates', { status: 'interview' })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#4f46e5' }}>
              📅 {priorities.interviewStage} in interview stage
            </button>
          )}
        </div>
      )}

      {/* Stats tiles */}
      <div className="stats-grid">
        <div className="stat-tile" onClick={() => onNavigate('call-history')}>
          <div className="accent-bar" style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
          {loading ? (
            <div className="skeleton" style={{ width: 60, height: 36, marginBottom: 8 }} />
          ) : (
            <div className="stat-number">{stats.callsToday}</div>
          )}
          <div className="stat-label">Calls Today</div>
          <div className="stat-detail">{stats.callsThisWeek} this week</div>
        </div>

        <div className="stat-tile" onClick={() => onNavigate('candidate-dashboard')}>
          <div className="accent-bar" style={{ background: 'linear-gradient(90deg, #059669, #10b981)' }} />
          {loading ? (
            <div className="skeleton" style={{ width: 40, height: 36, marginBottom: 8 }} />
          ) : (
            <div className="stat-number" style={{ color: '#059669' }}>{stats.gradeACandidates}</div>
          )}
          <div className="stat-label">Grade A Candidates</div>
          <div className="stat-detail">
            {stats.avgEnergyScore !== null ? `Avg energy: ${stats.avgEnergyScore.toFixed(1)}/10` : 'No scores yet'}
          </div>
        </div>

        <div className="stat-tile" onClick={() => onNavigate('candidate-dashboard')}>
          <div className="accent-bar" style={{ background: 'linear-gradient(90deg, #2563eb, #3b82f6)' }} />
          {loading ? (
            <div className="skeleton" style={{ width: 50, height: 36, marginBottom: 8 }} />
          ) : (
            <div className="stat-number">{stats.calledCandidates}</div>
          )}
          <div className="stat-label">Total Called</div>
          <div className="stat-detail">of {stats.totalCandidates} total candidates</div>
        </div>

        <div className="stat-tile" onClick={() => onNavigate('imported')}>
          <div className="accent-bar" style={{ background: 'linear-gradient(90deg, #d97706, #f59e0b)' }} />
          {loading ? (
            <div className="skeleton" style={{ width: 50, height: 36, marginBottom: 8 }} />
          ) : (
            <div className="stat-number" style={{ color: '#d97706' }}>{stats.importedPool}</div>
          )}
          <div className="stat-label">To Contact</div>
          <div className="stat-detail">Imported, not yet called</div>
        </div>
      </div>

      {/* Main grid: Calls + Sidebar */}
      <div className="dash-grid">
        {/* Recent Calls */}
        <div className="dash-section">
          <div className="section-header">
            <div className="section-title">📞 Recent Calls</div>
            <span className="section-link" onClick={() => onNavigate('candidate-dashboard')}>View all →</span>
          </div>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0' }}>
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: 120, height: 14, marginBottom: 6 }} />
                    <div className="skeleton" style={{ width: 90, height: 10 }} />
                  </div>
                  <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 8 }} />
                </div>
              ))}
            </div>
          ) : recentCalls.length === 0 ? (
            <div className="empty-calls">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📞</div>
              <div>No calls recorded yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Calls from Dialpad will appear here automatically</div>
            </div>
          ) : (
            recentCalls.map((call) => {
              const gc = gradeColor(call.quality_assessment);
              const badge = processingBadge(call.processing_status);
              const initial = call.candidate_name
                ? call.candidate_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '?';
              const avatarBg = call.candidate_name
                ? `hsl(${call.candidate_name.charCodeAt(0) * 7 % 360}, 55%, 55%)`
                : '#d1d5db';

              return (
                <div key={call.call_id} className="call-row" onClick={() => onNavigate('candidate-dashboard')}>
                  <div className="call-avatar" style={{ background: avatarBg, color: '#fff' }}>
                    {initial}
                  </div>
                  <div className="call-info">
                    <div className="call-name">
                      {call.candidate_name || 'Unknown'}
                      {call.quality_assessment && (
                        <span
                          className="grade-badge"
                          style={{ background: gc.bg, color: gc.color, borderColor: gc.border, marginLeft: 8 }}
                        >
                          {call.quality_assessment}
                        </span>
                      )}
                      {badge && (
                        <span className="processing-badge" style={{ background: badge.bg, color: badge.color, marginLeft: 6 }}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="call-phone">
                      {call.phone_e164 || '—'}
                      {call.duration_ms ? ` · ${formatDuration(call.duration_ms)}` : ''}
                    </div>
                    {call.call_summary && (
                      <div className="call-summary">{call.call_summary}</div>
                    )}
                  </div>
                  <div className="call-meta">
                    {call.energy_score ? (
                      <>
                        <div className="call-energy" style={{ color: energyColor(call.energy_score) }}>
                          {call.energy_score}
                        </div>
                        <div className="call-energy-label">Energy</div>
                      </>
                    ) : (
                      <div style={{ color: '#d1d5db', fontSize: 13 }}>—</div>
                    )}
                    <div className="call-time">{formatTimeAgo(call.call_time)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pipeline */}
          <div className="dash-section">
            <div className="section-header">
              <div className="section-title">📊 Pipeline</div>
              <span className="section-link" onClick={() => onNavigate('candidates')}>View all →</span>
            </div>
            <div className="pipeline-bar">
              {[
                { key: 'new', label: 'New', color: '#6366f1', count: pipeline.new },
                { key: 'screening', label: 'Screening', color: '#f59e0b', count: pipeline.screening },
                { key: 'interview', label: 'Interview', color: '#3b82f6', count: pipeline.interview },
                { key: 'offer', label: 'Offer', color: '#8b5cf6', count: pipeline.offer },
                { key: 'hired', label: 'Hired', color: '#10b981', count: pipeline.hired },
              ].map((stage) => {
                const total = pipeline.new + pipeline.screening + pipeline.interview + pipeline.offer + pipeline.hired;
                const pct = total > 0 ? (stage.count / total) * 100 : 0;
                return (
                  <div key={stage.key} className="pipeline-stage" onClick={() => onNavigate('candidates', { status: stage.key })}>
                    <div className="pipeline-dot" style={{ background: stage.color }} />
                    <div className="pipeline-label">{stage.label}</div>
                    <div className="pipeline-count">{stage.count}</div>
                    <div style={{ width: 60 }}>
                      <div style={{ background: '#f3f4f6', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                        <div className="pipeline-bar-fill" style={{ width: `${pct}%`, background: stage.color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dash-section">
            <div className="section-header">
              <div className="section-title">🚀 Quick Actions</div>
            </div>
            <div className="quick-grid">
              <div className="quick-btn" onClick={() => onNavigate('candidate-dashboard')}>
                <span className="qicon">📞</span> Call History
              </div>
              <div className="quick-btn" onClick={() => onNavigate('candidates')}>
                <span className="qicon">👥</span> Pipeline
              </div>
              <div className="quick-btn" onClick={() => onNavigate('imported')}>
                <span className="qicon">📥</span> Import CSV
              </div>
              <div className="quick-btn" onClick={() => onNavigate('sms')}>
                <span className="qicon">📱</span> SMS Campaign
              </div>
              <div className="quick-btn" onClick={() => onNavigate('whatsapp')}>
                <span className="qicon">💬</span> WhatsApp
              </div>
              <div className="quick-btn" onClick={() => onNavigate('reports')}>
                <span className="qicon">📈</span> Reports
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
