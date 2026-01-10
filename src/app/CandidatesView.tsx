'use client';
import { useState } from 'react';
import { deleteCandidate } from './db';

interface Props {
  candidates: any[];
  searchQuery?: string;
  selected?: Set<string>;
  onSelect?: (selected: Set<string>) => void;
  onCandidateClick?: (candidate: any) => void;
  onUpdate?: () => void;
}

export default function CandidatesView({ candidates, searchQuery, selected = new Set(), onSelect, onCandidateClick, onUpdate }: Props) {
  const [sortField, setSortField] = useState<string>('last_called_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${name}? This will permanently remove all their data.`)) return;
    
    setDeletingId(id);
    try {
      await deleteCandidate(id);
      onUpdate?.();
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete candidate');
    }
    setDeletingId(null);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sorted = [...candidates].sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    onSelect?.(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === candidates.length) {
      onSelect?.(new Set());
    } else {
      onSelect?.(new Set(candidates.map(c => c.id)));
    }
  };

  const fmtPhone = (p: string) => {
    if (!p) return '—';
    if (p.startsWith('+44')) return `0${p.slice(3, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
    return p;
  };

  const fmtDate = (d: string) => {
    if (!d) return '—';
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getRoles = (roles: any): string => {
    if (!roles) return '—';
    if (Array.isArray(roles)) return roles.join(', ');
    return String(roles);
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    new: { bg: '#eef2ff', text: '#4f46e5' },
    screening: { bg: '#f3e8ff', text: '#7c3aed' },
    interview: { bg: '#fef3c7', text: '#b45309' },
    offer: { bg: '#ecfdf5', text: '#059669' },
    hired: { bg: '#d1fae5', text: '#047857' },
    rejected: { bg: '#fef2f2', text: '#dc2626' },
  };

  const highlightMatch = (text: string, query?: string) => {
    if (!query || !text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#fef08a', padding: '0 2px', borderRadius: 2 }}>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div style={{ overflow: 'auto' }}>
      <style>{`
        .cand-table{width:100%;border-collapse:collapse}
        .cand-th{padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;background:#f9fafb;position:sticky;top:0;cursor:pointer;user-select:none;white-space:nowrap}
        .cand-th:hover{color:#111}
        .cand-th-sort{margin-left:4px;opacity:.5}
        .cand-th.active .cand-th-sort{opacity:1}
        .cand-tr{border-bottom:1px solid #f3f4f6;transition:background .1s;cursor:pointer}
        .cand-tr:hover{background:#f9fafb}
        .cand-tr.selected{background:#eef2ff}
        .cand-td{padding:12px;font-size:13px;color:#374151;vertical-align:middle}
        .cand-checkbox{width:18px;height:18px;border:2px solid #d1d5db;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
        .cand-checkbox:hover{border-color:#6366f1}
        .cand-checkbox.checked{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .cand-avatar{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;color:#fff;flex-shrink:0}
        .cand-name{font-weight:500;color:#111}
        .cand-phone{font-size:12px;color:#6b7280;margin-top:2px}
        .cand-roles{font-size:12px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cand-status{display:inline-flex;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;text-transform:capitalize}
        .cand-qual{display:flex;gap:4px}
        .cand-qual-badge{width:24px;height:24px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px}
        .cand-qual-badge.yes{background:#ecfdf5}
        .cand-qual-badge.no{background:#fef2f2}
        .cand-qual-badge.unknown{background:#f3f4f6}
        .cand-energy{display:flex;align-items:center;gap:6px}
        .cand-energy-bar{width:40px;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
        .cand-energy-fill{height:100%;border-radius:3px;transition:width .3s}
        .cand-energy-val{font-size:11px;font-weight:600;width:24px}
        .cand-date{font-size:12px;color:#6b7280}
        .cand-actions{display:flex;gap:4px;opacity:0;transition:opacity .15s}
        .cand-tr:hover .cand-actions{opacity:1}
        .cand-action-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:none;background:#f3f4f6;border-radius:6px;cursor:pointer;font-size:12px;transition:all .15s}
        .cand-action-btn:hover{background:#e5e7eb}
        .cand-action-btn.primary:hover{background:#eef2ff}
        .cand-action-btn.danger{color:#ef4444}
        .cand-action-btn.danger:hover{background:#fef2f2}
      `}</style>
      
      <table className="cand-table">
        <thead>
          <tr>
            <th className="cand-th" style={{ width: 40 }}>
              <div 
                className={`cand-checkbox ${selected.size === candidates.length && candidates.length > 0 ? 'checked' : ''}`}
                onClick={toggleSelectAll}
              >
                {selected.size === candidates.length && candidates.length > 0 && '✓'}
              </div>
            </th>
            <th className={`cand-th ${sortField === 'name' ? 'active' : ''}`} onClick={() => handleSort('name')}>
              Candidate <span className="cand-th-sort">{sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className="cand-th">Roles</th>
            <th className={`cand-th ${sortField === 'status' ? 'active' : ''}`} onClick={() => handleSort('status')}>
              Status <span className="cand-th-sort">{sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className="cand-th">Qualifications</th>
            <th className={`cand-th ${sortField === 'energy_ratio' ? 'active' : ''}`} onClick={() => handleSort('energy_ratio')}>
              Energy <span className="cand-th-sort">{sortField === 'energy_ratio' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className={`cand-th ${sortField === 'last_called_at' ? 'active' : ''}`} onClick={() => handleSort('last_called_at')}>
              Last Contact <span className="cand-th-sort">{sortField === 'last_called_at' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className="cand-th" style={{ width: 100 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => {
            const isSelected = selected.has(c.id);
            const isHovered = hoveredId === c.id;
            const statusStyle = statusColors[c.status] || statusColors.new;
            const energyPct = c.energy_ratio ? Math.min(c.energy_ratio / 5 * 100, 100) : 0;
            const energyColor = c.energy_ratio >= 4 ? '#10b981' : c.energy_ratio >= 3 ? '#f59e0b' : '#ef4444';
            
            return (
              <tr 
                key={c.id} 
                className={`cand-tr ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onCandidateClick?.(c)}
              >
                <td className="cand-td">
                  <div 
                    className={`cand-checkbox ${isSelected ? 'checked' : ''}`}
                    onClick={(e) => toggleSelect(c.id, e)}
                  >
                    {isSelected && '✓'}
                  </div>
                </td>
                <td className="cand-td">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="cand-avatar" style={{ background: statusStyle.text }}>{(c.name || '?')[0].toUpperCase()}</div>
                    <div>
                      <div className="cand-name">{highlightMatch(c.name || 'Unknown', searchQuery)}</div>
                      <div className="cand-phone">{fmtPhone(c.phone_e164)}</div>
                    </div>
                  </div>
                </td>
                <td className="cand-td">
                  <div className="cand-roles">{highlightMatch(getRoles(c.roles), searchQuery)}</div>
                </td>
                <td className="cand-td">
                  <span className="cand-status" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                    {c.status || 'new'}
                  </span>
                </td>
                <td className="cand-td">
                  <div className="cand-qual">
                    <div className={`cand-qual-badge ${c.driver === 'Yes' ? 'yes' : c.driver === 'No' ? 'no' : 'unknown'}`} title="Driver">
                      🚗
                    </div>
                    <div className={`cand-qual-badge ${c.dbs_update_service === 'Yes' ? 'yes' : c.dbs_update_service === 'No' ? 'no' : 'unknown'}`} title="DBS">
                      🔒
                    </div>
                    <div className={`cand-qual-badge ${c.mandatory_training === 'Yes' ? 'yes' : c.mandatory_training === 'No' ? 'no' : 'unknown'}`} title="Training">
                      📚
                    </div>
                  </div>
                </td>
                <td className="cand-td">
                  {c.energy_ratio !== null && c.energy_ratio !== undefined ? (
                    <div className="cand-energy">
                      <div className="cand-energy-bar">
                        <div className="cand-energy-fill" style={{ width: `${energyPct}%`, background: energyColor }} />
                      </div>
                      <span className="cand-energy-val" style={{ color: energyColor }}>{c.energy_ratio.toFixed(1)}</span>
                    </div>
                  ) : (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                  )}
                </td>
                <td className="cand-td">
                  <span className="cand-date">{fmtDate(c.last_called_at)}</span>
                </td>
                <td className="cand-td">
                  <div className="cand-actions" style={{ opacity: isHovered || isSelected ? 1 : 0 }}>
                    <button className="cand-action-btn" title="Call" onClick={e => { e.stopPropagation(); window.location.href = `tel:${c.phone_e164}`; }}>📞</button>
                    <button className="cand-action-btn" title="WhatsApp" onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${c.phone_e164?.replace(/\D/g, '')}`, '_blank'); }}>💬</button>
                    <button className="cand-action-btn primary" title="View" onClick={e => { e.stopPropagation(); onCandidateClick?.(c); }}>👁️</button>
                    <button 
                      className="cand-action-btn danger" 
                      title="Delete" 
                      onClick={e => handleDelete(c.id, c.name, e)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {candidates.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div style={{ fontSize: 14 }}>No candidates found</div>
        </div>
      )}
    </div>
  );
}
