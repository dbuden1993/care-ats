'use client';
import { useState } from 'react';
import { createInterview } from './db';

interface Props { candidate: any; onClose: () => void; onSchedule: (data: any) => void; }

export default function ScheduleModal({ candidate, onClose, onSchedule }: Props) {
  const [form, setForm] = useState({ date: '', time: '', duration: '30', type: 'video', location: '', interviewers: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async () => {
    if (!form.date || !form.time) return;
    setSaving(true);
    try {
      await createInterview({
        candidate_id: candidate.id,
        scheduled_at: `${form.date}T${form.time}:00`,
        duration_minutes: parseInt(form.duration),
        type: form.type,
        location: form.type === 'in-person' ? form.location : null,
        video_link: form.type === 'video' ? `https://meet.carerecruit.com/${candidate.id.slice(0,8)}` : null,
        interviewers: form.interviewers.split(',').map(s => s.trim()).filter(Boolean),
        notes: form.notes,
        status: 'scheduled'
      });
      onSchedule({ ...form, candidate_id: candidate.id });
    } catch (err) {
      console.error('Failed to schedule:', err);
    }
    setSaving(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://carerecruit.com/schedule/${candidate.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .modal{background:#fff;border-radius:16px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:slideUp .2s ease}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .modal-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .modal-title{font-size:18px;font-weight:600;color:#111}
        .modal-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:#f3f4f6;border-radius:8px;cursor:pointer;font-size:16px;transition:all .15s}
        .modal-close:hover{background:#e5e7eb}
        .modal-body{padding:20px}
        .form-row{margin-bottom:16px}
        .form-label{display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px}
        .form-input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;transition:border-color .15s}
        .form-input:focus{outline:none;border-color:#6366f1}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .type-btns{display:flex;gap:8px}
        .type-btn{flex:1;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;text-align:center;font-size:12px;transition:all .15s}
        .type-btn:hover{border-color:#d1d5db}
        .type-btn.active{border-color:#6366f1;background:#eef2ff;color:#4f46e5}
        .duration-btns{display:flex;gap:8px}
        .duration-btn{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;text-align:center;font-size:12px;transition:all .15s}
        .duration-btn:hover{border-color:#d1d5db}
        .duration-btn.active{border-color:#6366f1;background:#eef2ff;color:#4f46e5}
        .self-schedule{background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:16px}
        .self-schedule-title{font-size:13px;font-weight:600;color:#111;margin-bottom:8px;display:flex;align-items:center;gap:6px}
        .self-schedule-desc{font-size:12px;color:#6b7280;margin-bottom:12px}
        .self-schedule-link{display:flex;gap:8px}
        .self-schedule-input{flex:1;padding:8px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;font-size:11px;color:#6b7280}
        .self-schedule-btn{padding:8px 12px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;cursor:pointer;transition:all .15s;min-width:70px}
        .self-schedule-btn:hover{background:#4338ca}
        .self-schedule-btn.copied{background:#10b981}
        .modal-footer{padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px}
        .modal-btn{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
        .modal-btn.secondary{background:#f3f4f6;border:none;color:#374151}
        .modal-btn.secondary:hover{background:#e5e7eb}
        .modal-btn.primary{background:#4f46e5;border:none;color:#fff}
        .modal-btn.primary:hover{background:#4338ca}
        .modal-btn:disabled{opacity:.5;cursor:not-allowed}
        .candidate-card{background:#eef2ff;border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:12px}
        .candidate-avatar{width:40px;height:40px;background:#4f46e5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600}
        .candidate-info h4{font-size:14px;font-weight:600;color:#111;margin:0}
        .candidate-info p{font-size:12px;color:#6b7280;margin:2px 0 0}
      `}</style>
      
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">📅 Schedule Interview</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="candidate-card">
            <div className="candidate-avatar">{(candidate.name || '?')[0]}</div>
            <div className="candidate-info">
              <h4>{candidate.name || 'Unknown'}</h4>
              <p>{candidate.roles || 'Candidate'}</p>
            </div>
          </div>
          
          <div className="self-schedule">
            <div className="self-schedule-title">🔗 Self-Scheduling Link</div>
            <div className="self-schedule-desc">Send candidate a link to book their own slot</div>
            <div className="self-schedule-link">
              <input className="self-schedule-input" value={`https://carerecruit.com/schedule/${candidate.id}`} readOnly />
              <button className={`self-schedule-btn ${copied ? 'copied' : ''}`} onClick={copyLink}>{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, margin: '16px 0' }}>— or schedule manually —</div>
          
          <div className="form-row-2">
            <div className="form-row"><label className="form-label">Date *</label><input type="date" className="form-input" min={minDate} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Time *</label><input type="time" className="form-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
          </div>
          
          <div className="form-row">
            <label className="form-label">Duration</label>
            <div className="duration-btns">
              {['15','30','45','60'].map(d => <button key={d} type="button" className={`duration-btn ${form.duration === d ? 'active' : ''}`} onClick={() => setForm({ ...form, duration: d })}>{d} min</button>)}
            </div>
          </div>
          
          <div className="form-row">
            <label className="form-label">Interview Type</label>
            <div className="type-btns">
              {[{v:'video',l:'📹 Video'},{v:'phone',l:'📞 Phone'},{v:'in-person',l:'🏢 In-Person'}].map(t => <button key={t.v} type="button" className={`type-btn ${form.type === t.v ? 'active' : ''}`} onClick={() => setForm({ ...form, type: t.v })}>{t.l}</button>)}
            </div>
          </div>
          
          {form.type === 'in-person' && <div className="form-row"><label className="form-label">Location</label><input className="form-input" placeholder="Office address or meeting room" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>}
          
          <div className="form-row"><label className="form-label">Interviewers</label><input className="form-input" placeholder="John Doe, Jane Smith" value={form.interviewers} onChange={e => setForm({ ...form, interviewers: e.target.value })} /></div>
          <div className="form-row"><label className="form-label">Notes for candidate</label><textarea className="form-input" style={{ minHeight: 60, resize: 'vertical' }} placeholder="What to prepare, what to bring..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn primary" onClick={handleSubmit} disabled={!form.date || !form.time || saving}>{saving ? 'Scheduling...' : 'Schedule Interview'}</button>
        </div>
      </div>
    </div>
  );
}
