'use client';
import { useMemo, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  candidates: any[];
  jobs: any[];
  onNavigate: (section: string, filter?: any) => void;
}

interface RecentCall {
  id: string;
  candidate_name: string;
  phone_e164: string;
  call_time: string;
  energy_score: number | null;
  quality_assessment: string | null;
  call_summary: string | null;
}

export default function DashboardView({ candidates, jobs, onNavigate }: Props) {
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [callStats, setCallStats] = useState({ today: 0, week: 0, gradeA: 0, unprocessed: 0 });
  const [loadingCalls, setLoadingCalls] = useState(true);

  // Fetch recent calls from call_history
  useEffect(() => {
    async function loadCallData() {
      setLoadingCalls(true);
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      // Get recent calls
      const { data: calls } = await supabase
        .from('call_history')
        .select('id, candidate_name, phone_e164, call_time, energy_score, quality_assessment, call_summary')
        .order('call_time', { ascending: false })
        .limit(10);

      // Get call stats
      const { count: todayCount } = await supabase
        .from('call_history')
        .select('id', { count: 'exact' })
        .gte('call_time', todayStart);

      const { count: weekCount } = await supabase
        .from('call_history')
        .select('id', { count: 'exact' })
        .gte('call_time', weekAgo);

      const { count: gradeACount } = await supabase
        .from('call_history')
        .select('id', { count: 'exact' })
        .or('quality_assessment.eq.A,quality_assessment.eq.HIGH');

      const { data: unprocessedData } = await supabase
        .from('call_history')
        .select('id, candidate_name')
        .or('candidate_name.is.null,candidate_name.ilike.%unknown%');

      setRecentCalls(calls || []);
      setCallStats({
        today: todayCount || 0,
        week: weekCount || 0,
        gradeA: gradeACount || 0,
        unprocessed: unprocessedData?.length || 0
      });
      setLoadingCalls(false);
    }

    loadCallData();
  }, []);

  const metrics = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const monthAgo = now - 30 * 86400000;

    const newThisWeek = candidates.filter(c => new Date(c.created_at).getTime() > weekAgo).length;
    const hiredThisMonth = candidates.filter(c => c.status === 'hired' && new Date(c.updated_at).getTime() > monthAgo).length;
    
    const byStatus: Record<string, number> = {};
    candidates.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    const openJobs = jobs.filter(j => j.status === 'open');
    
    const conversionRate = candidates.length > 0 
      ? Math.round(((byStatus['hired'] || 0) / candidates.length) * 100)
      : 0;

    return { 
      newThisWeek, 
      hiredThisMonth, 
      byStatus, 
      openJobs: openJobs.length, 
      conversionRate,
      total: candidates.length
    };
  }, [candidates, jobs]);

  // Top candidates from call history (Grade A/B with high energy)
  const topCandidates = recentCalls
    .filter(c => c.candidate_name && !c.candidate_name.toLowerCase().includes('unknown'))
    .filter(c => c.quality_assessment === 'A' || c.quality_assessment === 'B' || c.quality_assessment === 'HIGH')
    .sort((a, b) => (b.energy_score || 0) - (a.energy_score || 0))
    .slice(0, 5);

  const getQualityColor = (quality: string | null) => {
    const q = quality?.toUpperCase();
    switch (q) {
      case 'A': case 'HIGH': return { bg: '#dcfce7', text: '#166534' };
      case 'B': return { bg: '#dbeafe', text: '#1e40af' };
      case 'C': case 'MEDIUM': return { bg: '#fef9c3', text: '#854d0e' };
      default: return { bg: '#fee2e2', text: '#991b1b' };
    }
  };

  const getEnergyColor = (score: number | null) => {
    if (!score) return '#9ca3af';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#eab308';
    return '#ef4444';
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.startsWith('+44')) {
      return phone.replace('+44', '0').replace(/(\d{5})(\d{6})/, '$1 $2');
    }
    return phone;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .dash-header{margin-bottom:24px}
        .dash-greeting{font-size:24px;font-weight:700;color:#111;margin-bottom:4px}
        .dash-subtext{font-size:14px;color:#6b7280}
        .dash-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;margin-bottom:24px}
        @media(max-width:1200px){.dash-grid{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:768px){.dash-grid{grid-template-columns:repeat(2,1fr)}}
        .dash-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:20px;transition:all .2s;cursor:pointer}
        .dash-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08);transform:translateY(-2px)}
        .dash-card.highlight{border:2px solid #f59e0b;background:linear-gradient(135deg,#fffbeb,#fef3c7)}
        .dash-card-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:12px}
        .dash-card-value{font-size:32px;font-weight:800;color:#111;margin-bottom:4px}
        .dash-card-label{font-size:12px;color:#6b7280;font-weight:500}
        .dash-card-sub{font-size:11px;color:#9ca3af;margin-top:4px}
        .dash-section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
        @media(max-width:1000px){.dash-section{grid-template-columns:1fr}}
        .dash-panel{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden}
        .dash-panel-header{padding:16px 20px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center}
        .dash-panel-title{font-size:15px;font-weight:600;color:#111;display:flex;align-items:center;gap:8px}
        .dash-panel-link{font-size:12px;color:#6366f1;cursor:pointer;font-weight:500}
        .dash-panel-link:hover{text-decoration:underline}
        .dash-panel-body{padding:16px}
        .dash-call{display:flex;align-items:center;gap:14px;padding:12px;border-radius:10px;cursor:pointer;transition:all .15s;margin-bottom:8px}
        .dash-call:last-child{margin-bottom:0}
        .dash-call:hover{background:#f9fafb}
        .dash-call-grade{padding:6px 10px;border-radius:6px;font-weight:700;font-size:13px;min-width:32px;text-align:center}
        .dash-call-info{flex:1;min-width:0}
        .dash-call-name{font-size:14px;font-weight:600;color:#111}
        .dash-call-phone{font-size:12px;color:#6b7280;font-family:monospace}
        .dash-call-summary{font-size:11px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:250px}
        .dash-call-energy{text-align:center}
        .dash-call-energy-value{font-size:18px;font-weight:700}
        .dash-call-energy-label{font-size:9px;color:#9ca3af}
        .dash-call-time{font-size:11px;color:#9ca3af}
        .dash-quick{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
        .dash-quick-btn{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;cursor:pointer;transition:all .15s}
        .dash-quick-btn:hover{background:#fff;border-color:#d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.05);transform:translateY(-2px)}
        .dash-quick-icon{font-size:24px}
        .dash-quick-label{font-size:12px;font-weight:600;color:#374151}
        .dash-funnel{display:flex;flex-direction:column;gap:10px}
        .dash-funnel-row{display:flex;align-items:center;gap:12px}
        .dash-funnel-label{width:70px;font-size:12px;color:#374151;font-weight:500}
        .dash-funnel-bar{flex:1;height:24px;background:#f3f4f6;border-radius:6px;overflow:hidden;position:relative}
        .dash-funnel-fill{height:100%;display:flex;align-items:center;padding-left:10px;font-size:11px;font-weight:600;color:#fff;border-radius:6px;transition:width .5s ease}
        .dash-empty{text-align:center;padding:40px;color:#9ca3af;font-size:13px}
      `}</style>

      {/* Header */}
      <div className="dash-header">
        <h1 className="dash-greeting">{greeting}! 👋</h1>
        <p className="dash-subtext">Here's your recruitment overview</p>
      </div>

      {/* KPI Cards */}
      <div className="dash-grid">
        <div className="dash-card" onClick={() => onNavigate('call-history')}>
          <div className="dash-card-icon" style={{ background: '#dbeafe' }}>📞</div>
          <div className="dash-card-value">{callStats.today}</div>
          <div className="dash-card-label">Calls Today</div>
          <div className="dash-card-sub">{callStats.week} this week</div>
        </div>
        
        <div className="dash-card" onClick={() => onNavigate('call-history')}>
          <div className="dash-card-icon" style={{ background: '#dcfce7' }}>⭐</div>
          <div className="dash-card-value" style={{ color: '#16a34a' }}>{callStats.gradeA}</div>
          <div className="dash-card-label">Grade A Candidates</div>
        </div>

        {callStats.unprocessed > 0 && (
          <div className="dash-card highlight" onClick={() => onNavigate('call-history')}>
            <div className="dash-card-icon" style={{ background: '#fef3c7' }}>⏳</div>
            <div className="dash-card-value" style={{ color: '#d97706' }}>{callStats.unprocessed}</div>
            <div className="dash-card-label">Unprocessed Calls</div>
            <div className="dash-card-sub">Needs grading</div>
          </div>
        )}
        
        <div className="dash-card" onClick={() => onNavigate('candidates')}>
          <div className="dash-card-icon" style={{ background: '#eef2ff' }}>👥</div>
          <div className="dash-card-value">{metrics.total}</div>
          <div className="dash-card-label">Total Called</div>
          <div className="dash-card-sub">+{metrics.newThisWeek} this week</div>
        </div>
        
        <div className="dash-card" onClick={() => onNavigate('imported')}>
          <div className="dash-card-icon" style={{ background: '#f3e8ff' }}>📥</div>
          <div className="dash-card-value">{candidates.filter(c => !c.last_called_at).length || 0}</div>
          <div className="dash-card-label">To Contact</div>
        </div>
      </div>

      <div className="dash-section">
        {/* Recent Calls */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">📞 Recent Calls</span>
            <span className="dash-panel-link" onClick={() => onNavigate('call-history')}>View all →</span>
          </div>
          <div className="dash-panel-body" style={{ padding: '8px 12px' }}>
            {loadingCalls ? (
              <div className="dash-empty">Loading calls...</div>
            ) : recentCalls.length === 0 ? (
              <div className="dash-empty">No calls yet. Start calling candidates!</div>
            ) : (
              recentCalls.slice(0, 5).map(call => {
                const colors = getQualityColor(call.quality_assessment);
                return (
                  <div key={call.id} className="dash-call" onClick={() => onNavigate('call-history')}>
                    <div className="dash-call-grade" style={{ background: colors.bg, color: colors.text }}>
                      {call.quality_assessment?.toUpperCase() || '-'}
                    </div>
                    <div className="dash-call-info">
                      <div className="dash-call-name">{call.candidate_name || 'Unknown'}</div>
                      <div className="dash-call-phone">{formatPhone(call.phone_e164)}</div>
                      {call.call_summary && (
                        <div className="dash-call-summary">{call.call_summary}</div>
                      )}
                    </div>
                    <div className="dash-call-energy">
                      <div className="dash-call-energy-value" style={{ color: getEnergyColor(call.energy_score) }}>
                        {call.energy_score || '-'}
                      </div>
                      <div className="dash-call-energy-label">Energy</div>
                    </div>
                    <div className="dash-call-time">{formatTime(call.call_time)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Candidates */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">🌟 Top Candidates</span>
            <span className="dash-panel-link" onClick={() => onNavigate('call-history')}>View all →</span>
          </div>
          <div className="dash-panel-body" style={{ padding: '8px 12px' }}>
            {topCandidates.length === 0 ? (
              <div className="dash-empty">
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                Make some calls to find top candidates!
              </div>
            ) : (
              topCandidates.map(call => {
                const colors = getQualityColor(call.quality_assessment);
                return (
                  <div key={call.id} className="dash-call" onClick={() => onNavigate('call-history')}>
                    <div className="dash-call-grade" style={{ background: colors.bg, color: colors.text }}>
                      {call.quality_assessment?.toUpperCase()}
                    </div>
                    <div className="dash-call-info">
                      <div className="dash-call-name">{call.candidate_name}</div>
                      <div className="dash-call-phone">{formatPhone(call.phone_e164)}</div>
                    </div>
                    <div className="dash-call-energy">
                      <div className="dash-call-energy-value" style={{ color: getEnergyColor(call.energy_score) }}>
                        {call.energy_score}
                      </div>
                      <div className="dash-call-energy-label">Energy</div>
                    </div>
                    <a
                      href={`tel:${call.phone_e164}`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        padding: '6px 12px',
                        background: '#22c55e',
                        color: 'white',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      📞 Call
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="dash-section">
        {/* Pipeline */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">📊 Pipeline</span>
            <span className="dash-panel-link" onClick={() => onNavigate('candidates')}>View all →</span>
          </div>
          <div className="dash-panel-body">
            <div className="dash-funnel">
              {[
                { stage: 'New', count: metrics.byStatus['new'] || 0, color: '#6366f1' },
                { stage: 'Screening', count: metrics.byStatus['screening'] || 0, color: '#8b5cf6' },
                { stage: 'Interview', count: metrics.byStatus['interview'] || 0, color: '#f59e0b' },
                { stage: 'Offer', count: metrics.byStatus['offer'] || 0, color: '#10b981' },
                { stage: 'Hired', count: metrics.byStatus['hired'] || 0, color: '#059669' },
              ].map(row => {
                const maxCount = Math.max(...Object.values(metrics.byStatus), 1);
                const width = Math.max((row.count / maxCount) * 100, row.count > 0 ? 15 : 5);
                return (
                  <div key={row.stage} className="dash-funnel-row" onClick={() => onNavigate('candidates', { status: row.stage.toLowerCase() })}>
                    <span className="dash-funnel-label">{row.stage}</span>
                    <div className="dash-funnel-bar">
                      <div className="dash-funnel-fill" style={{ width: `${width}%`, background: row.color }}>
                        {row.count > 0 && row.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">🚀 Quick Actions</span>
          </div>
          <div className="dash-panel-body">
            <div className="dash-quick">
              <div className="dash-quick-btn" onClick={() => onNavigate('call-history')}>
                <span className="dash-quick-icon">📞</span>
                <span className="dash-quick-label">Call History</span>
              </div>
              <div className="dash-quick-btn" onClick={() => onNavigate('candidates')}>
                <span className="dash-quick-icon">👥</span>
                <span className="dash-quick-label">All Candidates</span>
              </div>
              <div className="dash-quick-btn" onClick={() => onNavigate('imported')}>
                <span className="dash-quick-icon">📥</span>
                <span className="dash-quick-label">Import CSV</span>
              </div>
              <div className="dash-quick-btn" onClick={() => onNavigate('sms')}>
                <span className="dash-quick-icon">📱</span>
                <span className="dash-quick-label">SMS Campaign</span>
              </div>
              <div className="dash-quick-btn" onClick={() => onNavigate('whatsapp')}>
                <span className="dash-quick-icon">💬</span>
                <span className="dash-quick-label">WhatsApp</span>
              </div>
              <div className="dash-quick-btn" onClick={() => onNavigate('reports')}>
                <span className="dash-quick-icon">📈</span>
                <span className="dash-quick-label">Reports</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
