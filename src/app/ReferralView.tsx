'use client';
import { useState } from 'react';

interface Referral { id: string; referrer_name: string; referrer_email: string; candidate_name: string; candidate_phone: string; job_id: string; status: string; reward: number; created_at: string; }

export default function ReferralView({ jobs }: { jobs: any[] }) {
  const [referrals] = useState<Referral[]>([
    { id: '1', referrer_name: 'Sarah Johnson', referrer_email: 'sarah@company.com', candidate_name: 'Mike Brown', candidate_phone: '+447123456789', job_id: 'job-1', status: 'hired', reward: 250, created_at: '2024-01-10' },
    { id: '2', referrer_name: 'Tom Wilson', referrer_email: 'tom@company.com', candidate_name: 'Emma Davis', candidate_phone: '+447987654321', job_id: 'job-2', status: 'interviewing', reward: 250, created_at: '2024-01-15' },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ referrer_name: '', referrer_email: '', candidate_name: '', candidate_phone: '', job_id: '' });

  const stats = { total: referrals.length, hired: referrals.filter(r => r.status === 'hired').length, pending: referrals.filter(r => r.status !== 'hired' && r.status !== 'rejected').length, rewards: referrals.filter(r => r.status === 'hired').reduce((s, r) => s + r.reward, 0) };

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .ref-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .ref-title{font-size:20px;font-weight:600;color:#111}
        .ref-btn{padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer}
        .ref-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
        .ref-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center}
        .ref-stat-value{font-size:28px;font-weight:700;color:#111}
        .ref-stat-label{font-size:12px;color:#6b7280;margin-top:4px}
        .ref-stat.success .ref-stat-value{color:#059669}
        .ref-link-box{background:linear-gradient(135deg,#eef2ff,#e0e7ff);border-radius:12px;padding:24px;margin-bottom:24px}
        .ref-link-title{font-size:16px;font-weight:600;color:#4f46e5;margin-bottom:8px}
        .ref-link-desc{font-size:13px;color:#6b7280;margin-bottom:16px}
        .ref-link-row{display:flex;gap:8px}
        .ref-link-input{flex:1;padding:12px;background:#fff;border:1px solid #c7d2fe;border-radius:8px;font-size:13px}
        .ref-link-copy{padding:12px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer}
        .ref-table{width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
        .ref-table th{text-align:left;padding:14px 16px;background:#f9fafb;font-size:12px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb}
        .ref-table td{padding:14px 16px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6}
        .ref-table tr:last-child td{border-bottom:none}
        .ref-status{padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600}
        .ref-status.hired{background:#ecfdf5;color:#059669}
        .ref-status.interviewing{background:#fef3c7;color:#b45309}
        .ref-status.applied{background:#eef2ff;color:#4f46e5}
        .ref-status.rejected{background:#fef2f2;color:#dc2626}
        .modal{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal-content{background:#fff;border-radius:16px;padding:24px;width:100%;max-width:500px}
        .modal-title{font-size:18px;font-weight:600;margin-bottom:20px}
        .form-row{margin-bottom:16px}
        .form-label{display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:6px}
        .form-input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
      `}</style>
      
      <div className="ref-header"><h2 className="ref-title">Employee Referrals</h2><button className="ref-btn" onClick={() => setShowForm(true)}>+ Submit Referral</button></div>
      
      <div className="ref-stats">
        <div className="ref-stat"><div className="ref-stat-value">{stats.total}</div><div className="ref-stat-label">Total Referrals</div></div>
        <div className="ref-stat success"><div className="ref-stat-value">{stats.hired}</div><div className="ref-stat-label">Hired</div></div>
        <div className="ref-stat"><div className="ref-stat-value">{stats.pending}</div><div className="ref-stat-label">In Progress</div></div>
        <div className="ref-stat success"><div className="ref-stat-value">£{stats.rewards}</div><div className="ref-stat-label">Rewards Paid</div></div>
      </div>
      
      <div className="ref-link-box">
        <div className="ref-link-title">🔗 Share Your Referral Link</div>
        <div className="ref-link-desc">Share this link with potential candidates. You'll earn £250 for every successful hire!</div>
        <div className="ref-link-row">
          <input className="ref-link-input" value="https://carerecruit.com/refer/john-doe" readOnly />
          <button className="ref-link-copy" onClick={() => navigator.clipboard.writeText('https://carerecruit.com/refer/john-doe')}>Copy Link</button>
        </div>
      </div>
      
      <table className="ref-table">
        <thead><tr><th>Candidate</th><th>Referred By</th><th>Position</th><th>Status</th><th>Date</th><th>Reward</th></tr></thead>
        <tbody>
          {referrals.map(r => (
            <tr key={r.id}>
              <td style={{ fontWeight: 500 }}>{r.candidate_name}</td>
              <td>{r.referrer_name}</td>
              <td>{jobs.find(j => j.id === r.job_id)?.title || 'General'}</td>
              <td><span className={`ref-status ${r.status}`}>{r.status}</span></td>
              <td>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</td>
              <td style={{ color: r.status === 'hired' ? '#059669' : '#9ca3af', fontWeight: 600 }}>{r.status === 'hired' ? `£${r.reward}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {showForm && <div className="modal" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
        <div className="modal-content">
          <div className="modal-title">Submit a Referral</div>
          <div className="form-row"><label className="form-label">Your Name</label><input className="form-input" value={form.referrer_name} onChange={e => setForm({...form, referrer_name: e.target.value})} /></div>
          <div className="form-row"><label className="form-label">Your Email</label><input className="form-input" type="email" value={form.referrer_email} onChange={e => setForm({...form, referrer_email: e.target.value})} /></div>
          <div className="form-row"><label className="form-label">Candidate Name</label><input className="form-input" value={form.candidate_name} onChange={e => setForm({...form, candidate_name: e.target.value})} /></div>
          <div className="form-row"><label className="form-label">Candidate Phone</label><input className="form-input" value={form.candidate_phone} onChange={e => setForm({...form, candidate_phone: e.target.value})} /></div>
          <div className="form-row"><label className="form-label">Position</label><select className="form-input" value={form.job_id} onChange={e => setForm({...form, job_id: e.target.value})}><option value="">Any position</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></div>
          <div className="modal-actions"><button className="ref-btn" style={{background:'#f3f4f6',color:'#374151'}} onClick={() => setShowForm(false)}>Cancel</button><button className="ref-btn" onClick={() => setShowForm(false)}>Submit Referral</button></div>
        </div>
      </div>}
    </div>
  );
}
