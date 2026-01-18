'use client';
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CallListCandidate {
  id: string;
  name: string;
  phone_e164: string;
  status: string;
  source: string;
  roles: string[];
  earliest_start_date: string | null;
  experience_summary: string | null;
  created_at: string;
  last_called_at: string | null;
  // From call history
  last_call_summary?: string;
  energy_score?: number;
  quality_assessment?: string;
}

interface TodaysCallListProps {
  onSelectCandidate?: (candidate: any) => void;
  onCallMade?: () => void;
}

export default function TodaysCallList({ onSelectCandidate, onCallMade }: TodaysCallListProps) {
  const [candidates, setCandidates] = useState<CallListCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'callback' | 'no-answer'>('all');
  const [calledToday, setCalledToday] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCallList();
  }, []);

  async function loadCallList() {
    setLoading(true);

    // Get candidates that need calling
    // Priority: new candidates, callbacks, those not called in 3+ days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: candidateData } = await supabase
      .from('candidates')
      .select('*')
      .or(`status.eq.new,status.eq.callback,status.eq.screening,last_called_at.lt.${threeDaysAgo.toISOString()},last_called_at.is.null`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!candidateData) {
      setLoading(false);
      return;
    }

    // Get recent call history for context
    const phoneNumbers = candidateData.map(c => c.phone_e164).filter(Boolean);
    const { data: callData } = await supabase
      .from('call_history')
      .select('phone_e164, call_summary, energy_score, quality_assessment, call_time')
      .in('phone_e164', phoneNumbers)
      .order('call_time', { ascending: false });

    // Create a map of most recent call per phone
    const callMap = new Map<string, any>();
    callData?.forEach(call => {
      if (!callMap.has(call.phone_e164)) {
        callMap.set(call.phone_e164, call);
      }
    });

    // Merge candidate data with call history
    const enrichedCandidates = candidateData.map(c => {
      const lastCall = callMap.get(c.phone_e164);
      return {
        ...c,
        last_call_summary: lastCall?.call_summary,
        energy_score: lastCall?.energy_score,
        quality_assessment: lastCall?.quality_assessment
      };
    });

    // Sort by priority: new first, then by when they were last called
    enrichedCandidates.sort((a, b) => {
      // New candidates first
      if (a.status === 'new' && b.status !== 'new') return -1;
      if (b.status === 'new' && a.status !== 'new') return 1;
      // Then callbacks
      if (a.status === 'callback' && b.status !== 'callback') return -1;
      if (b.status === 'callback' && a.status !== 'callback') return 1;
      // Then by recency
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setCandidates(enrichedCandidates);

    // Check what calls were made today
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: todayCalls } = await supabase
      .from('call_history')
      .select('phone_e164')
      .gte('call_time', todayStr);

    const todaySet = new Set(todayCalls?.map(c => c.phone_e164) || []);
    setCalledToday(todaySet);

    setLoading(false);
  }

  async function markAsCalled(candidateId: string, phone: string) {
    // Update last_called_at
    await supabase
      .from('candidates')
      .update({ last_called_at: new Date().toISOString() })
      .eq('id', candidateId);

    setCalledToday(prev => new Set([...prev, phone]));
    onCallMade?.();
  }

  async function updateStatus(candidateId: string, newStatus: string) {
    await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', candidateId);

    setCandidates(prev => 
      prev.map(c => c.id === candidateId ? { ...c, status: newStatus } : c)
    );
  }

  async function snoozeCandidate(candidateId: string, days: number) {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + days);
    
    // For now, just update last_called_at to push them down the list
    await supabase
      .from('candidates')
      .update({ last_called_at: snoozeUntil.toISOString() })
      .eq('id', candidateId);

    setCandidates(prev => prev.filter(c => c.id !== candidateId));
  }

  const filteredCandidates = candidates.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'new') return c.status === 'new';
    if (filter === 'callback') return c.status === 'callback';
    if (filter === 'no-answer') return c.status === 'no_answer';
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return { bg: '#dbeafe', text: '#1e40af' };
      case 'callback': return { bg: '#fef3c7', text: '#92400e' };
      case 'screening': return { bg: '#f3e8ff', text: '#7c3aed' };
      case 'no_answer': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  const getEnergyColor = (score: number | undefined) => {
    if (!score) return '#9ca3af';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#eab308';
    return '#ef4444';
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    // Format UK number nicely
    if (phone.startsWith('+44')) {
      const local = phone.replace('+44', '0');
      return local.replace(/(\d{5})(\d{6})/, '$1 $2');
    }
    return phone;
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📋</div>
        <div style={{ color: '#6b7280' }}>Loading call list...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
            📋 Today's Call List
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            {filteredCandidates.length} candidates to call • {calledToday.size} called today
          </p>
        </div>
        
        <button
          onClick={loadCallList}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#f3f4f6',
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { id: 'all', label: 'All', count: candidates.length },
          { id: 'new', label: 'New', count: candidates.filter(c => c.status === 'new').length },
          { id: 'callback', label: 'Callbacks', count: candidates.filter(c => c.status === 'callback').length },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: filter === f.id ? '#3b82f6' : '#f3f4f6',
              color: filter === f.id ? 'white' : '#374151',
              cursor: 'pointer',
              fontWeight: filter === f.id ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {f.label}
            <span style={{
              background: filter === f.id ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Call List */}
      {filteredCandidates.length === 0 ? (
        <div style={{ 
          padding: '60px', 
          textAlign: 'center',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            All caught up!
          </div>
          <div style={{ color: '#6b7280' }}>
            No candidates waiting to be called
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredCandidates.map((candidate, index) => {
            const statusColors = getStatusColor(candidate.status);
            const wasCalledToday = calledToday.has(candidate.phone_e164);

            return (
              <div
                key={candidate.id}
                style={{
                  background: wasCalledToday ? '#f0fdf4' : 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  opacity: wasCalledToday ? 0.7 : 1,
                  borderLeft: wasCalledToday ? '4px solid #22c55e' : '4px solid transparent'
                }}
              >
                {/* Priority Number */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: index < 3 ? '#fef3c7' : '#f3f4f6',
                  color: index < 3 ? '#92400e' : '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '14px'
                }}>
                  {index + 1}
                </div>

                {/* Candidate Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '15px' }}>
                      {candidate.name || 'Unknown'}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: statusColors.bg,
                      color: statusColors.text,
                      fontSize: '11px',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {candidate.status?.replace(/_/g, ' ')}
                    </span>
                    {candidate.energy_score && (
                      <span style={{
                        fontWeight: '600',
                        color: getEnergyColor(candidate.energy_score),
                        fontSize: '13px'
                      }}>
                        ⚡{candidate.energy_score}
                      </span>
                    )}
                    {wasCalledToday && (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: '#dcfce7',
                        color: '#166534',
                        fontSize: '11px'
                      }}>
                        ✓ Called Today
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '13px' }}>
                    {candidate.last_call_summary 
                      ? candidate.last_call_summary.substring(0, 80) + '...'
                      : (candidate.roles || []).slice(0, 3).join(', ') || 'No previous notes'}
                  </div>
                </div>

                {/* Phone Number */}
                <div style={{ 
                  fontFamily: 'monospace', 
                  color: '#1f2937',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  {formatPhone(candidate.phone_e164)}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Call Button */}
                  <a
                    href={`tel:${candidate.phone_e164}`}
                    onClick={() => markAsCalled(candidate.id, candidate.phone_e164)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#22c55e',
                      color: 'white',
                      textDecoration: 'none',
                      fontWeight: '500',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    📞 Call
                  </a>

                  {/* WhatsApp Button */}
                  <a
                    href={`https://wa.me/${candidate.phone_e164?.replace('+', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#25d366',
                      color: 'white',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    💬
                  </a>

                  {/* Status Dropdown */}
                  <select
                    value={candidate.status}
                    onChange={(e) => updateStatus(candidate.id, e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    <option value="new">New</option>
                    <option value="callback">Callback</option>
                    <option value="screening">Screening</option>
                    <option value="no_answer">No Answer</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="placed">Placed</option>
                  </select>

                  {/* Snooze Button */}
                  <button
                    onClick={() => snoozeCandidate(candidate.id, 7)}
                    title="Snooze for 1 week"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    😴
                  </button>

                  {/* View Profile */}
                  {onSelectCandidate && (
                    <button
                      onClick={() => onSelectCandidate(candidate)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      👤
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
