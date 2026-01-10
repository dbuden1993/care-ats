'use client';
import { useState, useMemo } from 'react';
import PipelineChart from './PipelineChart';
import SourceChart from './SourceChart';
import MetricsGrid from './MetricsGrid';
import ProgressRing from './ProgressRing';
import AnimatedCounter from './AnimatedCounter';

interface Props {
  candidates: any[];
  jobs: any[];
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function ReportsView({ candidates, jobs }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'pipeline' | 'sources' | 'time'>('overview');

  const filteredCandidates = useMemo(() => {
    if (timeRange === 'all') return candidates;
    const now = Date.now();
    const ranges: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 0 };
    const cutoff = now - ranges[timeRange] * 86400000;
    return candidates.filter(c => new Date(c.created_at).getTime() > cutoff);
  }, [candidates, timeRange]);

  const metrics = useMemo(() => {
    const total = filteredCandidates.length;
    const hired = filteredCandidates.filter(c => c.status === 'hired').length;
    const rejected = filteredCandidates.filter(c => c.status === 'rejected').length;
    const inPipeline = total - hired - rejected;
    const avgDaysToHire = 14; // Mock
    const conversionRate = total > 0 ? Math.round((hired / total) * 100) : 0;
    const openJobs = jobs.filter(j => j.status === 'open').length;
    const avgCandidatesPerJob = openJobs > 0 ? Math.round(total / openJobs) : 0;

    return { total, hired, rejected, inPipeline, avgDaysToHire, conversionRate, openJobs, avgCandidatesPerJob };
  }, [filteredCandidates, jobs]);

  const pipelineData = useMemo(() => {
    const stages = [
      { stage: 'New', color: '#6366f1' },
      { stage: 'Screening', color: '#8b5cf6' },
      { stage: 'Interview', color: '#f59e0b' },
      { stage: 'Offer', color: '#10b981' },
      { stage: 'Hired', color: '#059669' },
    ];
    return stages.map(s => ({
      ...s,
      count: filteredCandidates.filter(c => c.status === s.stage.toLowerCase()).length
    }));
  }, [filteredCandidates]);

