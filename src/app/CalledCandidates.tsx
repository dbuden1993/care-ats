'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CallHistoryRecord {
  id: string;
  candidate_id: string | null;
  phone_e164: string;
  call_id: string;
  call_time: string;
  direction: string;
  duration_ms: number | null;
  candidate_name: string | null;
  experience_summary: string | null;
  call_summary: string | null;
  roles: string[];
  driver: string | null;
  dbs_status: string | null;
  mandatory_training: string | null;
  earliest_start_date: string | null;
  weekly_rota: string | null;
  energy_score: number | null;
  quality_assessment: string | null;
  follow_up_questions: string[];
  call_type: string | null;
  extraction_confidence: number | null;
  transcript: string | null;
  created_at: string;
}

interface CalledCandidatesViewProps {
  onSelectCandidate?: (candidate: any) => void;
}

export default function CalledCandidatesView({ onSelectCandidate }: CalledCandidatesViewProps) {
  const [calls, setCalls] = useState<CallHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'A' | 'B' | 'C' | 'D'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCallHistory();
  }, []);

  async function fetchCallHistory() {
    setLoading(true);
    
    const { data: callData, error: callError } = await supabase
      .from('call_history')
      .select('*')
      .order('call_time', { ascending: false })
      .limit(200);
    
    if (callError) {
      console.error('Error fetching call history:', callError);
      setLoading(false);
      return;
    }
    
    setCalls(callData || []);
    setLoading(false);
  }

  const getQualityColor = (quality: string | null) => {
    const q = quality?.toUpperCase();
    switch (q) {
      case 'A': return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      case 'B': return { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' };
      case 'C': return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
      case 'D': case 'F': return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'HIGH': return { bg: '#dcfce7', text: '#166534', border: '#86efac' };
      case 'MEDIUM': return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' };
      case 'LOW': return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      default: return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
    }
  };

  const getEnergyColor = (score: number | null) => {
    if (!score) return '#9ca3af';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#eab308';
    return '#ef4444';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredCalls = calls.filter(call => {
    // Quality filter
    if (filter !== 'all') {
      const quality = call.quality_assessment?.toUpperCase();
      if (filter === 'A' && quality !== 'A' && quality !== 'HIGH') return false;
      if (filter === 'B' && quality !== 'B') return false;
      if (filter === 'C' && quality !== 'C' && quality !== 'MEDIUM') return false;
      if (filter === 'D' && quality !== 'D' && quality !== 'F' && quality !== 'LOW') return false;
    }
    
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = call.candidate_name?.toLowerCase().includes(q);
      const phoneMatch = call.phone_e164?.includes(q);
      const summaryMatch = (typeof call.call_summary === 'string' ? call.call_summary : JSON.stringify(call.call_summary))?.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !summaryMatch) return false;
    }
    
    return true;
  });

  const stats = {
    total: calls.length,
    gradeA: calls.filter(c => c.quality_assessment?.toUpperCase() === 'A' || c.quality_assessment?.toUpperCase() === 'HIGH').length,
    gradeB: calls.filter(c => c.quality_assessment?.toUpperCase() === 'B').length,
    gradeC: calls.filter(c => c.quality_assessment?.toUpperCase() === 'C' || c.quality_assessment?.toUpperCase() === 'MEDIUM').length,
    gradeD: calls.filter(c => ['D', 'F', 'LOW'].includes(c.quality_assessment?.toUpperCase() || '')).length,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#6b7280' }}>
          <div style={{ width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          Loading call history...
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div>
      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: 12, padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {[
          { k: 'all', v: stats.total, l: 'Total Calls', c: '#6366f1' },
          { k: 'A', v: stats.gradeA, l: 'Grade A', c: '#22c55e' },
          { k: 'B', v: stats.gradeB, l: 'Grade B', c: '#3b82f6' },
          { k: 'C', v: stats.gradeC, l: 'Grade C', c: '#eab308' },
          { k: 'D', v: stats.gradeD, l: 'Grade D/F', c: '#ef4444' },
        ].map(s => (
          <div
            key={s.k}
            onClick={() => setFilter(s.k as any)}
            style={{
              background: filter === s.k ? '#eef2ff' : '#f9fafb',
              borderRadius: 12,
              padding: '14px 20px',
              cursor: 'pointer',
              transition: 'all .15s',
              border: filter === s.k ? '2px solid #6366f1' : '2px solid transparent',
              minWidth: 100,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '12px 24px', background: '#fafbfc', borderBottom: '1px solid #e5e7eb' }}>
        <input
          type="text"
          placeholder="Search by name, phone, or summary..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '10px 14px',
            fontSize: 13,
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            outline: 'none'
          }}
        />
      </div>

      {/* Call List */}
      <div style={{ padding: 24 }}>
        {filteredCalls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No calls found</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>Process some recordings to see AI analysis here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredCalls.map(call => {
              const qualityColor = getQualityColor(call.quality_assessment);
              const isExpanded = expandedCall === call.id;
              
              return (
                <div
                  key={call.id}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  {/* Call Header */}
                  <div
                    onClick={() => setExpandedCall(isExpanded ? null : call.id)}
                    style={{
                      padding: 16,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      transition: 'background .15s'
                    }}
                  >
                    {/* Quality Badge */}
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: qualityColor.bg,
                      border: `2px solid ${qualityColor.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: 18,
                      color: qualityColor.text,
                      flexShrink: 0
                    }}>
                      {call.quality_assessment?.charAt(0) || '?'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#111' }}>
                        {call.candidate_name || 'Unknown Candidate'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#6b7280', marginTop: 4 }}>
                        <span>📞 {call.phone_e164}</span>
                        <span>🕐 {formatDate(call.call_time)}</span>
                        {call.call_type && <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{call.call_type}</span>}
                      </div>
                    </div>

                    {/* Energy Score */}
                    <div style={{ textAlign: 'center', marginRight: 16 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: getEnergyColor(call.energy_score) }}>
                        {call.energy_score || '-'}<span style={{ fontSize: 14, fontWeight: 400 }}>/10</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>ENERGY</div>
                    </div>

                    {/* Roles */}
                    {call.roles && call.roles.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 200 }}>
                        {call.roles.slice(0, 3).map((role, i) => (
                          <span key={i} style={{ padding: '4px 8px', background: '#eef2ff', color: '#4f46e5', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                            {role}
                          </span>
                        ))}
                        {call.roles.length > 3 && (
                          <span style={{ padding: '4px 8px', background: '#f3f4f6', color: '#6b7280', borderRadius: 4, fontSize: 11 }}>
                            +{call.roles.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Expand Icon */}
                    <div style={{ color: '#9ca3af', fontSize: 18 }}>
                      {isExpanded ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Call Summary (always visible) */}
                  {call.call_summary && (
                    <div style={{ padding: '0 16px 16px', fontSize: 14, color: '#4b5563', lineHeight: 1.5 }}>
                      {typeof call.call_summary === 'string' 
                        ? call.call_summary.slice(0, 200) + (call.call_summary.length > 200 ? '...' : '')
                        : JSON.stringify(call.call_summary).slice(0, 200)}
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #e5e7eb', padding: 16, background: '#fafbfc' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        
                        {/* Experience */}
                        {call.experience_summary && (
                          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                            <h4 style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                              🎓 Experience
                            </h4>
                            <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                              {typeof call.experience_summary === 'string' 
                                ? call.experience_summary 
                                : JSON.stringify(call.experience_summary)}
                            </p>
                          </div>
                        )}

                        {/* Compliance */}
                        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                          <h4 style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            ✅ Compliance
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6b7280' }}>DBS Status:</span>
                              <span style={{ fontWeight: 500 }}>{call.dbs_status || 'Unknown'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6b7280' }}>Driver:</span>
                              <span style={{ fontWeight: 500 }}>{call.driver === 'Yes' ? '✅ Yes' : call.driver === 'No' ? '❌ No' : 'Unknown'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6b7280' }}>Training:</span>
                              <span style={{ fontWeight: 500 }}>{call.mandatory_training || 'Unknown'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Availability */}
                        <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                          <h4 style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                            📅 Availability
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6b7280' }}>Start Date:</span>
                              <span style={{ fontWeight: 500 }}>
                                {call.earliest_start_date 
                                  ? new Date(call.earliest_start_date).toLocaleDateString('en-GB')
                                  : 'Not specified'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#6b7280' }}>Hours:</span>
                              <span style={{ fontWeight: 500 }}>{call.weekly_rota || 'Not specified'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Follow-up Actions */}
                        {call.follow_up_questions && call.follow_up_questions.length > 0 && (
                          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', gridColumn: 'span 2' }}>
                            <h4 style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                              📋 Follow-up Actions
                            </h4>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#4b5563' }}>
                              {call.follow_up_questions.map((action, i) => (
                                <li key={i} style={{ marginBottom: 4 }}>
                                  {typeof action === 'string' ? action : JSON.stringify(action)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Transcript */}
                        {call.transcript && (
                          <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb', gridColumn: '1 / -1' }}>
                            <h4 style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                              📝 Transcript
                            </h4>
                            <div style={{ 
                              maxHeight: 200, 
                              overflowY: 'auto', 
                              fontSize: 12, 
                              color: '#4b5563', 
                              whiteSpace: 'pre-wrap', 
                              background: '#f9fafb', 
                              padding: 12, 
                              borderRadius: 6,
                              fontFamily: 'monospace',
                              lineHeight: 1.6
                            }}>
                              {typeof call.transcript === 'string' 
                                ? call.transcript 
                                : JSON.stringify(call.transcript, null, 2)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Link to Candidate */}
                      {call.candidate_id && onSelectCandidate && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCandidate({ id: call.candidate_id, name: call.candidate_name, phone_e164: call.phone_e164 });
                            }}
                            style={{
                              padding: '10px 16px',
                              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              fontWeight: 600,
                              fontSize: 13,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8
                            }}
                          >
                            👤 View Full Candidate Profile →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
