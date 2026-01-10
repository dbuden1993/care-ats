'use client';
import { useState } from 'react';
import Avatar from './Avatar';
import Button from './Button';

interface Props {
  candidate: any;
  onSave: (note: string, type: string) => void;
  onClose: () => void;
}

const NOTE_TYPES = [
  { id: 'general', label: 'General Note', icon: '📝', color: '#6366f1' },
  { id: 'call', label: 'Phone Call', icon: '📞', color: '#10b981' },
  { id: 'email', label: 'Email Sent', icon: '✉️', color: '#3b82f6' },
  { id: 'meeting', label: 'Meeting', icon: '🤝', color: '#f59e0b' },
  { id: 'feedback', label: 'Interview Feedback', icon: '💬', color: '#8b5cf6' },
  { id: 'concern', label: 'Concern/Flag', icon: '⚠️', color: '#ef4444' },
];

export default function QuickNoteModal({ candidate, onSave, onClose }: Props) {
  const [note, setNote] = useState('');
  const [type, setType] = useState('general');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 300));
    onSave(note, type);
    setSaving(false);
  };

  const selectedType = NOTE_TYPES.find(t => t.id === type);

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
        .qnote-modal{background:#fff;border-radius:20px;width:100%;max-width:500px;animation:qnoteIn .2s ease}
        @keyframes qnoteIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .qnote-header{padding:20px 24px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:14px}
        .qnote-info h3{font-size:16px;font-weight:700;color:#111;margin:0}
        .qnote-info p{font-size:12px;color:#6b7280;margin:4px 0 0}
        .qnote-body{padding:20px 24px}
        .qnote-types{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
        .qnote-type{display:flex;align-items:center;gap:6px;padding:8px 14px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;cursor:pointer;font-size:12px;font-weight:600;color:#6b7280;transition:all .15s}
        .qnote-type:hover{border-color:#d1d5db}
        .qnote-type.selected{border-color:var(--color);background:var(--bg);color:var(--color)}
        .qnote-textarea{width:100%;padding:14px;border:1px solid #e5e7eb;border-radius:12px;font-size:14px;line-height:1.6;resize:none;min-height:120px;transition:all .15s}
        .qnote-textarea:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .qnote-textarea::placeholder{color:#9ca3af}
        .qnote-footer{padding:16px 24px;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center}
        .qnote-char{font-size:11px;color:#9ca3af}
        .qnote-actions{display:flex;gap:10px}
      `}</style>

      <div className="qnote-modal">
        <div className="qnote-header">
          <Avatar name={candidate.name} size="md" />
          <div className="qnote-info">
            <h3>Add Note</h3>
            <p>{candidate.name}</p>
          </div>
        </div>

        <div className="qnote-body">
          <div className="qnote-types">
            {NOTE_TYPES.map(t => (
              <button
                key={t.id}
                className={`qnote-type ${type === t.id ? 'selected' : ''}`}
                style={{ '--color': t.color, '--bg': `${t.color}10` } as any}
                onClick={() => setType(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <textarea
            className="qnote-textarea"
            placeholder={`Add a ${selectedType?.label.toLowerCase() || 'note'}...`}
            value={note}
            onChange={e => setNote(e.target.value)}
            autoFocus
          />
        </div>

        <div className="qnote-footer">
          <span className="qnote-char">{note.length} characters</span>
          <div className="qnote-actions">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving} disabled={!note.trim()}>
              Save Note
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
