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
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    async function loadCallData() {
      setLoadingCalls(true);
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const { data: calls } = await supabase
        .from('call_history')
        .select('id, candidate_name, phone_e164, call_time, energy_score, quality_assessment, call_summary')
        .order('call_time', { ascending: false })
        .limit(10);

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

      const { count: importCount } = await supabase
        .from('candidates')
        .select('id', { count: 'exact' })
        .is('last_called_at', null);

      setRecentCalls(calls || []);
      setCallStats({
        today: todayCount || 0,
        week: weekCount || 0,
        gradeA: gradeACount || 0,
        unprocessed: 0
      });
      setImportedCount(importCount || 0);
      setLoadingCalls(false);
    }

    loadCallData();
  }, []);

  const metrics = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;

    const newThisWeek = candidates.filter(c => new Date(c.created_at).getTime() > weekAgo).length;
    
    const byStatus: Record<string, number> = {};
    candidates.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    return { 
      newThisWeek, 
      byStatus, 
      total: candidates.length
    };
  }, [candidates]);

  const topCandidates = recentCalls
    .filter(c => c.candidate_name && !c.candidate_name.toLowerCase().includes('unknown'))
    .filter(c => c.quality_assessment === 'A' || c.quality_assessment === 'B' || c.quality_assessment === 'HIGH')
    .sort((a, b) => (b.energy_score || 0) - (a.energy_score || 0))
    .slice(0, 5);

  const getGradeClass = (quality: string | null) => {
    const q = quality?.toUpperCase();
    switch (q) {
      case 'A': case 'HIGH': return 'grade grade-a';
      case 'B': return 'grade grade-b';
      case 'C': case 'MEDIUM': return 'grade grade-c';
      default: return 'grade grade-d';
    }
  };

  const getEnergyColor = (score: number | null) => {
    if (!score) return 'var(--gray-400)';
    if (score >= 8) return 'var(--success)';
    if (score >= 6) return 'var(--info)';
    if (score >= 4) return 'var(--warning)';
    return 'var(--danger)';
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

  const styles = `
    .dashboard {
      padding: 28px;
      min-height: 100%;
    }
    
    .dashboard-header {
      margin-bottom: 28px;
    }
    
    .dashboard-greeting {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 800;
      color: var(--gray-900);
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }
    
    .dashboard-subtext {
      font-size: 15px;
      color: var(--gray-500);
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 28px;
    }
    
    @media (max-width: 1200px) {
      .metrics-grid { grid-template-columns: repeat(3, 1fr); }
    }
    
    @media (max-width: 768px) {
      .metrics-grid { grid-template-columns: repeat(2, 1fr); }
    }
    
    .metric-card {
      background: white;
      border: 1px solid var(--gray-100);
      border-radius: var(--radius-xl);
      padding: 22px;
      cursor: pointer;
      transition: all var(--transition-normal);
      position: relative;
      overflow: hidden;
    }
    
    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%);
      opacity: 0;
      transition: opacity var(--transition-normal);
    }
    
    .metric-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    
    .metric-card:hover::before {
      opacity: 1;
    }
    
    .metric-card.highlight {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 2px solid var(--accent);
    }
    
    .metric-card.highlight::before {
      background: linear-gradient(90deg, var(--accent) 0%, #fbbf24 100%);
      opacity: 1;
    }
    
    .metric-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      margin-bottom: 16px;
    }
    
    .metric-value {
      font-family: var(--font-display);
      font-size: 36px;
      font-weight: 800;
      color: var(--gray-900);
      letter-spacing: -0.03em;
      line-height: 1;
      margin-bottom: 6px;
    }
    
    .metric-label {
      font-size: 13px;
      color: var(--gray-500);
      font-weight: 500;
    }
    
    .metric-sub {
      font-size: 12px;
      color: var(--gray-400);
      margin-top: 6px;
    }
    
    .panels-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }
    
    @media (max-width: 1000px) {
      .panels-grid { grid-template-columns: 1fr; }
    }
    
    .panel {
      background: white;
      border: 1px solid var(--gray-100);
      border-radius: var(--radius-xl);
      overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    
    .panel-header {
      padding: 18px 22px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .panel-title {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 700;
      color: var(--gray-900);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .panel-link {
      font-size: 13px;
      color: var(--primary);
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
      transition: color var(--transition-fast);
    }
    
    .panel-link:hover {
      color: var(--primary-dark);
    }
    
    .panel-body {
      padding: 8px 0;
    }
    
    .call-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 22px;
      cursor: pointer;
      transition: background var(--transition-fast);
      border-bottom: 1px solid var(--gray-50);
    }
    
    .call-item:last-child {
      border-bottom: none;
    }
    
    .call-item:hover {
      background: var(--gray-50);
    }
    
    .call-info {
      flex: 1;
      min-width: 0;
    }
    
    .call-name {
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: 3px;
      font-size: 14px;
    }
    
    .call-phone {
      font-size: 12px;
      color: var(--gray-500);
      font-family: var(--font-mono);
    }
    
    .call-summary {
      font-size: 12px;
      color: var(--gray-500);
      margin-top: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .call-time {
      font-size: 12px;
      color: var(--gray-400);
      white-space: nowrap;
    }
    
    .call-btn {
      padding: 8px 14px;
      background: var(--success);
      color: white;
      border-radius: var(--radius-md);
      text-decoration: none;
      font-size: 12px;
      font-weight: 600;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .call-btn:hover {
      background: var(--success-dark);
      transform: scale(1.02);
    }
    
    .empty-panel {
      padding: 48px 24px;
      text-align: center;
      color: var(--gray-400);
    }
    
    .empty-panel-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }
    
    .empty-panel-text {
      font-size: 14px;
    }
    
    .funnel {
      padding: 16px 22px;
    }
    
    .funnel-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 14px;
      cursor: pointer;
    }
    
    .funnel-row:last-child {
      margin-bottom: 0;
    }
    
    .funnel-label {
      width: 80px;
      font-size: 13px;
      font-weight: 500;
      color: var(--gray-600);
    }
    
    .funnel-bar {
      flex: 1;
      height: 32px;
      background: var(--gray-100);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    
    .funnel-fill {
      height: 100%;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 12px;
      color: white;
      font-size: 13px;
      font-weight: 700;
      transition: width 0.5s ease;
    }
    
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      padding: 18px 22px;
    }
    
    .quick-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px 16px;
      background: var(--gray-50);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-fast);
      border: 1px solid transparent;
    }
    
    .quick-btn:hover {
      background: white;
      border-color: var(--gray-200);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    
    .quick-btn-icon {
      font-size: 28px;
    }
    
    .quick-btn-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-700);
    }
    
    .loading-skeleton {
      background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-50) 50%, var(--gray-100) 75%);
      background-size: 200% 100%;
      animation: skeleton 1.5s ease-in-out infinite;
      border-radius: var(--radius-md);
    }
    
    @keyframes skeleton {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;

  return (
    <div className="dashboard">
      <style>{styles}</style>
      
      <div className="dashboard-header">
        <h1 className="dashboard-greeting">{greeting}! 👋</h1>
        <p className="dashboard-subtext">Here's your recruitment overview for today</p>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card highlight" onClick={() => onNavigate('call-history')}>
          <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>📞</div>
          <div className="metric-value">{callStats.today}</div>
          <div className="metric-label">Calls Today</div>
          <div className="metric-sub">{callStats.week} this week</div>
        </div>
        
        <div className="metric-card" onClick={() => onNavigate('call-history')}>
          <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)' }}>⭐</div>
          <div className="metric-value">{callStats.gradeA}</div>
          <div className="metric-label">Grade A Candidates</div>
        </div>
        
        <div className="metric-card" onClick={() => onNavigate('candidates')}>
          <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' }}>👥</div>
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-label">Total Called</div>
          <div className="metric-sub">+{metrics.newThisWeek} this week</div>
        </div>
        
        <div className="metric-card" onClick={() => onNavigate('imported')}>
          <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)' }}>📥</div>
          <div className="metric-value">{importedCount}</div>
          <div className="metric-label">To Contact</div>
        </div>

        <div className="metric-card" onClick={() => onNavigate('sms')}>
          <div className="metric-icon" style={{ background: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)' }}>📱</div>
          <div className="metric-value">SMS</div>
          <div className="metric-label">Campaign</div>
        </div>
      </div>

      {/* Main Panels */}
      <div className="panels-grid">
        {/* Recent Calls */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">📞 Recent Calls</span>
            <span className="panel-link" onClick={() => onNavigate('call-history')}>View all →</span>
          </div>
          <div className="panel-body">
            {loadingCalls ? (
              <div style={{ padding: '20px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="loading-skeleton" style={{ height: 60, marginBottom: 8 }} />
                ))}
              </div>
            ) : recentCalls.length === 0 ? (
              <div className="empty-panel">
                <div className="empty-panel-icon">📞</div>
                <div className="empty-panel-text">No calls yet. Start calling candidates!</div>
              </div>
            ) : (
              recentCalls.slice(0, 5).map(call => (
                <div key={call.id} className="call-item" onClick={() => onNavigate('call-history')}>
                  <div className={getGradeClass(call.quality_assessment)}>
                    {call.quality_assessment?.toUpperCase() || '-'}
                  </div>
                  <div className="call-info">
                    <div className="call-name">{call.candidate_name || 'Unknown'}</div>
                    <div className="call-phone">{formatPhone(call.phone_e164)}</div>
                    {call.call_summary && (
                      <div className="call-summary">{call.call_summary}</div>
                    )}
                  </div>
                  <div className="energy-score">
                    <div className="energy-value" style={{ color: getEnergyColor(call.energy_score) }}>
                      {call.energy_score || '-'}
                    </div>
                    <div className="energy-label">Energy</div>
                  </div>
                  <div className="call-time">{formatTime(call.call_time)}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Candidates */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">🌟 Top Candidates</span>
            <span className="panel-link" onClick={() => onNavigate('call-history')}>View all →</span>
          </div>
          <div className="panel-body">
            {topCandidates.length === 0 ? (
              <div className="empty-panel">
                <div className="empty-panel-icon">🎯</div>
                <div className="empty-panel-text">Make some calls to find top candidates!</div>
              </div>
            ) : (
              topCandidates.map(call => (
                <div key={call.id} className="call-item">
                  <div className={getGradeClass(call.quality_assessment)}>
                    {call.quality_assessment?.toUpperCase()}
                  </div>
                  <div className="call-info">
                    <div className="call-name">{call.candidate_name}</div>
                    <div className="call-phone">{formatPhone(call.phone_e164)}</div>
                  </div>
                  <div className="energy-score">
                    <div className="energy-value" style={{ color: getEnergyColor(call.energy_score) }}>
                      {call.energy_score}
                    </div>
                    <div className="energy-label">Energy</div>
                  </div>
                  <a
                    href={`tel:${call.phone_e164}`}
                    onClick={e => e.stopPropagation()}
                    className="call-btn"
                  >
                    📞 Call
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="panels-grid">
        {/* Pipeline */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">📊 Pipeline</span>
            <span className="panel-link" onClick={() => onNavigate('candidates')}>View all →</span>
          </div>
          <div className="funnel">
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
                <div 
                  key={row.stage} 
                  className="funnel-row" 
                  onClick={() => onNavigate('candidates', { status: row.stage.toLowerCase() })}
                >
                  <span className="funnel-label">{row.stage}</span>
                  <div className="funnel-bar">
                    <div 
                      className="funnel-fill" 
                      style={{ width: `${width}%`, background: `linear-gradient(90deg, ${row.color} 0%, ${row.color}cc 100%)` }}
                    >
                      {row.count > 0 && row.count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">🚀 Quick Actions</span>
          </div>
          <div className="quick-actions">
            <div className="quick-btn" onClick={() => onNavigate('call-history')}>
              <span className="quick-btn-icon">📞</span>
              <span className="quick-btn-label">Call History</span>
            </div>
            <div className="quick-btn" onClick={() => onNavigate('candidates')}>
              <span className="quick-btn-icon">👥</span>
              <span className="quick-btn-label">All Candidates</span>
            </div>
            <div className="quick-btn" onClick={() => onNavigate('imported')}>
              <span className="quick-btn-icon">📥</span>
              <span className="quick-btn-label">Import CSV</span>
            </div>
            <div className="quick-btn" onClick={() => onNavigate('sms')}>
              <span className="quick-btn-icon">📱</span>
              <span className="quick-btn-label">SMS Campaign</span>
            </div>
            <div className="quick-btn" onClick={() => onNavigate('whatsapp')}>
              <span className="quick-btn-icon">💬</span>
              <span className="quick-btn-label">WhatsApp</span>
            </div>
            <div className="quick-btn" onClick={() => onNavigate('reports')}>
              <span className="quick-btn-icon">📈</span>
              <span className="quick-btn-label">Reports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
