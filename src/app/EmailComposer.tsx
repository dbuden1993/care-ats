'use client';
import { useState } from 'react';

interface Props {
  candidate: any;
  template?: { subject: string; body: string };
  onClose: () => void;
  onSend: (data: { to: string; subject: string; body: string }) => void;
}

const TEMPLATES: Record<string, { name: string; subject: string; body: string }> = {
  interview: { name: 'Interview Invite', subject: 'Interview Invitation', body: `Dear {{name}},

We were impressed with your application and would like to invite you for an interview.

Please let us know your availability for this week.

Best regards,
The CareRecruit Team` },
  rejection: { name: 'Rejection', subject: 'Update on your application', body: `Dear {{name}},

Thank you for your interest and for taking the time to apply.

After careful review, we have decided to move forward with other candidates.

We wish you the best.

Kind regards,
The CareRecruit Team` },
  offer: { name: 'Job Offer', subject: 'Job Offer', body: `Dear {{name}},

We are delighted to offer you the position!

Please find the details below. We'd appreciate your response within 5 days.

Welcome to the team!

Best regards,
The CareRecruit Team` },
  followup: { name: 'Follow Up', subject: 'Following up on your application', body: `Hi {{name}},

Just checking in regarding your application. Do you have any questions?

Best,
The CareRecruit Team` },
  docs: { name: 'Document Request', subject: 'Documents Required', body: `Dear {{name}},

To proceed with your application, please provide the following documents:

- Right to work proof
- DBS certificate (if available)
- References

Please reply to this email with the documents attached.

Thank you,
The CareRecruit Team` }
};

export default function EmailComposer({ candidate, template: initialTemplate, onClose, onSend }: Props) {
  const [to, setTo] = useState(candidate.email || `${candidate.name?.toLowerCase().replace(/\s/g, '.')}@email.com`);
  const [subject, setSubject] = useState(initialTemplate?.subject || '');
  const [body, setBody] = useState(initialTemplate?.body || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const applyTemplate = (key: string) => {
    const t = TEMPLATES[key];
    setSubject(t.subject);
    setBody(t.body.replace(/\{\{name\}\}/g, candidate.name || 'there'));
  };

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 800)); // Simulate send
    onSend({ to, subject, body });
    setSent(true);
    setTimeout(() => onClose(), 1500);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .email-modal{background:#fff;border-radius:16px;width:100%;max-width:650px;max-height:90vh;display:flex;flex-direction:column;animation:slideUp .2s ease}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .email-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .email-title{font-size:18px;font-weight:600;color:#111}
        .email-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:16px;transition:all .15s}
        .email-close:hover{background:#e5e7eb}
        .email-templates{display:flex;gap:6px;padding:12px 20px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;background:#f9fafb}
        .email-tpl{padding:6px 12px;font-size:11px;font-weight:500;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;transition:all .15s}
        .email-tpl:hover{border-color:#6366f1;color:#6366f1}
        .email-body{flex:1;overflow-y:auto;padding:20px}
        .email-field{margin-bottom:16px}
        .email-label{display:block;font-size:12px;font-weight:500;color:#6b7280;margin-bottom:6px}
        .email-input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;transition:border-color .15s}
        .email-input:focus{outline:none;border-color:#6366f1}
        .email-textarea{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;min-height:250px;resize:vertical;font-family:inherit;line-height:1.6;transition:border-color .15s}
        .email-textarea:focus{outline:none;border-color:#6366f1}
        .email-footer{padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .email-hint{font-size:12px;color:#9ca3af}
        .email-actions{display:flex;gap:8px}
        .email-btn{padding:10px 20px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer;border:none;transition:all .15s}
        .email-btn.secondary{background:#f3f4f6;color:#374151}
        .email-btn.secondary:hover{background:#e5e7eb}
        .email-btn.primary{background:#4f46e5;color:#fff}
        .email-btn.primary:hover{background:#4338ca}
        .email-btn.sent{background:#10b981;pointer-events:none}
        .email-btn:disabled{opacity:.5;cursor:not-allowed}
        .email-recipient{background:#eef2ff;border-radius:10px;padding:12px;margin-bottom:16px;display:flex;align-items:center;gap:12px}
        .email-recipient-avatar{width:40px;height:40px;background:#4f46e5;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600}
        .email-recipient-info h4{font-size:14px;font-weight:600;color:#111;margin:0}
        .email-recipient-info p{font-size:12px;color:#6b7280;margin:2px 0 0}
      `}</style>
      
      <div className="email-modal">
        <div className="email-header">
          <span className="email-title">✉️ Compose Email</span>
          <button className="email-close" onClick={onClose}>×</button>
        </div>
        
        <div className="email-templates">
          <span style={{fontSize:11,color:'#6b7280',marginRight:4}}>Templates:</span>
          {Object.entries(TEMPLATES).map(([k, v]) => (
            <button key={k} className="email-tpl" onClick={() => applyTemplate(k)}>{v.name}</button>
          ))}
        </div>
        
        <div className="email-body">
          <div className="email-recipient">
            <div className="email-recipient-avatar">{(candidate.name || '?')[0]}</div>
            <div className="email-recipient-info">
              <h4>{candidate.name || 'Candidate'}</h4>
              <p>{candidate.roles || 'Applicant'}</p>
            </div>
          </div>
          
          <div className="email-field">
            <label className="email-label">To</label>
            <input className="email-input" type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="candidate@email.com" />
          </div>
          
          <div className="email-field">
            <label className="email-label">Subject</label>
            <input className="email-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter subject..." />
          </div>
          
          <div className="email-field">
            <label className="email-label">Message</label>
            <textarea className="email-textarea" value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." />
          </div>
        </div>
        
        <div className="email-footer">
          <span className="email-hint">⌘+Enter to send</span>
          <div className="email-actions">
            <button className="email-btn secondary" onClick={onClose}>Cancel</button>
            <button 
              className={`email-btn primary ${sent ? 'sent' : ''}`} 
              onClick={handleSend} 
              disabled={!to || !subject || !body || sending}
            >
              {sent ? '✓ Sent!' : sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
