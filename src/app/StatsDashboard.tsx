'use client';
import { useMemo } from 'react';

interface Props {
  candidates: any[];
  jobs: any[];
  period?: number; // days
}

export default function StatsDashboard({ candidates, jobs, period = 30 }: Props) {
  const metrics = useMemo(() => {
    const now = Date.now();
    const periodMs = period * 86400000;
    
    const recent = candidates.filter(c => c.created_at && (now - new Date(c.created_at).getTime()) < periodMs);
    const hired = candidates.filter(c => c.status === 'hired');
    const recentHired = hired.filter(c => c.updated_at && (now - new Date(c.updated_at).getTime()) < periodMs);
    const rejected = candidates.filter(c => c.status === 'rejected');
    
    // Conversion rate
    const conversionRate = candidates.length > 0 ? Math.round((hired.length / candidates.length) * 100) : 0;
    
    // Time to hire (mock - would need actual data)
    const avgTimeToHire = hired.length > 0 ? Math.round(hired.reduce((sum, c) => {
      const created = new Date(c.created_at || Date.now()).getTime();
      const hiredAt = new Date(c.updated_at || Date.now()).getTime();
      return sum + (hiredAt - created) / 86400000;
    }, 0) / hired.length) : 0;
    
    // By source
    const bySource = candidates.reduce((acc, c) => {
      const s = c.source || 'direct';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // By status
    const byStatus = candidates.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Pipeline velocity (candidates moved in period)
    const activeInPipeline = candidates.filter(c => !['hired', 'rejected'].includes(c.status)).length;
    
    // Response rate (mock)
    const responseRate = 78;
    
    return {
      total: candidates.length,
      new: recent.length,
      hired: hired.length,
      recentHired: recentHired.length,
      rejected: rejected.length,
      conversionRate,
      avgTimeToHire,
      activeInPipeline,
      responseRate,
      bySource,
      byStatus,
      openJobs: jobs.filter(j => j.status === 'open').length,
    };
  }, [candidates, jobs, period]);

  const trendUp = (val: number) => val > 0;

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        @media(max-width:1200px){.stats-grid{grid-template-columns:repeat(2,1fr)}}
        .stat-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;transition:all .15s}
        .stat-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.05);transform:translateY(-2px)}
        .stat-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:12px}
        .stat-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px}
        .stat-trend{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 8px;border-radius:6px}
        .stat-trend.up{background:#ecfdf5;color:#059669}
        .stat-trend.down{background:#fef2f2;color:#dc2626}
        .stat-value{font-size:32px;font-weight:700;color:#111;margin-bottom:4px}
        .stat-label{font-size:13px;color:#6b7280}
        .stat-sub{font-size:11px;color:#9ca3af;margin-top:8px}
        .charts-row{display:grid;grid-template-columns:2fr 1fr;gap:24px;margin-bottom:24px}
        @media(max-width:900px){.charts-row{grid-template-columns:1fr}}
        .chart-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
        .chart-title{font-size:14px;font-weight:600;color:#111;margin-bottom:16px}
        .funnel{display:flex;flex-direction:column;gap:8px}
        .funnel-row{display:flex;align-items:center;gap:12px}
        .funnel-label{width:80px;font-size:12px;color:#374151;font-weight:500}
        .funnel-bar-bg{flex:1;height:24px;background:#f3f4f6;border-radius:6px;overflow:hidden}
        .funnel-bar{height:100%;border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;transition:width .5s ease}
        .funnel-bar span{font-size:11px;font-weight:600;color:#fff}
        .funnel-pct{width:40px;text-align:right;font-size:11px;color:#6b7280}
        .source-list{display:flex;flex-direction:column;gap:8px}
        .source-row{display:flex;align-items:center;gap:8px}
        .source-dot{width:8px;height:8px;border-radius:50%}
        .source-name{flex:1;font-size:12px;color:#374151;text-transform:capitalize}
        .source-count{font-size:12px;font-weight:600;color:#111}
        .source-pct{font-size:11px;color:#6b7280;width:40px;text-align:right}
        .mini-chart{display:flex;align-items:flex-end;gap:3px;height:40px;margin-top:8px}
        .mini-bar{flex:1;background:#e0e7ff;border-radius:2px;transition:height .3s}
        .mini-bar:last-child{background:#4f46e5}
      `}</style>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{background:'#eef2ff'}}>👥</div>
            <span className={`stat-trend ${trendUp(metrics.new) ? 'up' : 'down'}`}>
              {trendUp(metrics.new) ? '↑' : '↓'} {metrics.new}
            </span>
          </div>
          <div className="stat-value">{metrics.total}</div>
          <div className="stat-label">Total Candidates</div>
          <div className="stat-sub">{metrics.new} new this {period === 7 ? 'week' : 'month'}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{background:'#ecfdf5'}}>✓</div>
            <span className={`stat-trend up`}>↑ {metrics.recentHired}</span>
          </div>
          <div className="stat-value" style={{color:'#059669'}}>{metrics.hired}</div>
          <div className="stat-label">Total Hired</div>
          <div className="stat-sub">{metrics.conversionRate}% conversion rate</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{background:'#fef3c7'}}>⏱️</div>
          </div>
          <div className="stat-value">{metrics.avgTimeToHire}</div>
          <div className="stat-label">Avg. Days to Hire</div>
          <div className="stat-sub">{metrics.activeInPipeline} active in pipeline</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-header">
            <div className="stat-icon" style={{background:'#f3e8ff'}}>💼</div>
          </div>
          <div className="stat-value">{metrics.openJobs}</div>
          <div className="stat-label">Open Jobs</div>
          <div className="stat-sub">{jobs.length} total positions</div>
        </div>
      </div>
      
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">Hiring Funnel</div>
          <div className="funnel">
            {[
              { stage: 'New', count: metrics.byStatus['new'] || 0, color: '#6366f1' },
              { stage: 'Screening', count: metrics.byStatus['screening'] || 0, color: '#8b5cf6' },
              { stage: 'Interview', count: metrics.byStatus['interview'] || 0, color: '#f59e0b' },
              { stage: 'Offer', count: metrics.byStatus['offer'] || 0, color: '#10b981' },
              { stage: 'Hired', count: metrics.byStatus['hired'] || 0, color: '#059669' },
            ].map((row, i) => {
              const maxCount = Math.max(...(Object.values(metrics.byStatus) as number[]), 1);
              const width = Math.max((row.count / maxCount) * 100, row.count > 0 ? 10 : 0);
              const pct = metrics.total > 0 ? Math.round((row.count / metrics.total) * 100) : 0;
              return (
                <div key={row.stage} className="funnel-row">
                  <span className="funnel-label">{row.stage}</span>
                  <div className="funnel-bar-bg">
                    <div className="funnel-bar" style={{ width: `${width}%`, background: row.color }}>
                      <span>{row.count}</span>
                    </div>
                  </div>
                  <span className="funnel-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="chart-card">
          <div className="chart-title">Source Breakdown</div>
          <div className="source-list">
            {(Object.entries(metrics.bySource) as [string, number][])
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([source, count], i) => {
                const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                return (
                  <div key={source} className="source-row">
                    <div className="source-dot" style={{ background: colors[i % colors.length] }} />
                    <span className="source-name">{source}</span>
                    <span className="source-count">{count}</span>
                    <span className="source-pct">{pct}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
