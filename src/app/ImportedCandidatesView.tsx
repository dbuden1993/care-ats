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

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('candidates')
        .select('*')
        .is('last_called_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }
      setCandidates(data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load candidates');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  // Unique sources for filter
  const sources = useMemo(() => {
    const s = new Set(candidates.map(c => c.source).filter(Boolean));
    return Array.from(s).sort();
  }, [candidates]);

  // Stats
  const stats = useMemo(() => {
    const withDriver = candidates.filter(c => c.driver === 'Yes').length;
    const withDBS = candidates.filter(c => c.dbs_update_service === 'Yes').length;
    const withTraining = candidates.filter(c => c.mandatory_training === 'Yes').length;
    const withRoles = candidates.filter(c => Array.isArray(c.roles) && c.roles.length > 0).length;
    return { total: candidates.length, withDriver, withDBS, withTraining, withRoles };
  }, [candidates]);

  // Filter
  const filteredCandidates = useMemo(() => {
    let result = [...candidates];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone_e164?.includes(q) ||
        c.source?.toLowerCase().includes(q) ||
        (Array.isArray(c.roles) && c.roles.some(r => r.toLowerCase().includes(q)))
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
    if (!phone) return '—';
    if (phone.startsWith('+44') && phone.length >= 12) {
      return `0${phone.slice(3, 7)} ${phone.slice(7, 10)} ${phone.slice(10)}`;
    }
    return phone;
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const timeAgo = (d: string) => {
    if (!d) return '';
    const now = new Date();
    const date = new Date(d);
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}w ago`;
    return formatDate(d);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      '#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981',
      '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'
    ];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="iv-container">
      <style>{`
        .iv-container {
          padding: 24px 28px;
          min-height: 100vh;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
        }

        /* Header */
        .iv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .iv-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .iv-title {
          font-size: 26px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .iv-count-badge {
          padding: 4px 14px;
          background: #e0e7ff;
          color: #4338ca;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 700;
        }
        .iv-header-actions {
          display: flex;
          gap: 10px;
        }
        .iv-btn {
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: none;
        }
        .iv-btn-outline {
          background: #fff;
          border: 1px solid #d1d5db;
          color: #374151;
        }
        .iv-btn-outline:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }
        .iv-btn-primary {
          background: #4f46e5;
          color: #fff;
        }
        .iv-btn-primary:hover {
          background: #4338ca;
        }

        /* Stats */
        .iv-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        .iv-stat {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px 20px;
          position: relative;
          overflow: hidden;
          transition: all 0.15s ease;
        }
        .iv-stat:hover {
          border-color: #c7d2fe;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.04);
        }
        .iv-stat-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }
        .iv-stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          line-height: 1;
        }
        .iv-stat-label {
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          margin-top: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Error */
        .iv-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 14px 18px;
          margin-bottom: 20px;
          color: #dc2626;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Filters */
        .iv-toolbar {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: center;
        }
        .iv-search {
          flex: 1;
          position: relative;
        }
        .iv-search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          font-size: 16px;
          pointer-events: none;
        }
        .iv-search input {
          width: 100%;
          padding: 11px 14px 11px 40px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 14px;
          background: #fff;
          transition: all 0.15s;
          box-sizing: border-box;
        }
        .iv-search input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .iv-select {
          padding: 11px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 500;
          background: #fff;
          cursor: pointer;
          min-width: 180px;
        }
        .iv-select:focus {
          outline: none;
          border-color: #4f46e5;
        }

        /* Bulk Action Bar */
        .iv-bulk-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #312e81 0%, #4338ca 100%);
          color: #fff;
          padding: 14px 22px;
          border-radius: 14px;
          margin-bottom: 16px;
          box-shadow: 0 4px 16px rgba(67, 56, 202, 0.25);
          animation: ivSlideIn 0.2s ease;
        }
        @keyframes ivSlideIn {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .iv-bulk-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .iv-bulk-count {
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
        }
        .iv-bulk-label {
          font-size: 13px;
          opacity: 0.9;
        }
        .iv-bulk-right {
          display: flex;
          gap: 8px;
        }
        .iv-bulk-btn {
          padding: 9px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .iv-bulk-btn-wa {
          background: #25d366;
          color: #fff;
        }
        .iv-bulk-btn-wa:hover { background: #1ebe57; }
        .iv-bulk-btn-ghost {
          background: rgba(255,255,255,0.15);
          color: #fff;
        }
        .iv-bulk-btn-ghost:hover { background: rgba(255,255,255,0.25); }
        .iv-bulk-btn-clear {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.3);
          color: #fff;
        }
        .iv-bulk-btn-clear:hover { background: rgba(255,255,255,0.1); }
        .iv-bulk-select-all {
          background: rgba(255,255,255,0.2);
          border: none;
          padding: 4px 12px;
          border-radius: 6px;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }
        .iv-bulk-select-all:hover { background: rgba(255,255,255,0.3); }

        /* Table */
        .iv-table-wrap {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .iv-table {
          width: 100%;
          border-collapse: collapse;
        }
        .iv-table thead th {
          padding: 14px 18px;
          text-align: left;
          border-bottom: 2px solid #f3f4f6;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          background: #fafbfc;
          white-space: nowrap;
        }
        .iv-table thead th:first-child {
          width: 44px;
          text-align: center;
        }
        .iv-table tbody tr {
          cursor: pointer;
          transition: background 0.1s;
        }
        .iv-table tbody tr:hover {
          background: #f8faff;
        }
        .iv-table tbody tr.iv-row-selected {
          background: #eef2ff;
        }
        .iv-table tbody td {
          padding: 14px 18px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 13px;
          color: #374151;
          vertical-align: middle;
        }
        .iv-table tbody td:first-child {
          text-align: center;
        }
        .iv-table tbody tr:last-child td {
          border-bottom: none;
        }

        /* Table cells */
        .iv-cell-name {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .iv-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          flex-shrink: 0;
        }
        .iv-name-text {
          font-weight: 600;
          color: #111827;
          font-size: 14px;
        }
        .iv-cell-phone {
          font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 12px;
          color: #6b7280;
          letter-spacing: 0.3px;
        }
        .iv-role-tag {
          display: inline-block;
          padding: 3px 10px;
          background: #e0e7ff;
          color: #3730a3;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          margin-right: 4px;
          margin-bottom: 2px;
        }
        .iv-role-more {
          display: inline-block;
          padding: 3px 8px;
          background: #f3f4f6;
          color: #6b7280;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
        }
        .iv-source-tag {
          display: inline-block;
          padding: 4px 10px;
          background: #f3f4f6;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          color: #4b5563;
          max-width: 160px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .iv-date {
          font-size: 12px;
          color: #6b7280;
        }
        .iv-date-sub {
          font-size: 10px;
          color: #9ca3af;
          margin-top: 2px;
        }
        .iv-compliance-icons {
          display: flex;
          gap: 6px;
        }
        .iv-compliance-icon {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        }
        .iv-compliance-yes {
          background: #d1fae5;
        }
        .iv-compliance-no {
          background: #f3f4f6;
          opacity: 0.4;
        }
        .iv-checkbox {
          width: 18px;
          height: 18px;
          accent-color: #4f46e5;
          cursor: pointer;
        }

        /* Pagination */
        .iv-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 20px;
          border-top: 1px solid #f3f4f6;
          background: #fafbfc;
        }
        .iv-page-info {
          font-size: 13px;
          color: #6b7280;
        }
        .iv-page-buttons {
          display: flex;
          gap: 6px;
        }
        .iv-page-btn {
          padding: 8px 14px;
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #374151;
          transition: all 0.15s;
        }
        .iv-page-btn:hover:not(:disabled) {
          border-color: #c7d2fe;
          background: #f5f3ff;
          color: #4f46e5;
        }
        .iv-page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .iv-page-btn-active {
          background: #4f46e5;
          border-color: #4f46e5;
          color: #fff;
        }

        /* Empty */
        .iv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          text-align: center;
        }
        .iv-empty-icon {
          font-size: 56px;
          margin-bottom: 16px;
          opacity: 0.4;
        }
        .iv-empty-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px;
        }
        .iv-empty-text {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 24px;
        }

        /* Loading */
        @keyframes ivShimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
        .iv-skeleton {
          background: linear-gradient(90deg, #f3f4f6 0px, #e5e7eb 40px, #f3f4f6 80px);
          background-size: 200px 100%;
          animation: ivShimmer 1.5s infinite;
          border-radius: 8px;
        }

        /* Filter result text */
        .iv-filter-info {
          font-size: 12px;
          color: #9ca3af;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .iv-filter-clear {
          color: #4f46e5;
          cursor: pointer;
          font-weight: 600;
        }
        .iv-filter-clear:hover {
          text-decoration: underline;
        }

        @media (max-width: 1100px) {
          .iv-stats { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .iv-stats { grid-template-columns: repeat(2, 1fr); }
          .iv-toolbar { flex-wrap: wrap; }
        }
      `}</style>

      {/* Header */}
      <div className="iv-header">
        <div className="iv-header-left">
          <h1 className="iv-title">Imported Pool</h1>
          <span className="iv-count-badge">{stats.total} candidates</span>
        </div>
        <div className="iv-header-actions">
          <button className="iv-btn iv-btn-outline" onClick={fetchCandidates}>
            ↻ Refresh
          </button>
          <button className="iv-btn iv-btn-primary" onClick={onOpenImport}>
            + Import CSV
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="iv-stats">
        <div className="iv-stat">
          <div className="iv-stat-bar" style={{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
          <div className="iv-stat-value">{stats.total}</div>
          <div className="iv-stat-label">Total Pool</div>
        </div>
        <div className="iv-stat">
          <div className="iv-stat-bar" style={{ background: 'linear-gradient(90deg, #06b6d4, #22d3ee)' }} />
          <div className="iv-stat-value">{stats.withRoles}</div>
          <div className="iv-stat-label">With Roles</div>
        </div>
        <div className="iv-stat">
          <div className="iv-stat-bar" style={{ background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
          <div className="iv-stat-value">{stats.withDriver}</div>
          <div className="iv-stat-label">Drivers</div>
        </div>
        <div className="iv-stat">
          <div className="iv-stat-bar" style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
          <div className="iv-stat-value">{stats.withDBS}</div>
          <div className="iv-stat-label">DBS Checked</div>
        </div>
        <div className="iv-stat">
          <div className="iv-stat-bar" style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
          <div className="iv-stat-value">{sources.length}</div>
          <div className="iv-stat-label">Sources</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="iv-error">
          <span>✕</span> {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="iv-toolbar">
        <div className="iv-search">
          <span className="iv-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, phone, role, or source..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="iv-select"
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Sources ({sources.length})</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Filter info */}
      {(searchQuery || sourceFilter !== 'all') && (
        <div className="iv-filter-info">
          Showing {filteredCandidates.length} of {candidates.length} candidates
          <span className="iv-filter-clear" onClick={() => { setSearchQuery(''); setSourceFilter('all'); }}>
            Clear filters
          </span>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="iv-bulk-bar">
          <div className="iv-bulk-left">
            <div className="iv-bulk-count">{selected.size}</div>
            <div>
              <div className="iv-bulk-label">selected</div>
              {selected.size < filteredCandidates.length && (
                <button
                  className="iv-bulk-select-all"
                  onClick={() => setSelected(new Set(filteredCandidates.map(c => c.id)))}
                >
                  Select all {filteredCandidates.length}
                </button>
              )}
            </div>
          </div>
          <div className="iv-bulk-right">
            <button className="iv-bulk-btn iv-bulk-btn-wa" onClick={handleStartCampaign}>
              💬 WhatsApp Campaign
            </button>
            <button className="iv-bulk-btn iv-bulk-btn-ghost" onClick={handleMarkAsCalled}>
              ✓ Mark Called
            </button>
            <button className="iv-bulk-btn iv-bulk-btn-ghost" onClick={handleBulkDelete}>
              🗑 Delete
            </button>
            <button className="iv-bulk-btn iv-bulk-btn-clear" onClick={() => setSelected(new Set())}>
              ✕ Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="iv-table-wrap">
        {loading ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                <div className="iv-skeleton" style={{ width: 18, height: 18 }} />
                <div className="iv-skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
                <div style={{ flex: 1 }}>
                  <div className="iv-skeleton" style={{ width: 140, height: 14, marginBottom: 6 }} />
                  <div className="iv-skeleton" style={{ width: 100, height: 10 }} />
                </div>
                <div className="iv-skeleton" style={{ width: 80, height: 24, borderRadius: 6 }} />
                <div className="iv-skeleton" style={{ width: 70, height: 14 }} />
              </div>
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <div className="iv-empty">
            <div className="iv-empty-icon">📭</div>
            <h3 className="iv-empty-title">No imported candidates</h3>
            <p className="iv-empty-text">Import candidates from CSV to build your talent pool and start outreach.</p>
            <button className="iv-btn iv-btn-primary" onClick={onOpenImport}>
              + Import Candidates
            </button>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="iv-empty">
            <div className="iv-empty-icon">🔍</div>
            <h3 className="iv-empty-title">No results</h3>
            <p className="iv-empty-text">No candidates match &ldquo;{searchQuery}&rdquo;. Try a different search.</p>
          </div>
        ) : (
          <>
            <table className="iv-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="iv-checkbox"
                      checked={selected.size === filteredCandidates.length && filteredCandidates.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Phone</th>
                  <th>Roles</th>
                  <th>Source</th>
                  <th>Imported</th>
                  <th>Compliance</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCandidates.map(c => {
                  const isSelected = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={isSelected ? 'iv-row-selected' : ''}
                      onClick={() => onSelectCandidate(c)}
                    >
                      <td onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="iv-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                        />
                      </td>
                      <td>
                        <div className="iv-cell-name">
                          <div className="iv-avatar" style={{ background: getAvatarColor(c.name || '') }}>
                            {getInitials(c.name)}
                          </div>
                          <span className="iv-name-text">{c.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="iv-cell-phone">{formatPhone(c.phone_e164)}</span>
                      </td>
                      <td>
                        {Array.isArray(c.roles) && c.roles.length > 0 ? (
                          <div>
                            {c.roles.slice(0, 2).map((r, i) => (
                              <span key={i} className="iv-role-tag">{r}</span>
                            ))}
                            {c.roles.length > 2 && (
                              <span className="iv-role-more">+{c.roles.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#d1d5db' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="iv-source-tag">
                          {c.source ? (c.source.length > 22 ? c.source.slice(0, 22) + '…' : c.source) : 'Import'}
                        </span>
                      </td>
                      <td>
                        <div className="iv-date">{timeAgo(c.created_at)}</div>
                        <div className="iv-date-sub">{formatDate(c.created_at)}</div>
                      </td>
                      <td>
                        <div className="iv-compliance-icons">
                          <div
                            className={`iv-compliance-icon ${c.driver === 'Yes' ? 'iv-compliance-yes' : 'iv-compliance-no'}`}
                            title={`Driver: ${c.driver || 'Unknown'}`}
                          >
                            🚗
                          </div>
                          <div
                            className={`iv-compliance-icon ${c.dbs_update_service === 'Yes' ? 'iv-compliance-yes' : 'iv-compliance-no'}`}
                            title={`DBS: ${c.dbs_update_service || 'Unknown'}`}
                          >
                            ✓
                          </div>
                          <div
                            className={`iv-compliance-icon ${c.mandatory_training === 'Yes' ? 'iv-compliance-yes' : 'iv-compliance-no'}`}
                            title={`Training: ${c.mandatory_training || 'Unknown'}`}
                          >
                            📚
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="iv-pagination">
                <div className="iv-page-info">
                  Page {page} of {totalPages} · {filteredCandidates.length} candidates
                </div>
                <div className="iv-page-buttons">
                  <button
                    className="iv-page-btn"
                    disabled={page === 1}
                    onClick={() => setPage(1)}
                  >
                    ‹‹
                  </button>
                  <button
                    className="iv-page-btn"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    ‹ Prev
                  </button>
                  {/* Page number buttons */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`iv-page-btn ${page === pageNum ? 'iv-page-btn-active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    className="iv-page-btn"
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next ›
                  </button>
                  <button
                    className="iv-page-btn"
                    disabled={page === totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    ››
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