  const sourceData = useMemo(() => {
    const sources: Record<string, { count: number; hired: number }> = {};
    filteredCandidates.forEach(c => {
      const source = c.source || 'direct';
      if (!sources[source]) sources[source] = { count: 0, hired: 0 };
      sources[source].count++;
      if (c.status === 'hired') sources[source].hired++;
    });
    return Object.entries(sources).map(([source, data]) => ({ source, ...data }));
  }, [filteredCandidates]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'pipeline', label: 'Pipeline', icon: '📈' },
    { id: 'sources', label: 'Sources', icon: '🎯' },
    { id: 'time', label: 'Time to Hire', icon: '⏱️' },
  ];

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .reports-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
        .reports-tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;border:1px solid #e5e7eb}
        .reports-tab{padding:10px 18px;font-size:13px;font-weight:600;color:#6b7280;border:none;background:none;cursor:pointer;border-radius:8px;display:flex;align-items:center;gap:6px;transition:all .15s}
        .reports-tab:hover{color:#111}
        .reports-tab.active{background:#4f46e5;color:#fff}
        .reports-time-filter{display:flex;gap:4px;background:#f3f4f6;padding:4px;border-radius:10px}
        .reports-time-btn{padding:8px 14px;font-size:12px;font-weight:600;border:none;background:none;cursor:pointer;border-radius:6px;color:#6b7280;transition:all .15s}
        .reports-time-btn.active{background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.08)}
        .reports-grid{display:grid;grid-template-columns:2fr 1fr;gap:20px;margin-bottom:24px}
        @media(max-width:1000px){.reports-grid{grid-template-columns:1fr}}
        .reports-panel{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden}
        .reports-panel-header{padding:18px 20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
        .reports-panel-title{font-size:15px;font-weight:700;color:#111;display:flex;align-items:center;gap:8px}
        .reports-panel-body{padding:20px}
        .reports-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        @media(max-width:900px){.reports-kpi-grid{grid-template-columns:repeat(2,1fr)}}
        .reports-kpi{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;text-align:center;transition:all .15s}
        .reports-kpi:hover{box-shadow:0 4px 12px rgba(0,0,0,.06);transform:translateY(-2px)}
        .reports-kpi-value{font-size:32px;font-weight:800;color:#111;margin-bottom:4px}
        .reports-kpi-label{font-size:12px;color:#6b7280;font-weight:500}
        .reports-kpi-trend{font-size:11px;margin-top:8px;font-weight:600;padding:3px 8px;border-radius:10px;display:inline-block}
        .reports-funnel{display:flex;align-items:flex-end;justify-content:center;gap:20px;height:200px;padding:20px 0}
        .reports-funnel-bar{display:flex;flex-direction:column;align-items:center;gap:8px}
        .reports-funnel-fill{width:60px;border-radius:8px 8px 0 0;transition:height .6s ease}
        .reports-funnel-label{font-size:11px;font-weight:600;color:#6b7280}
        .reports-funnel-count{font-size:14px;font-weight:700;color:#111}
        .reports-empty{text-align:center;padding:60px;color:#9ca3af}
        .reports-conversion{display:flex;align-items:center;justify-content:center;gap:40px;padding:32px}
      `}</style>

      <div className="reports-header">
        <div className="reports-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`reports-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <div className="reports-time-filter">
          {(['7d', '30d', '90d', 'all'] as TimeRange[]).map(range => (
            <button
              key={range}
              className={`reports-time-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'all' ? 'All Time' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="reports-kpi-grid">
            <div className="reports-kpi">
              <div className="reports-kpi-value" style={{ color: '#6366f1' }}><AnimatedCounter value={metrics.total} /></div>
              <div className="reports-kpi-label">Total Candidates</div>
              <div className="reports-kpi-trend" style={{ background: '#ecfdf5', color: '#059669' }}>↑ 12% vs prev</div>
            </div>
            <div className="reports-kpi">
              <div className="reports-kpi-value" style={{ color: '#10b981' }}><AnimatedCounter value={metrics.hired} /></div>
              <div className="reports-kpi-label">Hired</div>
              <div className="reports-kpi-trend" style={{ background: '#ecfdf5', color: '#059669' }}>↑ 8% vs prev</div>
            </div>
            <div className="reports-kpi">
              <div className="reports-kpi-value"><AnimatedCounter value={metrics.avgDaysToHire} /></div>
              <div className="reports-kpi-label">Avg Days to Hire</div>
              <div className="reports-kpi-trend" style={{ background: '#ecfdf5', color: '#059669' }}>↓ 2 days</div>
            </div>
            <div className="reports-kpi">
              <div className="reports-kpi-value"><AnimatedCounter value={metrics.conversionRate} />%</div>
              <div className="reports-kpi-label">Conversion Rate</div>
              <div className="reports-kpi-trend" style={{ background: '#fef3c7', color: '#d97706' }}>• Same</div>
            </div>
          </div>

          <div className="reports-grid">
            <div className="reports-panel">
              <div className="reports-panel-header">
                <span className="reports-panel-title">📈 Pipeline Overview</span>
              </div>
              <div className="reports-panel-body">
                <PipelineChart data={pipelineData} />
              </div>
            </div>

            <div className="reports-panel">
              <div className="reports-panel-header">
                <span className="reports-panel-title">🎯 Conversion Funnel</span>
              </div>
              <div className="reports-panel-body">
                <div className="reports-conversion">
                  <ProgressRing value={metrics.conversionRate} size={100} color="#10b981" label="Hired" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 8 }}>Funnel Breakdown</div>
                    <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
                      <div>{metrics.total} Applied → {metrics.inPipeline + metrics.hired} Progressed</div>
                      <div>{metrics.inPipeline + metrics.hired} Progressed → {metrics.hired} Hired</div>
                      <div style={{ color: '#ef4444' }}>{metrics.rejected} Rejected</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="reports-panel">
            <div className="reports-panel-header">
              <span className="reports-panel-title">🎯 Top Sources</span>
            </div>
            <div className="reports-panel-body">
              <SourceChart data={sourceData} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'pipeline' && (
        <div className="reports-panel">
          <div className="reports-panel-header">
            <span className="reports-panel-title">📈 Detailed Pipeline</span>
          </div>
          <div className="reports-panel-body">
            <PipelineChart data={pipelineData} />
            <div className="reports-funnel">
              {pipelineData.map((item, i) => {
                const maxCount = Math.max(...pipelineData.map(d => d.count), 1);
                const height = Math.max((item.count / maxCount) * 160, 20);
                return (
                  <div key={item.stage} className="reports-funnel-bar">
                    <div className="reports-funnel-count"><AnimatedCounter value={item.count} /></div>
                    <div className="reports-funnel-fill" style={{ height, background: item.color }} />
                    <div className="reports-funnel-label">{item.stage}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="reports-panel">
          <div className="reports-panel-header">
            <span className="reports-panel-title">🎯 Source Analytics</span>
          </div>
          <div className="reports-panel-body">
            <SourceChart data={sourceData} />
          </div>
        </div>
      )}

      {activeTab === 'time' && (
        <div className="reports-panel">
          <div className="reports-panel-header">
            <span className="reports-panel-title">⏱️ Time to Hire</span>
          </div>
          <div className="reports-panel-body">
            <MetricsGrid 
              columns={3}
              metrics={[
                { label: 'Avg Time to First Contact', value: 2, suffix: ' days', icon: '📞', color: '#6366f1', trend: { value: -15, direction: 'up' } },
                { label: 'Avg Time to Interview', value: 8, suffix: ' days', icon: '📅', color: '#8b5cf6', trend: { value: -10, direction: 'up' } },
                { label: 'Avg Time to Offer', value: 14, suffix: ' days', icon: '📝', color: '#10b981', trend: { value: -5, direction: 'up' } },
                { label: 'Avg Time to Hire', value: 18, suffix: ' days', icon: '✅', color: '#059669', trend: { value: -8, direction: 'up' } },
                { label: 'Offer Acceptance Rate', value: 85, suffix: '%', icon: '🎉', color: '#f59e0b', trend: { value: 5, direction: 'up' } },
                { label: 'Candidate Drop-off', value: 22, suffix: '%', icon: '📉', color: '#ef4444', trend: { value: -3, direction: 'up' } },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
