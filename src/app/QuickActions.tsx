'use client';
import { useState } from 'react';
import { updateCandidateStatus } from './db';

interface Props {
  candidate: any;
  onUpdate?: () => void;
  onSchedule?: () => void;
  onEmail?: () => void;
}

export default function QuickActions({ candidate, onUpdate, onSchedule, onEmail }: Props) {
  const [updating, setUpdating] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(newStatus);
    try {
      await updateCandidateStatus(candidate.id, newStatus);
      onUpdate?.();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
    setUpdating(null);
  };

  const openWhatsApp = () => {
    const phone = candidate.phone_e164?.replace(/\D/g, '');
    if (phone) window.open(`https://wa.me/${phone}`, '_blank');
  };

  const openCall = () => {
    const phone = candidate.phone_e164;
    if (phone) window.location.href = `tel:${phone}`;
  };

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 0' }}>
      <style>{`
        .qa-btn{display:flex;align-items:center;gap:6px;padding:8px 14px;font-size:12px;font-weight:500;border-radius:8px;cursor:pointer;border:none;transition:all .15s}
        .qa-btn:disabled{opacity:.5;cursor:not-allowed}
        .qa-btn.primary{background:#4f46e5;color:#fff}
        .qa-btn.primary:hover:not(:disabled){background:#4338ca}
        .qa-btn.success{background:#ecfdf5;color:#059669}
        .qa-btn.success:hover:not(:disabled){background:#d1fae5}
        .qa-btn.danger{background:#fef2f2;color:#dc2626}
        .qa-btn.danger:hover:not(:disabled){background:#fee2e2}
        .qa-btn.warning{background:#fef3c7;color:#b45309}
        .qa-btn.warning:hover:not(:disabled){background:#fde68a}
        .qa-btn.whatsapp{background:#dcfce7;color:#16a34a}
        .qa-btn.whatsapp:hover:not(:disabled){background:#bbf7d0}
        .qa-btn.secondary{background:#f3f4f6;color:#374151}
        .qa-btn.secondary:hover:not(:disabled){background:#e5e7eb}
        .qa-divider{width:1px;height:32px;background:#e5e7eb;margin:0 4px}
      `}</style>
      
      <button className="qa-btn primary" onClick={onSchedule}>📅 Schedule</button>
      <button className="qa-btn secondary" onClick={onEmail}>✉️ Email</button>
      <button className="qa-btn whatsapp" onClick={openWhatsApp}>💬 WhatsApp</button>
      <button className="qa-btn secondary" onClick={openCall}>📞 Call</button>
      
      <div className="qa-divider" />
      
      {candidate.status !== 'interview' && (
        <button className="qa-btn success" onClick={() => handleStatusChange('interview')} disabled={updating === 'interview'}>
          {updating === 'interview' ? '...' : '→ Interview'}
        </button>
      )}
      {candidate.status !== 'offer' && candidate.status !== 'hired' && (
        <button className="qa-btn warning" onClick={() => handleStatusChange('offer')} disabled={updating === 'offer'}>
          {updating === 'offer' ? '...' : '→ Offer'}
        </button>
      )}
      {candidate.status !== 'hired' && (
        <button className="qa-btn success" onClick={() => handleStatusChange('hired')} disabled={updating === 'hired'}>
          {updating === 'hired' ? '...' : '✓ Hire'}
        </button>
      )}
      {candidate.status !== 'rejected' && (
        <button className="qa-btn danger" onClick={() => handleStatusChange('rejected')} disabled={updating === 'rejected'}>
          {updating === 'rejected' ? '...' : '✗ Reject'}
        </button>
      )}
    </div>
  );
}
