'use client';
import { useState } from 'react';

interface Props { job?: any; onClose: () => void; onSave: (data: any) => void; }

export default function JobModal({ job, onClose, onSave }: Props) {
  const [form, setForm] = useState(job || { title: '', department: '', location: '', type: 'full-time', description: '', requirements: '', salary_min: '', salary_max: '', salary_type: 'hourly', status: 'draft' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <style>{`
        .modal{background:#fff;border-radius:16px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto}
        .modal-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .modal-title{font-size:18px;font-weight:600;color:#111}
        .modal-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:#f3f4f6;border-radius:8px;cursor:pointer;font-size:16px}
        .modal-body{padding:20px}
        .form-section{margin-bottom:24px}
        .form-section-title{font-size:14px;font-weight:600;color:#111;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e5e7eb}
        .form-row{margin-bottom:16px}
        .form-label{display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px}
        .form-input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .form-input:focus{outline:none;border-color:#6366f1}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
        .type-btns{display:flex;gap:8px}
        .type-btn{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;text-align:center;font-size:12px}
        .type-btn:hover{border-color:#d1d5db}
        .type-btn.active{border-color:#6366f1;background:#eef2ff;color:#4f46e5}
        .salary-row{display:flex;align-items:center;gap:8px}
        .salary-input{width:100px;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .modal-footer{padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px}
        .modal-btn{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .modal-btn.secondary{background:#f3f4f6;border:none;color:#374151}
        .modal-btn.primary{background:#4f46e5;border:none;color:#fff}
        .modal-btn.success{background:#059669;border:none;color:#fff}
      `}</style>
      
      <div className="modal">
        <div className="modal-header"><span className="modal-title">{job ? 'Edit Job' : 'Create Job'}</span><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="modal-body">
          <div className="form-section">
            <div className="form-section-title">Basic Information</div>
            <div className="form-row"><label className="form-label">Job Title *</label><input className="form-input" placeholder="e.g. Care Assistant" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="form-row-2">
              <div className="form-row"><label className="form-label">Department</label><input className="form-input" placeholder="e.g. Care Services" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Location</label><input className="form-input" placeholder="e.g. London" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            </div>
            <div className="form-row"><label className="form-label">Employment Type</label><div className="type-btns">{['full-time','part-time','contract','zero-hours'].map(t => <button key={t} className={`type-btn ${form.type === t ? 'active' : ''}`} onClick={() => setForm({ ...form, type: t })}>{t}</button>)}</div></div>
          </div>
          
          <div className="form-section">
            <div className="form-section-title">Compensation</div>
            <div className="form-row"><label className="form-label">Salary Range</label>
              <div className="salary-row">
                <span>£</span><input className="salary-input" type="number" placeholder="Min" value={form.salary_min} onChange={e => setForm({ ...form, salary_min: e.target.value })} />
                <span>to £</span><input className="salary-input" type="number" placeholder="Max" value={form.salary_max} onChange={e => setForm({ ...form, salary_max: e.target.value })} />
                <select className="form-input" style={{ width: 120 }} value={form.salary_type} onChange={e => setForm({ ...form, salary_type: e.target.value })}><option value="hourly">per hour</option><option value="annual">per year</option></select>
              </div>
            </div>
          </div>
          
          <div className="form-section">
            <div className="form-section-title">Job Details</div>
            <div className="form-row"><label className="form-label">Description</label><textarea className="form-input" style={{ minHeight: 120 }} placeholder="Describe the role..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Requirements</label><textarea className="form-input" style={{ minHeight: 100 }} placeholder="List requirements (one per line)..." value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} /></div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn secondary" onClick={() => { onSave({ ...form, status: 'draft' }); onClose(); }}>Save as Draft</button>
          <button className="modal-btn success" onClick={() => { onSave({ ...form, status: 'open' }); onClose(); }} disabled={!form.title}>Publish Job</button>
        </div>
      </div>
    </div>
  );
}
