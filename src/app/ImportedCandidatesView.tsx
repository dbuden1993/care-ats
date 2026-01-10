'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Candidate {
  id: string;
  name: string;
  phone_e164: string;
  email?: string;
  roles: string[];
  source: string;
  driver: string;
  dbs_update_service: string;
  mandatory_training: string;
  created_at: string;
  status: string;
  is_called?: boolean;
  last_called_at?: string;
  energy_count?: number;
}

interface Props {
  onSelectCandidate: (candidate: Candidate) => void;
  onOpenImport: () => void;
  onStartCampaign?: (candidates: Candidate[]) => void;
}

export default function ImportedCandidatesView({ onSelectCandidate, onOpenImport, onStartCampaign }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // FETCH IMPORTED CANDIDATES - those with no last_called_at
  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching imported candidates (last_called_at IS NULL)...');
      
      // Direct query for candidates with NULL last_called_at
      const { data, error: fetchError } = await supabase
        .from('candidates')
        .select('*')
        .is('last_called_at', null)
        .order('created_at', { ascending: false });
      
      if (fetchError) {
        console.error('Supabase error:', fetchError);
        setError(fetchError.message);
        return;
      }
      
      console.log('Imported candidates found:', data?.length || 0);
      setCandidates(data || []);
    } catch (e: any) {
      console.error('Error:', e);
      setError(e.message || 'Failed to load candidates');
    }
    setLoading(false);
  }, []);

  useEffect(() => { 
    fetchCandidates(); 
  }, [fetchCandidates]);

  // Get unique sources
  const sources = useMemo(() => {
    const s = new Set(candidates.map(c => c.source).filter(Boolean));
    return Array.from(s).sort();
  }, [candidates]);

  // Filter candidates by search and source
  const filteredCandidates = useMemo(() => {
    let result = [...candidates];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone_e164?.includes(q) ||
        c.source?.toLowerCase().includes(q)
      );
    }
    
    if (sourceFilter !== 'all') {
      result = result.filter(c => c.source === sourceFilter);
    }
    
    return result;
  }, [candidates, searchQuery, sourceFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCandidates.length / pageSize);
  const paginatedCandidates = filteredCandidates.slice((page - 1) * pageSize, page * pageSize);

  // Selection
  const handleSelectAll = () => {
    if (selected.size === filteredCandidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCandidates.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} candidates? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('candidates').delete().in('id', Array.from(selected));
      if (error) throw error;
      setSelected(new Set());
      fetchCandidates();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  // Mark as called
  const handleMarkAsCalled = async () => {
    if (!selected.size) return;
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ is_called: true, status: 'new' })
        .in('id', Array.from(selected));
      if (error) throw error;
      setSelected(new Set());
      fetchCandidates();
    } catch (e) {
      alert('Failed to update');
    }
  };

  // Start WhatsApp campaign
  const handleStartCampaign = () => {
    const selectedCandidates = filteredCandidates.filter(c => selected.has(c.id));
    if (selectedCandidates.length === 0) {
      alert('Please select candidates first');
      return;
    }
    if (onStartCampaign) {
      onStartCampaign(selectedCandidates);
    }
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    if (phone.startsWith('+44') && phone.length >= 12) {
      return `+44 ${phone.slice(3, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
    }
    return phone;
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>📥 Imported Candidates</h1>
          <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '4px 12px', borderRadius: 16, fontSize: 14, fontWeight: 600 }}>
            {candidates.length} total
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchCandidates} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}>
            🔄 Refresh
          </button>
          <button onClick={onOpenImport} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
            ➕ Import More
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, marginBottom: 16, color: '#1e40af', fontSize: 14 }}>
        ℹ️ These are candidates imported from CSV/CV who haven't been called via Dialpad yet. Select candidates to start a WhatsApp campaign.
      </div>

      {/* Error display */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 16, color: '#dc2626' }}>
          ❌ Error: {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name, phone, source..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          style={{ flex: 1, padding: 10, border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
        />
        <select 
          value={sourceFilter} 
          onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
          style={{ padding: 10, border: '1px solid #d1d5db', borderRadius: 8, minWidth: 200 }}
        >
          <option value="all">All Sources ({sources.length})</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e40af', color: '#fff', padding: '12px 20px', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{selected.size}</span> selected
            {selected.size < filteredCandidates.length && (
              <button 
                onClick={() => setSelected(new Set(filteredCandidates.map(c => c.id)))}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '4px 12px', borderRadius: 6, color: '#fff', cursor: 'pointer' }}
              >
                Select all {filteredCandidates.length}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleStartCampaign} style={{ padding: '8px 16px', background: '#25d366', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
              💬 WhatsApp Campaign
            </button>
            <button onClick={handleMarkAsCalled} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
              ✅ Mark as Called
            </button>
            <button onClick={handleBulkDelete} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
              🗑️ Delete
            </button>
            <button onClick={() => setSelected(new Set())} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 64, color: '#6b7280' }}>
            Loading candidates...
          </div>
        ) : candidates.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, color: '#6b7280' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
            <h3 style={{ margin: '0 0 8px', color: '#111' }}>No imported candidates</h3>
            <p style={{ margin: '0 0 24px' }}>Import candidates from CSV to build your talent pool.</p>
            <button onClick={onOpenImport} style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              📥 Import Candidates
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', width: 40 }}>
                  <input type="checkbox" checked={selected.size === filteredCandidates.length && filteredCandidates.length > 0} onChange={handleSelectAll} />
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>Roles</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>Source</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>Imported</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', color: '#6b7280' }}>Info</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCandidates.map(c => (
                <tr 
                  key={c.id} 
                  style={{ cursor: 'pointer', background: selected.has(c.id) ? '#eff6ff' : 'transparent' }}
                  onClick={() => onSelectCandidate(c)}
                >
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <strong style={{ color: '#111' }}>{c.name || 'Unknown'}</strong>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: 12 }}>
                    {formatPhone(c.phone_e164)}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    {Array.isArray(c.roles) && c.roles.length > 0 ? (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {c.roles.slice(0, 2).map((r, i) => (
                          <span key={i} style={{ padding: '2px 8px', background: '#e0e7ff', color: '#3730a3', borderRadius: 4, fontSize: 11 }}>{r}</span>
                        ))}
                        {c.roles.length > 2 && <span style={{ padding: '2px 6px', background: '#f3f4f6', color: '#6b7280', borderRadius: 4, fontSize: 11 }}>+{c.roles.length - 2}</span>}
                      </div>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                    <span style={{ padding: '4px 8px', background: '#f3f4f6', borderRadius: 4, fontSize: 11 }}>
                      {c.source ? (c.source.length > 25 ? c.source.slice(0, 25) + '...' : c.source) : 'Import'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontSize: 12 }}>
                    {formatDate(c.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', fontSize: 14 }}>
                    {c.driver === 'Yes' && <span title="Driver">🚗</span>}
                    {c.dbs_update_service === 'Yes' && <span title="DBS">✅</span>}
                    {c.mandatory_training === 'Yes' && <span title="Training">📚</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderTop: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <button disabled={page === 1} onClick={() => setPage(1)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>««</button>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>‹ Prev</button>
            <span style={{ padding: '0 16px', color: '#6b7280', fontSize: 13 }}>Page {page} of {totalPages} ({filteredCandidates.length} total)</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>Next ›</button>
            <button disabled={page === totalPages} onClick={() => setPage(totalPages)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>»»</button>
          </div>
        )}
      </div>
    </div>
  );
}
