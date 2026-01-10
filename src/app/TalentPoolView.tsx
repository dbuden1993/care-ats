'use client';
import { useState } from 'react';

export default function TalentPoolView({ candidates }: { candidates: any[] }) {
  const [pools] = useState([
    { id: 'silver', name: 'Silver Medalists', desc: 'Strong candidates not selected for previous roles', color: '#9ca3af', count: 12 },
    { id: 'passive', name: 'Passive Talent', desc: 'Not actively looking but open to opportunities', color: '#6366f1', count: 28 },
    { id: 'future', name: 'Future Potentials', desc: 'Junior candidates to consider for future roles', color: '#10b981', count: 8 },
    { id: 'rehire', name: 'Boomerangs', desc: 'Former employees open to returning', color: '#f59e0b', count: 5 },
  ]);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [showNewPool, setShowNewPool] = useState(false);

  const poolCandidates = candidates.filter(c => c.tags?.includes(`pool:${selectedPool}`)).slice(0, 10);

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .pool-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .pool-title{font-size:20px;font-weight:600;color:#111}
        .pool-btn{padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .pool-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px}
        .pool-card{background:#fff;border:2px solid #e5e7eb;border-radius:12px;padding:20px;cursor:pointer;transition:all .15s}
        .pool-card:hover{border-color:#d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.05)}
        .pool-card.active{border-color:#4f46e5;background:#fafafe}
        .pool-card-header{display:flex;align-items:center;gap:12px;margin-bottom:12px}
        .pool-dot{width:12px;height:12px;border-radius:50%}
        .pool-name{font-size:16px;font-weight:600;color:#111}
        .pool-desc{font-size:13px;color:#6b7280;margin-bottom:12px}
        .pool-count{font-size:24px;font-weight:700;color:#111}
        .pool-count-label{font-size:12px;color:#6b7280}
        .pool-actions{display:flex;gap:8px;margin-top:12px}
        .pool-action{padding:6px 12px;font-size:11px;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer}
        .pool-action:hover{background:#e5e7eb}
        .pool-candidates{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .pool-cand-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .pool-cand-title{font-size:14px;font-weight:600;color:#111}
        .pool-cand-list{padding:8px}
        .pool-cand-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;cursor:pointer}
        .pool-cand-item:hover{background:#f9fafb}
        .pool-cand-avatar{width:36px;height:36px;background:#6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:14px}
        .pool-cand-info{flex:1}
        .pool-cand-name{font-size:13px;font-weight:500;color:#111}
        .pool-cand-role{font-size:11px;color:#6b7280}
        .pool-cand-action{padding:6px 12px;font-size:11px;background:#4f46e5;color:#fff;border:none;border-radius:6px;cursor:pointer}
        .pool-empty{padding:40px;text-align:center;color:#9ca3af;font-size:13px}
        .new-pool-card{background:#f9fafb;border:2px dashed #d1d5db;border-radius:12px;padding:40px;text-align:center;cursor:pointer}
        .new-pool-card:hover{border-color:#6366f1;background:#fafafe}
      `}</style>
      
      <div className="pool-header"><h2 className="pool-title">Talent Pools</h2><button className="pool-btn">+ Create Pool</button></div>
      
      <div className="pool-grid">
        {pools.map(p => (
          <div key={p.id} className={`pool-card ${selectedPool === p.id ? 'active' : ''}`} onClick={() => setSelectedPool(selectedPool === p.id ? null : p.id)}>
            <div className="pool-card-header"><div className="pool-dot" style={{ background: p.color }} /><span className="pool-name">{p.name}</span></div>
            <div className="pool-desc">{p.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div><div className="pool-count">{p.count}</div><div className="pool-count-label">candidates</div></div>
              <div className="pool-actions"><button className="pool-action">📧 Email All</button><button className="pool-action">✏️ Edit</button></div>
            </div>
          </div>
        ))}
        <div className="new-pool-card" onClick={() => setShowNewPool(true)}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>➕</div>
          <div style={{ fontWeight: 600, color: '#374151' }}>Create New Pool</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Organize candidates for future opportunities</div>
        </div>
      </div>
      
      {selectedPool && (
        <div className="pool-candidates">
          <div className="pool-cand-header">
            <span className="pool-cand-title">{pools.find(p => p.id === selectedPool)?.name} Candidates</span>
            <button className="pool-action">View All →</button>
          </div>
          <div className="pool-cand-list">
            {poolCandidates.length === 0 ? <div className="pool-empty">No candidates in this pool yet</div> : poolCandidates.map(c => (
              <div key={c.id} className="pool-cand-item">
                <div className="pool-cand-avatar">{(c.name || '?')[0]}</div>
                <div className="pool-cand-info"><div className="pool-cand-name">{c.name || 'Unknown'}</div><div className="pool-cand-role">{c.roles || 'No role specified'}</div></div>
                <button className="pool-cand-action">Contact</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
