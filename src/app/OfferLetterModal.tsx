'use client';
import { useState } from 'react';

interface Props { candidate: any; job: any; onClose: () => void; onSend: (data: any) => void; }

export default function OfferLetterModal({ candidate, job, onClose, onSend }: Props) {
  const [form, setForm] = useState({
    salary: job?.salary_min ? `£${job.salary_min}/hr` : '',
    start_date: '',
    employment_type: job?.type || 'full-time',
    hours: '40',
    probation: '3 months',
    benefits: 'Pension, Holiday Pay, Training',
    custom_terms: '',
    require_signature: true,
  });

  const template = `Dear ${candidate?.name || 'Candidate'},

We are pleased to offer you the position of ${job?.title || 'Care Assistant'} at CareRecruit Ltd.

Position: ${job?.title || 'Care Assistant'}
Salary: ${form.salary}
Start Date: ${form.start_date || '[Start Date]'}
Employment Type: ${form.employment_type}
Working Hours: ${form.hours} hours per week
Probation Period: ${form.probation}

Benefits:
${form.benefits}

${form.custom_terms ? `Additional Terms:\n${form.custom_terms}\n` : ''}
Please confirm your acceptance by signing below.

We look forward to welcoming you to the team!

Best regards,
CareRecruit Ltd`;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <style>{`
        .offer-modal{background:#fff;border-radius:16px;width:100%;max-width:900px;max-height:90vh;overflow:hidden;display:flex}
        .offer-form{width:360px;border-right:1px solid #e5e7eb;padding:24px;overflow-y:auto}
        .offer-preview{flex:1;background:#f9fafb;padding:24px;overflow-y:auto}
        .offer-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        .offer-title{font-size:18px;font-weight:600;color:#111}
        .offer-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:16px}
        .offer-row{margin-bottom:16px}
        .offer-label{display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px}
        .offer-input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .offer-row-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .offer-checkbox{display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;cursor:pointer}
        .offer-letter{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;font-family:Georgia,serif;font-size:14px;line-height:1.8;white-space:pre-wrap;min-height:500px}
        .offer-letter-header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111}
        .offer-letter-logo{font-size:24px;font-weight:700;color:#4f46e5}
        .offer-actions{display:flex;gap:8px;margin-top:20px}
        .offer-btn{flex:1;padding:12px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:none}
        .offer-btn.secondary{background:#f3f4f6;color:#374151}
        .offer-btn.primary{background:#4f46e5;color:#fff}
        .sig-box{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb}
        .sig-line{border-bottom:1px solid #111;width:200px;margin:30px 0 5px}
        .sig-label{font-size:12px;color:#6b7280}
      `}</style>
      
      <div className="offer-modal">
        <div className="offer-form">
          <div className="offer-header"><span className="offer-title">Offer Details</span><button className="offer-close" onClick={onClose}>×</button></div>
          <div className="offer-row"><label className="offer-label">Salary/Rate</label><input className="offer-input" value={form.salary} onChange={e => setForm({...form, salary: e.target.value})} placeholder="£12/hr or £28,000/year" /></div>
          <div className="offer-row-2">
            <div className="offer-row"><label className="offer-label">Start Date</label><input type="date" className="offer-input" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
            <div className="offer-row"><label className="offer-label">Hours/Week</label><input className="offer-input" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} /></div>
          </div>
          <div className="offer-row"><label className="offer-label">Employment Type</label><select className="offer-input" value={form.employment_type} onChange={e => setForm({...form, employment_type: e.target.value})}><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="zero-hours">Zero Hours</option></select></div>
          <div className="offer-row"><label className="offer-label">Probation Period</label><select className="offer-input" value={form.probation} onChange={e => setForm({...form, probation: e.target.value})}><option>None</option><option>1 month</option><option>3 months</option><option>6 months</option></select></div>
          <div className="offer-row"><label className="offer-label">Benefits</label><textarea className="offer-input" style={{minHeight:80}} value={form.benefits} onChange={e => setForm({...form, benefits: e.target.value})} /></div>
          <div className="offer-row"><label className="offer-label">Additional Terms</label><textarea className="offer-input" style={{minHeight:60}} value={form.custom_terms} onChange={e => setForm({...form, custom_terms: e.target.value})} placeholder="Any custom terms..." /></div>
          <label className="offer-checkbox"><input type="checkbox" checked={form.require_signature} onChange={e => setForm({...form, require_signature: e.target.checked})} /> Require e-signature</label>
          <div className="offer-actions">
            <button className="offer-btn secondary" onClick={onClose}>Cancel</button>
            <button className="offer-btn primary" onClick={() => onSend(form)}>Send Offer</button>
          </div>
        </div>
        <div className="offer-preview">
          <div style={{fontSize:12,color:'#6b7280',marginBottom:12}}>PREVIEW</div>
          <div className="offer-letter">
            <div className="offer-letter-header"><div className="offer-letter-logo">CareRecruit</div><div style={{fontSize:12,color:'#6b7280'}}>OFFER OF EMPLOYMENT</div></div>
            {template}
            {form.require_signature && <div className="sig-box"><div className="sig-line" /><div className="sig-label">Candidate Signature & Date</div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
