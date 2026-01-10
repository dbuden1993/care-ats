'use client';
import { useState } from 'react';
import { updateCandidateStatus, deleteCandidates } from './db';

interface Props {
  selectedIds: Set<string>;
  candidates: any[];
  onClear: () => void;
  onUpdate: () => void;
  onEmail: (candidates: any[]) => void;
}

export default function BulkActionsBar({ selectedIds, candidates, onClear, onUpdate, onEmail }: Props) {
  const [action, setAction] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const selected = candidates.filter(c => selectedIds.has(c.id));
  const count = selected.length;

  if (count === 0) return null;

  const handleBulkStatus = async (status: string) => {
    setAction(status);
    setProcessing(true);
    setProgress(0);
    
    for (let i = 0; i < selected.length; i++) {
      try {
        await updateCandidateStatus(selected[i].id, status);
      } catch (err) {
        console.error('Failed to update:', selected[i].id, err);
      }
      setProgress(Math.round(((i + 1) / selected.length) * 100));
    }
    
    setProcessing(false);
    setAction(null);
    onClear();
    onUpdate();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${count} candidate${count > 1 ? 's' : ''}?\n\nThis cannot be undone.`)) return;
    
    setAction('delete');
    setProcessing(true);
    setProgress(0);
    
    try {
      const ids = selected.map(c => c.id);
      await deleteCandidates(ids);
      setProgress(100);
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete some candidates');
    }
    
    setProcessing(false);
    setAction(null);
    onClear();
    onUpdate();
  };

  const handleBulkEmail = () => {
    onEmail(selected);
  };

  const openBulkWhatsApp = () => {
    // Open first one, show instructions for rest
    const first = selected[0];
    if (first?.phone_e164) {
      const phone = first.phone_e164.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}`, '_blank');
    }
    alert(`WhatsApp opened for first candidate.\n\n${count > 1 ? `Remaining ${count - 1} candidates:\n${selected.slice(1).map(c => `• ${c.name}: ${c.phone_e164}`).join('\n')}` : ''}`);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#111827',
      borderRadius: 12,
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      zIndex: 100,
      animation: 'slideUp 0.2s ease'
    }}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .bulk-btn { padding: 8px 14px; font-size: 12px; font-weight: 500; border-radius: 6px; cursor: pointer; border: none; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .bulk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .bulk-btn.primary { background: #4f46e5; color: #fff; }
        .bulk-btn.primary:hover:not(:disabled) { background: #4338ca; }
        .bulk-btn.success { background: #059669; color: #fff; }
        .bulk-btn.success:hover:not(:disabled) { background: #047857; }
        .bulk-btn.danger { background: #dc2626; color: #fff; }
        .bulk-btn.danger:hover:not(:disabled) { background: #b91c1c; }
        .bulk-btn.secondary { background: #374151; color: #fff; }
        .bulk-btn.secondary:hover:not(:disabled) { background: #4b5563; }
        .bulk-btn.whatsapp { background: #25d366; color: #fff; }
        .bulk-btn.whatsapp:hover:not(:disabled) { background: #20bd5a; }
        .bulk-divider { width: 1px; height: 24px; background: #374151; }
        .bulk-progress { position: absolute; bottom: 0; left: 0; height: 3px; background: #4f46e5; border-radius: 0 0 12px 12px; transition: width 0.2s; }
      `}</style>
      
      {processing && <div className="bulk-progress" style={{ width: `${progress}%` }} />}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, background: '#4f46e5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>{count}</div>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>selected</span>
      </div>
      
      <div className="bulk-divider" />
      
      <button className="bulk-btn secondary" onClick={handleBulkEmail} disabled={processing}>✉️ Email All</button>
      <button className="bulk-btn whatsapp" onClick={openBulkWhatsApp} disabled={processing}>💬 WhatsApp</button>
      
      <div className="bulk-divider" />
      
      <button className="bulk-btn success" onClick={() => handleBulkStatus('interview')} disabled={processing}>
        {action === 'interview' ? `${progress}%` : '→ Interview'}
      </button>
      <button className="bulk-btn primary" onClick={() => handleBulkStatus('offer')} disabled={processing}>
        {action === 'offer' ? `${progress}%` : '→ Offer'}
      </button>
      <button className="bulk-btn danger" onClick={() => handleBulkStatus('rejected')} disabled={processing}>
        {action === 'rejected' ? `${progress}%` : '✗ Reject'}
      </button>
      <button className="bulk-btn" style={{background:'#7f1d1d',color:'#fff'}} onClick={handleBulkDelete} disabled={processing}>
        {action === 'delete' ? `${progress}%` : '🗑️ Delete'}
      </button>
      
      <div className="bulk-divider" />
      
      <button className="bulk-btn secondary" onClick={onClear} disabled={processing}>✕ Clear</button>
    </div>
  );
}
