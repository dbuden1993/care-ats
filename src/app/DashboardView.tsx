'use client';
import { useMemo } from 'react';
import AnimatedCounter from './AnimatedCounter';
import ProgressRing from './ProgressRing';
import StatusBadge from './StatusBadge';
import Avatar from './Avatar';

interface Props {
  candidates: any[];
  jobs: any[];
  onNavigate: (section: string, filter?: any) => void;
}

export default function DashboardView({ candidates, jobs, onNavigate }: Props) {
  const metrics = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const monthAgo = now - 30 * 86400000;

    const newThisWeek = candidates.filter(c => new Date(c.created_at).getTime() > weekAgo).length;
    const hiredThisMonth = candidates.filter(c => c.status === 'hired' && new Date(c.updated_at).getTime() > monthAgo).length;
    
    const byStatus: Record<string, number> = {};
    candidates.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    const bySource: Record<string, number> = {};
    candidates.forEach(c => { bySource[c.source || 'direct'] = (bySource[c.source || 'direct'] || 0) + 1; });

    const openJobs = jobs.filter(j => j.status === 'open');
    
    const conversionRate = candidates.length > 0 
      ? Math.round(((byStatus['hired'] || 0) / candidates.length) * 100)
      : 0;

    const responseRate = 78; // Mock

    return { 
      newThisWeek, 
      hiredThisMonth, 
      byStatus, 
      bySource, 
      openJobs: openJobs.length, 
      conversionRate,
      responseRate,
      total: candidates.length
    };
  }, [candidates, jobs]);

  const recentCandidates = candidates
    .filter(c => c.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const urgentActions = [
    ...(metrics.byStatus['interview'] > 0 ? [{ icon: '📅', text: `${metrics.byStatus['interview']} candidates awaiting interview`, action: () => onNavigate('candidates', { status: 'interview' }), priority: 'high' }] : []),
    ...(metrics.byStatus['offer'] > 0 ? [{ icon: '📝', text: `${metrics.byStatus['offer']} offers pending response`, action: () => onNavigate('candidates', { status: 'offer' }), priority: 'high' }] : []),
    ...(metrics.byStatus['new'] > 5 ? [{ icon: '👀', text: `${metrics.byStatus['new']} new applications to review`, action: () => onNavigate('candidates', { status: 'new' }), priority: 'medium' }] : []),
    ...(metrics.openJobs === 0 ? [{ icon: '💼', text: 'No open positions - create a job listing', action: () => onNavigate('add-job'), priority: 'low' }] : []),
  ];

  const fmtDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getRoles = (roles: any): string => {
    if (!roles) return 'No role specified';
    if (Array.isArray(roles)) return roles.join(', ');
    return String(roles);
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
        .dash-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        @media(max-width:1200px){.dash-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:768px){.dash-grid{grid-template-columns:1fr}}
        .dash-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:20px;transition:all .2s;cursor:pointer;position:relative;overflow:hidden}
        .dash-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent-light));opacity:0;transition:opacity .2s}
        .dash-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08);transform:translateY(-2px)}
        .dash-card:hover::before{opacity:1}
        .dash-card-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:16px}
        .dash-card-icon{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}
        .dash-card-trend{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px}
        .dash-card-trend.up{background:#ecfdf5;color:#059669}
        .dash-card-trend.down{background:#fef2f2;color:#dc2626}
        .dash-card-trend.neutral{background:#f3f4f6;color:#6b7280}
        .dash-card-value{font-size:36px;font-weight:800;color:#111;margin-bottom:4px;font-variant-numeric:tabular-nums}
        .dash-card-label{font-size:13px;color:#6b7280;font-weight:500}
        .dash-section{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
        @media(max-width:1000px){.dash-section{grid-template-columns:1fr}}
        .dash-panel{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden}
        .dash-panel-header{padding:18px 20px;border-bottom:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center}
        .dash-panel-title{font-size:15px;font-weight:600;color:#111}
        .dash-panel-link{font-size:12px;color:#6366f1;cursor:pointer;font-weight:500;display:flex;align-items:center;gap:4px;transition:gap .2s}
        .dash-panel-link:hover{gap:8px}
        .dash-panel-body{padding:16px 20px}
        .dash-candidate{display:flex;align-items:center;gap:14px;padding:12px;border-radius:12px;cursor:pointer;transition:all .15s;margin-bottom:8px}
        .dash-candidate:last-child{margin-bottom:0}
        .dash-candidate:hover{background:#f9fafb}
        .dash-candidate-info{flex:1;min-width:0}
        .dash-candidate-name{font-size:14px;font-weight:600;color:#111;margin-bottom:2px}
        .dash-candidate-role{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .dash-candidate-meta{display:flex;align-items:center;gap:8px}
        .dash-candidate-date{font-size:11px;color:#9ca3af}
        .dash-urgent{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:12px;margin-bottom:10px;cursor:pointer;transition:all .15s;border-left:4px solid}
        .dash-urgent:last-child{margin-bottom:0}
        .dash-urgent.high{background:#fef2f2;border-color:#ef4444}
        .dash-urgent.high:hover{background:#fee2e2}
        .dash-urgent.medium{background:#fef3c7;border-color:#f59e0b}
        .dash-urgent.medium:hover{background:#fde68a}
        .dash-urgent.low{background:#f3f4f6;border-color:#9ca3af}
        .dash-urgent.low:hover{background:#e5e7eb}
        .dash-urgent-icon{font-size:20px}
        .dash-urgent-text{flex:1;font-size:13px;font-weight:500;color:#374151}
        .dash-urgent-arrow{color:#9ca3af;transition:transform .2s}
        .dash-urgent:hover .dash-urgent-arrow{transform:translateX(4px)}
        .dash-funnel{display:flex;flex-direction:column;gap:12px}
        .dash-funnel-row{display:flex;align-items:center;gap:14px}
        .dash-funnel-label{width:80px;font-size:13px;color:#374151;font-weight:500}
        .dash-funnel-bar{flex:1;height:32px;background:#f3f4f6;border-radius:8px;overflow:hidden;position:relative}
        .dash-funnel-fill{height:100%;display:flex;align-items:center;padding-left:12px;font-size:12px;font-weight:600;color:#fff;border-radius:8px;transition:width .8s cubic-bezier(.4,0,.2,1)}
        .dash-funnel-count{position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12px;color:#6b7280;font-weight:600}
        .dash-empty{text-align:center;padding:48px 20px;color:#9ca3af}
        .dash-empty-icon{font-size:40px;margin-bottom:12px;opacity:.6}
        .dash-empty-text{font-size:14px;margin-bottom:16px}
        .dash-empty-btn{padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:background .15s}
        .dash-empty-btn:hover{background:#4338ca}
        .dash-metrics{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:8px 0}
        .dash-metric{display:flex;align-items:center;gap:16px}
        .dash-metric-info h4{font-size:13px;font-weight:600;color:#111;margin:0 0 4px}
        .dash-metric-info p{font-size:11px;color:#6b7280;margin:0}
        .dash-activity{display:flex;flex-direction:column;gap:0}
        .dash-activity-item{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f3f4f6;position:relative}
        .dash-activity-item:last-child{border-bottom:none}
        .dash-activity-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;flex-shrink:0}
        .dash-activity-content{flex:1}
        .dash-activity-text{font-size:13px;color:#374151;margin-bottom:2px}
        .dash-activity-text strong{font-weight:600;color:#111}
        .dash-activity-time{font-size:11px;color:#9ca3af}
      `}</style>

      {/* Header */}
      <div className="dash-header">
        <h1 className="dash-greeting">{greeting}! 👋</h1>
        <p className="dash-subtext">Here's what's happening with your recruitment pipeline</p>
      </div>

      {/* KPI Cards */}
      <div className="dash-grid">
        <div 
          className="dash-card" 
          style={{ '--accent': '#6366f1', '--accent-light': '#818cf8' } as any}
          onClick={() => onNavigate('candidates')}
        >
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)' }}>👥</div>
            <span className={`dash-card-trend ${metrics.newThisWeek > 0 ? 'up' : 'neutral'}`}>
              {metrics.newThisWeek > 0 ? '↑' : '•'} {metrics.newThisWeek} this week
            </span>
          </div>
          <div className="dash-card-value"><AnimatedCounter value={metrics.total} /></div>
          <div className="dash-card-label">Total Candidates</div>
        </div>
        
        <div 
          className="dash-card"
          style={{ '--accent': '#10b981', '--accent-light': '#34d399' } as any}
          onClick={() => onNavigate('candidates', { status: 'hired' })}
        >
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>✓</div>
            <span className="dash-card-trend up">↑ {metrics.hiredThisMonth} this month</span>
          </div>
          <div className="dash-card-value" style={{ color: '#059669' }}>
            <AnimatedCounter value={metrics.byStatus['hired'] || 0} />
          </div>
          <div className="dash-card-label">Total Hired</div>
        </div>
        
        <div 
          className="dash-card"
          style={{ '--accent': '#f59e0b', '--accent-light': '#fbbf24' } as any}
          onClick={() => onNavigate('jobs')}
        >
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)' }}>💼</div>
          </div>
          <div className="dash-card-value"><AnimatedCounter value={metrics.openJobs} /></div>
          <div className="dash-card-label">Open Positions</div>
        </div>
        
        <div 
          className="dash-card"
          style={{ '--accent': '#8b5cf6', '--accent-light': '#a78bfa' } as any}
          onClick={() => onNavigate('interviews')}
        >
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)' }}>📅</div>
          </div>
          <div className="dash-card-value"><AnimatedCounter value={metrics.byStatus['interview'] || 0} /></div>
          <div className="dash-card-label">In Interview Stage</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dash-section">
        {/* Pipeline Funnel */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">📊 Hiring Pipeline</span>
            <span className="dash-panel-link" onClick={() => onNavigate('candidates')}>View all →</span>
          </div>
          <div className="dash-panel-body">
            <div className="dash-funnel">
              {[
                { stage: 'New', count: metrics.byStatus['new'] || 0, color: 'linear-gradient(90deg, #6366f1, #818cf8)' },
                { stage: 'Screening', count: metrics.byStatus['screening'] || 0, color: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' },
                { stage: 'Interview', count: metrics.byStatus['interview'] || 0, color: 'linear-gradient(90deg, #f59e0b, #fbbf24)' },
                { stage: 'Offer', count: metrics.byStatus['offer'] || 0, color: 'linear-gradient(90deg, #10b981, #34d399)' },
                { stage: 'Hired', count: metrics.byStatus['hired'] || 0, color: 'linear-gradient(90deg, #059669, #10b981)' },
              ].map(row => {
                const maxCount = Math.max(...Object.values(metrics.byStatus), 1);
                const width = Math.max((row.count / maxCount) * 100, row.count > 0 ? 20 : 5);
                return (
                  <div key={row.stage} className="dash-funnel-row">
                    <span className="dash-funnel-label">{row.stage}</span>
                    <div className="dash-funnel-bar">
                      <div className="dash-funnel-fill" style={{ width: `${width}%`, background: row.color }}>
                        {row.count > 0 && row.count}
                      </div>
                      {row.count === 0 && <span className="dash-funnel-count">0</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="dash-metrics">
              <div className="dash-metric">
                <ProgressRing value={metrics.conversionRate} size={64} color="#10b981" />
                <div className="dash-metric-info">
                  <h4>Conversion Rate</h4>
                  <p>Candidates to hires</p>
                </div>
              </div>
              <div className="dash-metric">
                <ProgressRing value={metrics.responseRate} size={64} color="#6366f1" />
                <div className="dash-metric-info">
                  <h4>Response Rate</h4>
                  <p>Candidate replies</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Urgent Actions */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">⚡ Needs Attention</span>
          </div>
          <div className="dash-panel-body">
            {urgentActions.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">✨</div>
                <div className="dash-empty-text">All caught up! No urgent actions needed.</div>
              </div>
            ) : (
              urgentActions.map((a, i) => (
                <div key={i} className={`dash-urgent ${a.priority}`} onClick={a.action}>
                  <span className="dash-urgent-icon">{a.icon}</span>
                  <span className="dash-urgent-text">{a.text}</span>
                  <span className="dash-urgent-arrow">→</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="dash-section">
        {/* Recent Candidates */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">👥 Recent Candidates</span>
            <span className="dash-panel-link" onClick={() => onNavigate('candidates')}>View all →</span>
          </div>
          <div className="dash-panel-body" style={{ padding: '8px 12px' }}>
            {recentCandidates.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">👥</div>
                <div className="dash-empty-text">No candidates yet</div>
                <button className="dash-empty-btn" onClick={() => onNavigate('add-candidate')}>Add First Candidate</button>
              </div>
            ) : (
              recentCandidates.map(c => (
                <div key={c.id} className="dash-candidate" onClick={() => onNavigate('candidate', c)}>
                  <Avatar name={c.name} size="md" />
                  <div className="dash-candidate-info">
                    <div className="dash-candidate-name">{c.name || 'Unknown'}</div>
                    <div className="dash-candidate-role">{getRoles(c.roles)}</div>
                  </div>
                  <div className="dash-candidate-meta">
                    <StatusBadge status={c.status} size="sm" />
                    <span className="dash-candidate-date">{fmtDate(c.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions & Activity */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <span className="dash-panel-title">🚀 Quick Actions</span>
          </div>
          <div className="dash-panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { icon: '➕', label: 'Add Candidate', action: () => onNavigate('add-candidate'), color: '#eef2ff' },
                { icon: '💼', label: 'Create Job', action: () => onNavigate('add-job'), color: '#ecfdf5' },
                { icon: '📊', label: 'View Reports', action: () => onNavigate('reports'), color: '#fef3c7' },
                { icon: '📅', label: 'Calendar', action: () => onNavigate('interviews'), color: '#f3e8ff' },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={item.action}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: 20,
                    background: item.color,
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    cursor: 'pointer',
                    transition: 'all .15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <span style={{ fontSize: 24 }}>{item.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
