'use client';
import { useState } from 'react';

interface Props { onClose: () => void; onSave: (data: any) => void; jobs: any[]; }

export default function CandidateModal({ onClose, onSave, jobs }: Props) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', job_id: '', source: 'direct', roles: '', experience: '', driver: '', dbs: '', training: '', start_date: '', notes: '' });
  const [step, setStep] = useState(1);

  const sources = ['direct', 'indeed', 'linkedin', 'referral', 'agency', 'website', 'other'];

  const handleSubmit = () => { onSave(form); onClose(); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <style>{`
        .modal{background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto}
        .modal-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .modal-title{font-size:18px;font-weight:600;color:#111}
        .modal-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:none;background:#f3f4f6;border-radius:8px;cursor:pointer;font-size:16px}
        .steps{display:flex;padding:16px 20px;border-bottom:1px solid #e5e7eb;gap:8px}
        .step{flex:1;text-align:center;padding:8px;font-size:12px;font-weight:500;color:#9ca3af;border-radius:6px}
        .step.active{background:#eef2ff;color:#4f46e5}
        .step.done{color:#059669}
        .modal-body{padding:20px}
        .form-row{margin-bottom:16px}
        .form-label{display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px}
        .form-input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .form-input:focus{outline:none;border-color:#6366f1}
        .form-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .radio-group{display:flex;gap:8px}
        .radio-btn{flex:1;padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;text-align:center;font-size:12px}
        .radio-btn:hover{border-color:#d1d5db}
        .radio-btn.active{border-color:#6366f1;background:#eef2ff;color:#4f46e5}
        .source-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .source-btn{padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;text-align:center;font-size:11px;text-transform:capitalize}
        .source-btn:hover{border-color:#d1d5db}
        .source-btn.active{border-color:#6366f1;background:#eef2ff;color:#4f46e5}
        .modal-footer{padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between}
        .modal-btn{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .modal-btn.secondary{background:#f3f4f6;border:none;color:#374151}
        .modal-btn.primary{background:#4f46e5;border:none;color:#fff}
      `}</style>
      
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Add Candidate</span><button className="modal-close" onClick={onClose}>×</button></div>
        <div className="steps">
          <div className={`step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>1. Basic Info</div>
          <div className={`step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>2. Qualifications</div>
          <div className={`step ${step === 3 ? 'active' : ''}`}>3. Source & Job</div>
        </div>
        
        <div className="modal-body">
          {step === 1 && <>
            <div className="form-row-2">
              <div className="form-row"><label className="form-label">Full Name *</label><input className="form-input" placeholder="John Smith" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label className="form-label">Phone *</label><input className="form-input" placeholder="+44 7xxx xxx xxx" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="form-row"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="john@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Roles interested in</label><input className="form-input" placeholder="Care Assistant, Support Worker" value={form.roles} onChange={e => setForm({ ...form, roles: e.target.value })} /></div>
            <div className="form-row"><label className="form-label">Experience</label><textarea className="form-input" style={{ minHeight: 80 }} placeholder="Previous care experience..." value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} /></div>
          </>}
          
          {step === 2 && <>
            <div className="form-row"><label className="form-label">Driver's License</label><div className="radio-group">{['Yes','No','Learning'].map(v => <button key={v} className={`radio-btn ${form.driver === v ? 'active' : ''}`} onClick={() => setForm({ ...form, driver: v })}>{v}</button>)}</div></div>
            <div className="form-row"><label className="form-label">DBS on Update Service</label><div className="radio-group">{['Yes','No','Pending'].map(v => <button key={v} className={`radio-btn ${form.dbs === v ? 'active' : ''}`} onClick={() => setForm({ ...form, dbs: v })}>{v}</button>)}</div></div>
            <div className="form-row"><label className="form-label">Mandatory Training</label><div className="radio-group">{['Yes','No','Partial'].map(v => <button key={v} className={`radio-btn ${form.training === v ? 'active' : ''}`} onClick={() => setForm({ ...form, training: v })}>{v}</button>)}</div></div>
            <div className="form-row"><label className="form-label">Earliest Start Date</label><input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
          </>}
          
          {step === 3 && <>
            <div className="form-row"><label className="form-label">Source</label><div className="source-grid">{sources.map(s => <button key={s} className={`source-btn ${form.source === s ? 'active' : ''}`} onClick={() => setForm({ ...form, source: s })}>{s}</button>)}</div></div>
            <div className="form-row"><label className="form-label">Apply to Job</label><select className="form-input" value={form.job_id} onChange={e => setForm({ ...form, job_id: e.target.value })}><option value="">No specific job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title} - {j.location}</option>)}</select></div>
            <div className="form-row"><label className="form-label">Notes</label><textarea className="form-input" style={{ minHeight: 80 }} placeholder="Additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </>}
        </div>
        
        <div className="modal-footer">
          <button className="modal-btn secondary" onClick={() => step > 1 ? setStep(step - 1) : onClose()}>{step > 1 ? '← Back' : 'Cancel'}</button>
          {step < 3 ? <button className="modal-btn primary" onClick={() => setStep(step + 1)} disabled={step === 1 && (!form.name || !form.phone)}>Next →</button> : <button className="modal-btn primary" onClick={handleSubmit}>Add Candidate</button>}
        </div>
      </div>
    </div>
  );
}
