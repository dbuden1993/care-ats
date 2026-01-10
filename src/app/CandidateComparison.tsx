'use client';
import { useState } from 'react';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import ProgressRing from './ProgressRing';
import Button from './Button';

interface Props {
  candidates: any[];
  onClose: () => void;
  onSelect?: (candidateId: string) => void;
}

export default function CandidateComparison({ candidates, onClose, onSelect }: Props) {
  const [selected, setSelected] = useState<string[]>(candidates.slice(0, 3).map(c => c.id));

  const selectedCandidates = candidates.filter(c => selected.includes(c.id));

  const criteria = [
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'experience', label: 'Experience', type: 'text' },
    { key: 'energy_ratio', label: 'Energy Score', type: 'score' },
    { key: 'driver', label: 'Driver License', type: 'boolean' },
    { key: 'dbs_update_service', label: 'DBS Check', type: 'boolean' },
    { key: 'mandatory_training', label: 'Training Complete', type: 'boolean' },
    { key: 'earliest_start_date', label: 'Available From', type: 'date' },
    { key: 'source', label: 'Source', type: 'text' },
  ];

  const getRoles = (roles: any): string => {
    if (!roles) return 'Not specified';
    if (Array.isArray(roles)) return roles.join(', ');
    return String(roles);
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

  const renderValue = (candidate: any, criterion: typeof criteria[0]) => {
    const value = candidate[criterion.key];
    
    switch (criterion.type) {
      case 'status':
        return <StatusBadge status={value || 'new'} size="sm" />;
      case 'score':
        if (value === null || value === undefined) return <span style={{ color: '#9ca3af' }}>—</span>;
        const color = value >= 4 ? '#10b981' : value >= 3 ? '#f59e0b' : '#ef4444';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
              <div style={{ width: `${(value / 5) * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
            </div>
            <span style={{ fontWeight: 700, color }}>{value.toFixed(1)}</span>
          </div>
        );
      case 'boolean':
        if (value === 'Yes') return <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Yes</span>;
        if (value === 'No') return <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ No</span>;
        return <span style={{ color: '#9ca3af' }}>Unknown</span>;
      case 'date':
        return fmtDate(value);
      default:
        return value || <span style={{ color: '#9ca3af' }}>—</span>;
    }
  };

  const getBestCandidate = () => {
    let best = selectedCandidates[0];
    let bestScore = 0;
    
    selectedCandidates.forEach(c => {
      let score = 0;
      if (c.energy_ratio) score += c.energy_ratio * 10;
      if (c.driver === 'Yes') score += 10;
      if (c.dbs_update_service === 'Yes') score += 15;
      if (c.mandatory_training === 'Yes') score += 10;
      if (c.status === 'interview' || c.status === 'offer') score += 20;
      if (score > bestScore) { bestScore = score; best = c; }
    });
    
    return best?.id;
  };

  const bestId = getBestCandidate();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .compare-modal{background:#fff;border-radius:20px;width:100%;max-width:1000px;max-height:90vh;display:flex;flex-direction:column;animation:compareIn .25s ease}
        @keyframes compareIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
        .compare-header{padding:24px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between}
        .compare-title{font-size:20px;font-weight:700;color:#111}
        .compare-subtitle{font-size:13px;color:#6b7280;margin-top:4px}
        .compare-close{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;font-size:18px;color:#6b7280;transition:all .15s}
        .compare-close:hover{background:#e5e7eb;color:#111}
        .compare-body{flex:1;overflow:auto;padding:0}
        .compare-table{width:100%;border-collapse:collapse}
        .compare-th{padding:16px;text-align:center;border-bottom:1px solid #e5e7eb;background:#fafbfc;position:sticky;top:0}
        .compare-th.label{text-align:left;width:160px;font-size:12px;font-weight:600;color:#6b7280}
        .compare-th.best{background:#ecfdf5}
        .compare-candidate{display:flex;flex-direction:column;align-items:center;gap:8px}
        .compare-candidate-name{font-size:14px;font-weight:600;color:#111;text-align:center}
        .compare-candidate-role{font-size:11px;color:#6b7280;max-width:150px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .compare-best-badge{padding:4px 10px;background:#10b981;color:#fff;border-radius:12px;font-size:10px;font-weight:700;margin-top:4px}
        .compare-td{padding:14px 16px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151}
        .compare-td.label{text-align:left;font-weight:500;color:#6b7280;background:#fafbfc}
        .compare-td.best{background:#ecfdf510}
        .compare-footer{padding:20px 24px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:12px}
        .compare-remove{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#fef2f2;border:none;border-radius:6px;cursor:pointer;font-size:12px;color:#ef4444;margin-top:8px;transition:all .15s}
        .compare-remove:hover{background:#fee2e2}
      `}</style>

      <div className="compare-modal">
        <div className="compare-header">
          <div>
            <h2 className="compare-title">Compare Candidates</h2>
            <p className="compare-subtitle">Side-by-side comparison of {selectedCandidates.length} candidates</p>
          </div>
          <button className="compare-close" onClick={onClose}>✕</button>
        </div>

        <div className="compare-body">
          <table className="compare-table">
            <thead>
              <tr>
                <th className="compare-th label">Criteria</th>
                {selectedCandidates.map(c => (
                  <th key={c.id} className={`compare-th ${c.id === bestId ? 'best' : ''}`}>
                    <div className="compare-candidate">
                      <Avatar name={c.name} size="lg" />
                      <div className="compare-candidate-name">{c.name}</div>
                      <div className="compare-candidate-role">{getRoles(c.roles)}</div>
                      {c.id === bestId && <div className="compare-best-badge">⭐ Best Match</div>}
                      {selectedCandidates.length > 2 && (
                        <button 
                          className="compare-remove"
                          onClick={() => setSelected(s => s.filter(id => id !== c.id))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map(crit => (
                <tr key={crit.key}>
                  <td className="compare-td label">{crit.label}</td>
                  {selectedCandidates.map(c => (
                    <td key={c.id} className={`compare-td ${c.id === bestId ? 'best' : ''}`}>
                      {renderValue(c, crit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="compare-footer">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {onSelect && bestId && (
            <Button variant="primary" icon="✓" onClick={() => onSelect(bestId)}>
              Select Best Candidate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
