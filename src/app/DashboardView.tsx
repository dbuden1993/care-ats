'use client';
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface DashboardStats {
  totalCandidates: number;
  newThisWeek: number;
  callsToday: number;
  callsThisWeek: number;
  gradeACandidates: number;
  pendingFollowUps: number;
  avgEnergyScore: number;
  candidatesByStatus: Record<string, number>;
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

interface FollowUpCandidate {
  id: string;
  name: string;
  phone_e164: string;
  status: string;
  earliest_start_date: string | null;
  last_called_at: string | null;
  energy_score: number | null;
}

export default function RecruiterDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpCandidate[]>([]);
  const [topCandidates, setTopCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const todayStr = today.toISOString().split('T')[0];
    const weekAgoStr = weekAgo.toISOString();

    // Fetch all data in parallel
    const [
      candidatesResult,
      newCandidatesResult,
      callHistoryResult,
      todayCallsResult,
      gradeAResult,
      recentCallsResult
    ] = await Promise.all([
      // Total candidates
      supabase.from('candidates').select('id, status', { count: 'exact' }),
      // New this week
      supabase.from('candidates').select('id', { count: 'exact' }).gte('created_at', weekAgoStr),
      // All calls this week
      supabase.from('call_history').select('id, energy_score', { count: 'exact' }).gte('call_time', weekAgoStr),
      // Calls today
      supabase.from('call_history').select('id', { count: 'exact' }).gte('call_time', todayStr),
      // Grade A candidates from calls
      supabase.from('call_history').select('id', { count: 'exact' }).in('quality_assessment', ['A', 'HIGH']),
      // Recent calls with details
      supabase.from('call_history')
        .select('id, candidate_name, phone_e164, call_time, energy_score, quality_assessment, call_summary')
        .order('call_time', { ascending: false })
        .limit(5)
    ]);

    // Calculate average energy score
    const energyScores = callHistoryResult.data?.map(c => c.energy_score).filter(Boolean) || [];
    const avgEnergy = energyScores.length > 0 
      ? energyScores.reduce((a, b) => a + b, 0) / energyScores.length 
      : 0;

    // Count by status
    const statusCounts: Record<string, number> = {};
    candidatesResult.data?.forEach(c => {
      const status = c.status || 'new';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    setStats({
      totalCandidates: candidatesResult.count || 0,
      newThisWeek: newCandidatesResult.count || 0,
      callsToday: todayCallsResult.count || 0,
      callsThisWeek: callHistoryResult.count || 0,
      gradeACandidates: gradeAResult.count || 0,
      pendingFollowUps: statusCounts['callback'] || statusCounts['follow_up'] || 0,
      avgEnergyScore: Math.round(avgEnergy * 10) / 10,
      candidatesByStatus: statusCounts
    });

    setRecentCalls(recentCallsResult.data || []);

    // Get top candidates (high energy, recent)
    const { data: topData } = await supabase
      .from('call_history')
      .select('id, candidate_name, phone_e164, energy_score, quality_assessment, roles, call_time')
      .in('quality_assessment', ['A', 'HIGH', 'B'])
      .order('energy_score', { ascending: false })
      .limit(10);

    setTopCandidates(topData || []);

    // Get candidates needing follow-up
    const { data: followUpData } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, earliest_start_date, last_called_at')
      .in('status', ['new', 'callback', 'screening'])
      .order('created_at', { ascending: false })
      .limit(10);

    setFollowUps(followUpData || []);

    setLoading(false);
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getQualityColor = (quality: string | null) => {
    switch (quality?.toUpperCase()) {
      case 'A': case 'HIGH': return { bg: '#dcfce7', text: '#166534' };
      case 'B': return { bg: '#dbeafe', text: '#1e40af' };
      case 'C': case 'MEDIUM': return { bg: '#fef9c3', text: '#854d0e' };
      default: return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  const getEnergyColor = (score: number | null) => {
    if (!score) return '#9ca3af';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#eab308';
    return '#ef4444';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📊</div>
        <div style={{ color: '#6b7280' }}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
          {getGreeting()}! 👋
        </h1>
        <p style={{ color: '#6b7280', fontSize: '15px' }}>
          Here's your recruitment activity for today
        </p>
      </div>

      {/* Main Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <StatCard 
          icon="👥" 
          label="Total Candidates" 
          value={stats?.totalCandidates || 0}
          subtext={`+${stats?.newThisWeek || 0} this week`}
          color="#3b82f6"
        />
        <StatCard 
          icon="📞" 
          label="Calls Today" 
          value={stats?.callsToday || 0}
          subtext={`${stats?.callsThisWeek || 0} this week`}
          color="#22c55e"
        />
        <StatCard 
          icon="⭐" 
          label="Grade A Candidates" 
          value={stats?.gradeACandidates || 0}
          subtext="Ready to place"
          color="#f59e0b"
        />
        <StatCard 
          icon="⚡" 
          label="Avg Energy Score" 
          value={stats?.avgEnergyScore || 0}
          subtext="From all calls"
          color="#8b5cf6"
        />
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Recent Calls */}
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                📞 Recent Calls
              </h2>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>
                {stats?.callsThisWeek || 0} this week
              </span>
            </div>
            <div style={{ padding: '8px' }}>
              {recentCalls.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                  No calls recorded yet
                </div>
              ) : (
                recentCalls.map(call => {
                  const qualityColors = getQualityColor(call.quality_assessment);
                  return (
                    <div 
                      key={call.id}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Quality Badge */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: qualityColors.bg,
                        color: qualityColors.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px'
                      }}>
                        {call.quality_assessment?.charAt(0) || '?'}
                      </div>
                      
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '14px' }}>
                          {call.candidate_name || 'Unknown'}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {call.call_summary?.substring(0, 50) || call.phone_e164}
                        </div>
                      </div>
                      
                      {/* Energy & Time */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontWeight: '600', 
                          color: getEnergyColor(call.energy_score),
                          fontSize: '14px'
                        }}>
                          {call.energy_score || '-'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                          {formatTime(call.call_time)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pipeline Summary */}
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                📊 Pipeline Summary
              </h2>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {Object.entries(stats?.candidatesByStatus || {}).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>
                  No candidates in pipeline
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(stats?.candidatesByStatus || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([status, count]) => (
                      <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '100px', 
                          fontSize: '13px', 
                          color: '#6b7280',
                          textTransform: 'capitalize'
                        }}>
                          {status.replace(/_/g, ' ')}
                        </div>
                        <div style={{ 
                          flex: 1, 
                          height: '8px', 
                          background: '#f3f4f6', 
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (count / (stats?.totalCandidates || 1)) * 100)}%`,
                            background: '#3b82f6',
                            borderRadius: '4px'
                          }} />
                        </div>
                        <div style={{ 
                          width: '40px', 
                          textAlign: 'right', 
                          fontWeight: '600',
                          fontSize: '13px',
                          color: '#1f2937'
                        }}>
                          {count}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Top Candidates */}
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                ⭐ Top Candidates
              </h2>
            </div>
            <div style={{ padding: '8px' }}>
              {topCandidates.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                  No top candidates yet
                </div>
              ) : (
                topCandidates.slice(0, 5).map(candidate => {
                  const qualityColors = getQualityColor(candidate.quality_assessment);
                  return (
                    <div 
                      key={candidate.id}
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: qualityColors.bg,
                        color: qualityColors.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px'
                      }}>
                        {candidate.quality_assessment?.charAt(0) || '?'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '14px' }}>
                          {candidate.candidate_name || 'Unknown'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {(candidate.roles || []).slice(0, 2).join(', ') || 'No roles specified'}
                        </div>
                      </div>
                      <div style={{ 
                        fontWeight: '600', 
                        color: getEnergyColor(candidate.energy_score),
                        fontSize: '16px'
                      }}>
                        {candidate.energy_score || '-'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                🚀 Quick Actions
              </h2>
            </div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <QuickActionButton icon="📞" label="Call History" color="#3b82f6" />
              <QuickActionButton icon="👥" label="All Candidates" color="#22c55e" />
              <QuickActionButton icon="📥" label="Import CSV" color="#8b5cf6" />
              <QuickActionButton icon="💬" label="WhatsApp" color="#25d366" />
            </div>
          </div>

          {/* Today's Tips */}
          <div style={{ 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            borderRadius: '12px', 
            padding: '20px',
            color: 'white'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
              💡 Recruiter Tip
            </h3>
            <p style={{ fontSize: '14px', lineHeight: '1.5', opacity: 0.95 }}>
              {stats?.gradeACandidates && stats.gradeACandidates > 0
                ? `You have ${stats.gradeACandidates} Grade A candidates ready to place! Review them in Call History.`
                : 'Make sure to follow up with candidates within 24 hours of their call for best conversion rates.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtext, color }: {
  icon: string;
  label: string;
  value: number;
  subtext: string;
  color: string;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <span style={{ fontSize: '13px', color: '#6b7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: '32px', fontWeight: '700', color: '#1f2937' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
        {subtext}
      </div>
    </div>
  );
}

function QuickActionButton({ icon, label, color }: {
  icon: string;
  label: string;
  color: string;
}) {
  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        color: color,
        fontWeight: '500',
        fontSize: '14px'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${color}20`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = `${color}10`;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
