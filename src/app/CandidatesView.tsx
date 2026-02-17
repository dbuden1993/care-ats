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

  const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
    new: { bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', text: '#4f46e5', icon: '✨' },
    screening: { bg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', text: '#7c3aed', icon: '🔍' },
    interview: { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', text: '#b45309', icon: '📅' },
    offer: { bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', text: '#059669', icon: '📄' },
    hired: { bg: 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)', text: '#047857', icon: '🎉' },
    rejected: { bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', text: '#dc2626', icon: '❌' },
  };

  const highlightMatch = (text: string, query?: string) => {
    if (!query || !text) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ 
          background: 'linear-gradient(120deg, #fef3c7 0%, #fde68a 100%)', 
          padding: '1px 4px', 
          borderRadius: '4px',
          color: '#92400e'
        }}>
          {text.slice(idx, idx + query.length)}
        </mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const getAvatarGradient = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const styles = `
    .candidates-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }
    
    .ct-th {
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: var(--gray-500);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 2px solid var(--gray-100);
      background: var(--gray-50);
      position: sticky;
      top: 0;
      z-index: 10;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      transition: color var(--transition-fast);
    }
    
    .ct-th:hover {
      color: var(--gray-900);
    }
    
    .ct-th.active {
      color: var(--primary);
    }
    
    .ct-th-sort {
      margin-left: 6px;
      opacity: 0.4;
      font-size: 10px;
    }
    
    .ct-th.active .ct-th-sort {
      opacity: 1;
    }
    
    .ct-tr {
      transition: all var(--transition-fast);
      cursor: pointer;
    }
    
    .ct-tr:hover {
      background: var(--gray-50);
    }
    
    .ct-tr.selected {
      background: var(--primary-50);
    }
    
    .ct-td {
      padding: 16px;
      font-size: 14px;
      color: var(--gray-700);
      vertical-align: middle;
      border-bottom: 1px solid var(--gray-100);
    }
    
    .ct-checkbox {
      width: 20px;
      height: 20px;
      border: 2px solid var(--gray-300);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
      background: white;
    }
    
    .ct-checkbox:hover {
      border-color: var(--primary);
    }
    
    .ct-checkbox.checked {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
      border-color: var(--primary);
      color: white;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
    }
    
    .ct-avatar {
      width: 42px;
      height: 42px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 15px;
      color: white;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .ct-name {
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: 2px;
    }
    
    .ct-phone {
      font-size: 12px;
      color: var(--gray-500);
      font-family: var(--font-mono);
    }
    
    .ct-roles {
      font-size: 13px;
      color: var(--gray-600);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .ct-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
      text-transform: capitalize;
    }
    
    .ct-qual {
      display: flex;
      gap: 6px;
    }
    
    .ct-qual-badge {
      width: 30px;
      height: 30px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: transform var(--transition-fast);
    }
    
    .ct-qual-badge:hover {
      transform: scale(1.1);
    }
    
    .ct-qual-badge.yes {
      background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
    }
    
    .ct-qual-badge.no {
      background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
    }
    
    .ct-qual-badge.unknown {
      background: var(--gray-100);
      opacity: 0.6;
    }
    
    .ct-energy {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .ct-energy-bar {
      width: 50px;
      height: 8px;
      background: var(--gray-100);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    
    .ct-energy-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width 0.4s ease;
    }
    
    .ct-energy-val {
      font-size: 13px;
      font-weight: 700;
      font-family: var(--font-display);
      min-width: 28px;
    }
    
    .ct-date {
      font-size: 13px;
      color: var(--gray-500);
    }
    
    .ct-actions {
      display: flex;
      gap: 6px;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    .ct-tr:hover .ct-actions {
      opacity: 1;
    }
    
    .ct-action-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: var(--gray-100);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 14px;
      transition: all var(--transition-fast);
    }
    
    .ct-action-btn:hover {
      background: var(--gray-200);
      transform: scale(1.05);
    }
    
    .ct-action-btn.primary:hover {
      background: var(--primary-50);
    }
    
    .ct-action-btn.success:hover {
      background: var(--success-light);
    }
    
    .ct-action-btn.danger:hover {
      background: var(--danger-light);
    }
    
    .ct-empty {
      text-align: center;
      padding: 80px 40px;
    }
    
    .ct-empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.4;
    }
    
    .ct-empty-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 8px;
    }
    
    .ct-empty-text {
      font-size: 14px;
      color: var(--gray-500);
    }
  `;

  return (
    <div style={{ overflow: 'auto' }}>
      <style>{styles}</style>
      
      <table className="candidates-table">
        <thead>
          <tr>
            <th className="ct-th" style={{ width: 50 }}>
              <div 
                className={`ct-checkbox ${selected.size === candidates.length && candidates.length > 0 ? 'checked' : ''}`}
                onClick={toggleSelectAll}
              >
                {selected.size === candidates.length && candidates.length > 0 && '✓'}
              </div>
            </th>
            <th className={`ct-th ${sortField === 'name' ? 'active' : ''}`} onClick={() => handleSort('name')}>
              Candidate <span className="ct-th-sort">{sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className="ct-th">Roles</th>
            <th className={`ct-th ${sortField === 'status' ? 'active' : ''}`} onClick={() => handleSort('status')}>
              Status <span className="ct-th-sort">{sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className="ct-th">Qualifications</th>
            <th className={`ct-th ${sortField === 'energy_ratio' ? 'active' : ''}`} onClick={() => handleSort('energy_ratio')}>
              Energy <span className="ct-th-sort">{sortField === 'energy_ratio' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className={`ct-th ${sortField === 'last_called_at' ? 'active' : ''}`} onClick={() => handleSort('last_called_at')}>
              Last Contact <span className="ct-th-sort">{sortField === 'last_called_at' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
            </th>
            <th className="ct-th" style={{ width: 140 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, index) => {
            const isSelected = selected.has(c.id);
            const isHovered = hoveredId === c.id;
            const status = statusConfig[c.status] || statusConfig.new;
            const energyPct = c.energy_ratio ? Math.min(c.energy_ratio / 5 * 100, 100) : 0;
            const energyColor = c.energy_ratio >= 4 ? 'var(--success)' : c.energy_ratio >= 3 ? 'var(--warning)' : 'var(--danger)';
            
            return (
              <tr 
                key={c.id} 
                className={`ct-tr ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onCandidateClick?.(c)}
                style={{ animationDelay: `${index * 20}ms` }}
              >
                <td className="ct-td">
                  <div 
                    className={`ct-checkbox ${isSelected ? 'checked' : ''}`}
                    onClick={(e) => toggleSelect(c.id, e)}
                  >
                    {isSelected && '✓'}
                  </div>
                </td>
                <td className="ct-td">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div className="ct-avatar" style={{ background: getAvatarGradient(c.name) }}>
                      {(c.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="ct-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {highlightMatch(c.name || 'Unknown', searchQuery)}
                        {c.source === 'whatsapp' && !c.last_called_at && (
                          <span title="WhatsApp contact" style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>WA</span>
                        )}
                      </div>
                      <div className="ct-phone">{fmtPhone(c.phone_e164)}</div>
                    </div>
                  </div>
                </td>
                <td className="ct-td">
                  <div className="ct-roles">{highlightMatch(getRoles(c.roles), searchQuery)}</div>
                </td>
                <td className="ct-td">
                  <span className="ct-status" style={{ background: status.bg, color: status.text }}>
                    <span>{status.icon}</span>
                    {c.status || 'new'}
                  </span>
                </td>
                <td className="ct-td">
                  <div className="ct-qual">
                    <div 
                      className={`ct-qual-badge ${c.driver === 'Yes' ? 'yes' : c.driver === 'No' ? 'no' : 'unknown'}`} 
                      title={`Driver: ${c.driver || 'Unknown'}`}
                    >
                      🚗
                    </div>
                    <div 
                      className={`ct-qual-badge ${c.dbs_update_service === 'Yes' ? 'yes' : c.dbs_update_service === 'No' ? 'no' : 'unknown'}`} 
                      title={`DBS: ${c.dbs_update_service || 'Unknown'}`}
                    >
                      🔒
                    </div>
                    <div 
                      className={`ct-qual-badge ${c.mandatory_training === 'Yes' ? 'yes' : c.mandatory_training === 'No' ? 'no' : 'unknown'}`} 
                      title={`Training: ${c.mandatory_training || 'Unknown'}`}
                    >
                      📚
                    </div>
                  </div>
                </td>
                <td className="ct-td">
                  {c.energy_ratio !== null && c.energy_ratio !== undefined ? (
                    <div className="ct-energy">
                      <div className="ct-energy-bar">
                        <div 
                          className="ct-energy-fill" 
                          style={{ 
                            width: `${energyPct}%`, 
                            background: `linear-gradient(90deg, ${energyColor} 0%, ${energyColor}88 100%)` 
                          }} 
                        />
                      </div>
                      <span className="ct-energy-val" style={{ color: energyColor }}>
                        {c.energy_ratio.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>—</span>
                  )}
                </td>
                <td className="ct-td">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12 }}>
                      {c._last_activity && !c.last_called_at ? '💬' : c.last_called_at ? '📞' : ''}
                    </span>
                    <span className="ct-date">{fmtDate((c as any)._last_activity || c.last_called_at)}</span>
                  </div>
                </td>
                <td className="ct-td">
                  <div className="ct-actions" style={{ opacity: isHovered || isSelected ? 1 : 0 }}>
                    <button 
                      className="ct-action-btn success" 
                      title="Call" 
                      onClick={e => { e.stopPropagation(); window.location.href = `tel:${c.phone_e164}`; }}
                    >
                      📞
                    </button>
                    <button 
                      className="ct-action-btn" 
                      title="WhatsApp" 
                      onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${c.phone_e164?.replace(/\D/g, '')}`, '_blank'); }}
                    >
                      💬
                    </button>
                    <button 
                      className="ct-action-btn primary" 
                      title="View Details" 
                      onClick={e => { e.stopPropagation(); onCandidateClick?.(c); }}
                    >
                      👁️
                    </button>
                    <button 
                      className="ct-action-btn danger" 
                      title="Delete" 
                      onClick={e => handleDelete(c.id, c.name, e)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {candidates.length === 0 && (
        <div className="ct-empty">
          <div className="ct-empty-icon">👥</div>
          <div className="ct-empty-title">No candidates found</div>
          <div className="ct-empty-text">
            {searchQuery 
              ? `No results for "${searchQuery}". Try a different search.`
              : 'Start by adding candidates or importing from a CSV file.'
            }
          </div>
        </div>
      )}
    </div>
  );
}
