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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingCall, setEditingCall] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'graded' | 'unprocessed'>('graded');

  useEffect(() => {
    fetchCallHistory();
  }, []);

  async function fetchCallHistory() {
    setLoading(true);
    const { data: callData, error: callError } = await supabase
      .from('call_history')
      .select('*')
      .order('call_time', { ascending: false })
      .limit(500);

    if (callError) {
      console.error('Error fetching call history:', callError);
      setLoading(false);
      return;
    }

    setCalls(callData || []);
    setLoading(false);
  }

  async function deleteCall(callId: string) {
    setDeleting(callId);
    
    const { error } = await supabase
      .from('call_history')
      .delete()
      .eq('id', callId);

    if (error) {
      console.error('Error deleting call:', error);
      alert('Failed to delete call: ' + error.message);
    } else {
      setCalls(calls.filter(c => c.id !== callId));
    }
    
    setDeleting(null);
    setDeleteConfirm(null);
  }

  async function deleteAllFiltered() {
    const filteredCalls = getFilteredCalls();
    if (filteredCalls.length === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${filteredCalls.length} call records? This cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    const ids = filteredCalls.map(c => c.id);
    
    const { error } = await supabase
      .from('call_history')
      .delete()
      .in('id', ids);

    if (error) {
      console.error('Error deleting calls:', error);
      alert('Failed to delete calls: ' + error.message);
    } else {
      setCalls(calls.filter(c => !ids.includes(c.id)));
    }
    
    setLoading(false);
  }

  async function updateCall(callId: string, updates: Partial<CallHistoryRecord>) {
    const { error } = await supabase
      .from('call_history')
      .update(updates)
      .eq('id', callId);

    if (error) {
      console.error('Error updating call:', error);
      alert('Failed to update: ' + error.message);
    } else {
      setCalls(calls.map(c => c.id === callId ? { ...c, ...updates } : c));
      setEditingCall(null);
      setEditForm({});
    }
  }

  const isUnprocessed = (call: CallHistoryRecord) => {
    return !call.candidate_name || 
           call.candidate_name === 'Unknown' || 
           call.candidate_name === 'Unknown Candidate' ||
           call.candidate_name?.toLowerCase().includes('unknown');
  };

  const gradedCalls = calls.filter(c => !isUnprocessed(c));
  const unprocessedCalls = calls.filter(c => isUnprocessed(c));

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

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.startsWith('+44')) {
      return phone.replace('+44', '0').replace(/(\d{5})(\d{6})/, '$1 $2');
    }
    return phone;
  };

  const getFilteredCalls = () => {
    const baseCalls = activeTab === 'graded' ? gradedCalls : unprocessedCalls;
    
    return baseCalls.filter(call => {
      // Quality filter (only for graded tab)
      if (activeTab === 'graded' && filter !== 'all') {
        const quality = call.quality_assessment?.toUpperCase();
        if (quality !== filter) return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = call.candidate_name?.toLowerCase().includes(query);
        const matchesPhone = call.phone_e164?.includes(query);
        const matchesSummary = call.call_summary?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesSummary) return false;
      }

      return true;
    });
  };

  const filteredCalls = getFilteredCalls();

  const stats = {
    total: gradedCalls.length,
    gradeA: gradedCalls.filter(c => c.quality_assessment?.toUpperCase() === 'A' || c.quality_assessment?.toUpperCase() === 'HIGH').length,
    gradeB: gradedCalls.filter(c => c.quality_assessment?.toUpperCase() === 'B').length,
    gradeC: gradedCalls.filter(c => c.quality_assessment?.toUpperCase() === 'C' || c.quality_assessment?.toUpperCase() === 'MEDIUM').length,
    gradeD: gradedCalls.filter(c => c.quality_assessment?.toUpperCase() === 'D' || c.quality_assessment?.toUpperCase() === 'F' || c.quality_assessment?.toUpperCase() === 'LOW').length,
    unprocessed: unprocessedCalls.length
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📞</div>
        <div style={{ color: '#6b7280' }}>Loading call history...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Stats Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ 
          padding: '16px 24px', 
          background: 'white', 
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          minWidth: '120px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1f2937' }}>{stats.total}</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Graded Calls</div>
        </div>
        <div style={{ 
          padding: '16px 24px', 
          background: '#dcfce7', 
          borderRadius: '12px',
          minWidth: '100px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#166534' }}>{stats.gradeA}</div>
          <div style={{ fontSize: '13px', color: '#166534' }}>Grade A</div>
        </div>
        <div style={{ 
          padding: '16px 24px', 
          background: '#dbeafe', 
          borderRadius: '12px',
          minWidth: '100px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1e40af' }}>{stats.gradeB}</div>
          <div style={{ fontSize: '13px', color: '#1e40af' }}>Grade B</div>
        </div>
        <div style={{ 
          padding: '16px 24px', 
          background: '#fef9c3', 
          borderRadius: '12px',
          minWidth: '100px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#854d0e' }}>{stats.gradeC}</div>
          <div style={{ fontSize: '13px', color: '#854d0e' }}>Grade C</div>
        </div>
        <div style={{ 
          padding: '16px 24px', 
          background: '#fee2e2', 
          borderRadius: '12px',
          minWidth: '100px'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#991b1b' }}>{stats.gradeD}</div>
          <div style={{ fontSize: '13px', color: '#991b1b' }}>Grade D/F</div>
        </div>
        <div style={{ 
          padding: '16px 24px', 
          background: stats.unprocessed > 0 ? '#fef3c7' : '#f3f4f6', 
          borderRadius: '12px',
          minWidth: '100px',
          border: stats.unprocessed > 0 ? '2px solid #f59e0b' : 'none'
        }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: stats.unprocessed > 0 ? '#d97706' : '#6b7280' }}>
            {stats.unprocessed}
          </div>
          <div style={{ fontSize: '13px', color: stats.unprocessed > 0 ? '#d97706' : '#6b7280' }}>Unprocessed</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        marginBottom: '20px',
        background: '#f3f4f6',
        padding: '4px',
        borderRadius: '12px',
        width: 'fit-content'
      }}>
        <button
          onClick={() => { setActiveTab('graded'); setFilter('all'); }}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'graded' ? 'white' : 'transparent',
            color: activeTab === 'graded' ? '#1f2937' : '#6b7280',
            cursor: 'pointer',
            fontWeight: activeTab === 'graded' ? '600' : '400',
            boxShadow: activeTab === 'graded' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ✅ Graded
          <span style={{
            background: '#e5e7eb',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            {stats.total}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('unprocessed'); setFilter('all'); }}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'unprocessed' ? 'white' : 'transparent',
            color: activeTab === 'unprocessed' ? '#d97706' : '#6b7280',
            cursor: 'pointer',
            fontWeight: activeTab === 'unprocessed' ? '600' : '400',
            boxShadow: activeTab === 'unprocessed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ⏳ Unprocessed
          {stats.unprocessed > 0 && (
            <span style={{
              background: '#fef3c7',
              color: '#d97706',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {stats.unprocessed}
            </span>
          )}
        </button>
      </div>

      {/* Filters and Search */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {activeTab === 'graded' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['all', 'A', 'B', 'C', 'D'] as const).map(grade => (
              <button
                key={grade}
                onClick={() => setFilter(grade)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: filter === grade ? '#3b82f6' : '#f3f4f6',
                  color: filter === grade ? 'white' : '#374151',
                  cursor: 'pointer',
                  fontWeight: filter === grade ? '600' : '400',
                  transition: 'all 0.2s'
                }}
              >
                {grade === 'all' ? 'All' : `Grade ${grade}`}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Search by name, phone, or summary..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            width: '300px',
            outline: 'none'
          }}
        />

        <button
          onClick={fetchCallHistory}
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

        {filteredCalls.length > 0 && (
          <button
            onClick={deleteAllFiltered}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#fee2e2',
              color: '#991b1b',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: 'auto'
            }}
          >
            🗑️ Delete {activeTab === 'unprocessed' ? 'All Unprocessed' : (filter !== 'all' || searchQuery ? `${filteredCalls.length} Filtered` : 'All')}
          </button>
        )}
      </div>

      {/* Results count */}
      <div style={{ marginBottom: '16px', color: '#6b7280', fontSize: '14px' }}>
        Showing {filteredCalls.length} {activeTab === 'graded' ? 'graded' : 'unprocessed'} calls
      </div>

      {/* Call List */}
      {filteredCalls.length === 0 ? (
        <div style={{ 
          padding: '60px', 
          textAlign: 'center',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>
            {activeTab === 'graded' ? '📞' : '🎉'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            {activeTab === 'graded' 
              ? 'No graded calls found'
              : 'No unprocessed calls!'}
          </div>
          <div style={{ color: '#6b7280' }}>
            {activeTab === 'graded'
              ? (searchQuery || filter !== 'all' ? 'Try adjusting your filters' : 'Call recordings will appear here after being processed')
              : 'All calls have been reviewed and graded'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredCalls.map(call => {
            const qualityColors = getQualityColor(call.quality_assessment);
            const isExpanded = expandedCall === call.id;
            const isDeleting = deleting === call.id;
            const showDeleteConfirm = deleteConfirm === call.id;
            const isEditing = editingCall === call.id;

            return (
              <div
                key={call.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  opacity: isDeleting ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                  borderLeft: activeTab === 'unprocessed' ? '4px solid #f59e0b' : 'none'
                }}
              >
                {/* Call Header */}
                <div
                  onClick={() => !showDeleteConfirm && !isEditing && setExpandedCall(isExpanded ? null : call.id)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none'
                  }}
                >
                  {/* Quality Badge */}
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: qualityColors.bg,
                    color: qualityColors.text,
                    fontWeight: '700',
                    fontSize: '14px',
                    minWidth: '45px',
                    textAlign: 'center'
                  }}>
                    {call.quality_assessment?.toUpperCase() || '-'}
                  </div>

                  {/* Name & Phone */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '15px' }}>
                      {call.candidate_name || 'Unknown Candidate'}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '13px' }}>
                      {formatPhone(call.phone_e164)} • {formatDate(call.call_time)}
                    </div>
                  </div>

                  {/* Energy Score */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: '700',
                      color: getEnergyColor(call.energy_score)
                    }}>
                      {call.energy_score || '-'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>Energy</div>
                  </div>

                  {/* Roles */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '6px',
                    flexWrap: 'wrap',
                    maxWidth: '200px'
                  }}>
                    {(call.roles || []).slice(0, 2).map((role, i) => (
                      <span key={i} style={{
                        padding: '4px 8px',
                        background: '#f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#4b5563'
                      }}>
                        {role}
                      </span>
                    ))}
                  </div>

                  {/* Edit Button (for unprocessed) */}
                  {activeTab === 'unprocessed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCall(call.id);
                        setEditForm({
                          candidate_name: call.candidate_name || '',
                          quality_assessment: call.quality_assessment || 'C',
                          energy_score: call.energy_score || 5,
                          call_summary: call.call_summary || ''
                        });
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      ✏️ Grade
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(showDeleteConfirm ? null : call.id);
                    }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: showDeleteConfirm ? '#fee2e2' : '#f3f4f6',
                      color: showDeleteConfirm ? '#991b1b' : '#6b7280',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    🗑️
                  </button>

                  {/* Expand Arrow */}
                  <div style={{ 
                    color: '#9ca3af',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </div>
                </div>

                {/* Edit Form */}
                {isEditing && (
                  <div style={{
                    padding: '20px',
                    background: '#f9fafb',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ marginBottom: '16px', color: '#1f2937' }}>Grade this call</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Candidate Name
                        </label>
                        <input
                          type="text"
                          value={editForm.candidate_name}
                          onChange={(e) => setEditForm({ ...editForm, candidate_name: e.target.value })}
                          placeholder="Enter candidate name"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Quality Grade
                        </label>
                        <select
                          value={editForm.quality_assessment}
                          onChange={(e) => setEditForm({ ...editForm, quality_assessment: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px'
                          }}
                        >
                          <option value="A">A - Excellent (Ready to place)</option>
                          <option value="B">B - Good (Proceed)</option>
                          <option value="C">C - Average (With reservations)</option>
                          <option value="D">D - Below standard</option>
                          <option value="F">F - Not suitable</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                          Energy Score (1-10)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={editForm.energy_score}
                          onChange={(e) => setEditForm({ ...editForm, energy_score: parseInt(e.target.value) || 5 })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                        Call Summary
                      </label>
                      <textarea
                        value={editForm.call_summary}
                        onChange={(e) => setEditForm({ ...editForm, call_summary: e.target.value })}
                        placeholder="Brief summary of the call..."
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => updateCall(call.id, editForm)}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#22c55e',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        ✓ Save & Grade
                      </button>
                      <button
                        onClick={() => { setEditingCall(null); setEditForm({}); }}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '8px',
                          border: '1px solid #d1d5db',
                          background: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                  <div style={{
                    padding: '12px 20px',
                    background: '#fef2f2',
                    borderBottom: '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{ color: '#991b1b', fontSize: '14px' }}>
                      Delete this call record?
                    </span>
                    <button
                      onClick={() => deleteCall(call.id)}
                      disabled={isDeleting}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#dc2626',
                        color: 'white',
                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        background: 'white',
                        color: '#374151',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Summary Preview */}
                {!isExpanded && !isEditing && call.call_summary && (
                  <div style={{ 
                    padding: '0 20px 16px 20px',
                    color: '#6b7280',
                    fontSize: '13px',
                    lineHeight: '1.5'
                  }}>
                    {call.call_summary.substring(0, 150)}
                    {call.call_summary.length > 150 ? '...' : ''}
                  </div>
                )}

                {/* Expanded Content */}
                {isExpanded && !isEditing && (
                  <div style={{ padding: '20px' }}>
                    {/* Summary */}
                    {call.call_summary && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                          📝 Call Summary
                        </div>
                        <div style={{ 
                          color: '#4b5563', 
                          lineHeight: '1.6',
                          background: '#f9fafb',
                          padding: '12px',
                          borderRadius: '8px'
                        }}>
                          {call.call_summary}
                        </div>
                      </div>
                    )}

                    {/* Details Grid */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '20px'
                    }}>
                      {call.experience_summary && (
                        <div style={{ 
                          padding: '12px',
                          background: '#f0f9ff',
                          borderRadius: '8px'
                        }}>
                          <div style={{ fontWeight: '600', color: '#0369a1', marginBottom: '4px', fontSize: '13px' }}>
                            💼 Experience
                          </div>
                          <div style={{ color: '#0c4a6e', fontSize: '14px' }}>
                            {call.experience_summary}
                          </div>
                        </div>
                      )}

                      <div style={{ 
                        padding: '12px',
                        background: '#f0fdf4',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontWeight: '600', color: '#166534', marginBottom: '4px', fontSize: '13px' }}>
                          ✅ Compliance
                        </div>
                        <div style={{ color: '#14532d', fontSize: '14px' }}>
                          <div>DBS: {call.dbs_status || 'Not discussed'}</div>
                          <div>Driver: {call.driver || 'Not discussed'}</div>
                          <div>Training: {call.mandatory_training || 'Not discussed'}</div>
                        </div>
                      </div>

                      <div style={{ 
                        padding: '12px',
                        background: '#faf5ff',
                        borderRadius: '8px'
                      }}>
                        <div style={{ fontWeight: '600', color: '#7c3aed', marginBottom: '4px', fontSize: '13px' }}>
                          📅 Availability
                        </div>
                        <div style={{ color: '#581c87', fontSize: '14px' }}>
                          <div>Start: {call.earliest_start_date || 'Not discussed'}</div>
                          <div>Hours: {call.weekly_rota || 'Not discussed'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Follow-up Actions */}
                    {call.follow_up_questions && call.follow_up_questions.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                          🎯 Follow-up Actions
                        </div>
                        <ul style={{ 
                          margin: 0, 
                          paddingLeft: '20px',
                          color: '#4b5563'
                        }}>
                          {call.follow_up_questions.map((action, i) => (
                            <li key={i} style={{ marginBottom: '4px' }}>{action}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Transcript */}
                    {call.transcript && (
                      <div>
                        <div style={{ fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                          📜 Full Transcript
                        </div>
                        <div style={{ 
                          color: '#4b5563', 
                          lineHeight: '1.6',
                          background: '#f9fafb',
                          padding: '12px',
                          borderRadius: '8px',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          fontSize: '13px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {call.transcript}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      {activeTab === 'unprocessed' && (
                        <button
                          onClick={() => {
                            setEditingCall(call.id);
                            setEditForm({
                              candidate_name: call.candidate_name || '',
                              quality_assessment: call.quality_assessment || 'C',
                              energy_score: call.energy_score || 5,
                              call_summary: call.call_summary || ''
                            });
                          }}
                          style={{
                            padding: '10px 20px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          ✏️ Grade This Call
                        </button>
                      )}
                      
                      <a
                        href={`tel:${call.phone_e164}`}
                        style={{
                          padding: '10px 20px',
                          background: '#22c55e',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        📞 Call Back
                      </a>

                      <a
                        href={`https://wa.me/${call.phone_e164?.replace('+', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '10px 20px',
                          background: '#25d366',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          textDecoration: 'none'
                        }}
                      >
                        💬 WhatsApp
                      </a>

                      {onSelectCandidate && call.candidate_id && (
                        <button
                          onClick={() => onSelectCandidate({ id: call.candidate_id })}
                          style={{
                            padding: '10px 20px',
                            background: 'white',
                            color: '#3b82f6',
                            border: '1px solid #3b82f6',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          View Full Profile →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
