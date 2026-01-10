'use client';
import { useState } from 'react';

interface Template { id: string; name: string; subject: string; body: string; category: string; variables: string[]; }

const DEFAULT_TEMPLATES: Template[] = [
  { id: '1', name: 'Application Received', subject: 'Thanks for applying - {{job_title}}', body: `Dear {{candidate_name}},

Thank you for your application for the {{job_title}} position at {{company_name}}.

We have received your application and our team will review it shortly. If your qualifications match our requirements, we will be in touch to discuss next steps.

In the meantime, please don't hesitate to reach out if you have any questions.

Best regards,
{{recruiter_name}}
{{company_name}}`, category: 'application', variables: ['candidate_name', 'job_title', 'company_name', 'recruiter_name'] },
  { id: '2', name: 'Interview Invitation', subject: 'Interview Invitation - {{job_title}}', body: `Dear {{candidate_name}},

We were impressed with your application for the {{job_title}} position and would like to invite you for an interview.

Interview Details:
- Date: {{interview_date}}
- Time: {{interview_time}}
- Duration: {{interview_duration}}
- Type: {{interview_type}}
{{#if interview_location}}- Location: {{interview_location}}{{/if}}
{{#if video_link}}- Video Link: {{video_link}}{{/if}}

Please confirm your availability by replying to this email.

Best regards,
{{recruiter_name}}`, category: 'interview', variables: ['candidate_name', 'job_title', 'interview_date', 'interview_time', 'interview_duration', 'interview_type', 'interview_location', 'video_link', 'recruiter_name'] },
  { id: '3', name: 'Rejection - After Screening', subject: 'Update on your application - {{job_title}}', body: `Dear {{candidate_name}},

Thank you for your interest in the {{job_title}} position at {{company_name}} and for taking the time to apply.

After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs.

We encourage you to apply for future positions that match your skills and experience. We will keep your details on file and may reach out if a suitable opportunity arises.

We wish you all the best in your job search.

Kind regards,
{{recruiter_name}}
{{company_name}}`, category: 'rejection', variables: ['candidate_name', 'job_title', 'company_name', 'recruiter_name'] },
  { id: '4', name: 'Job Offer', subject: 'Job Offer - {{job_title}} at {{company_name}}', body: `Dear {{candidate_name}},

We are delighted to offer you the position of {{job_title}} at {{company_name}}!

Offer Details:
- Position: {{job_title}}
- Salary: {{salary}}
- Start Date: {{start_date}}
- Employment Type: {{employment_type}}

Please find the formal offer letter attached. To accept this offer, please sign and return the document by {{response_deadline}}.

If you have any questions about the offer or next steps, please don't hesitate to contact me.

We look forward to welcoming you to the team!

Best regards,
{{recruiter_name}}
{{company_name}}`, category: 'offer', variables: ['candidate_name', 'job_title', 'company_name', 'salary', 'start_date', 'employment_type', 'response_deadline', 'recruiter_name'] },
  { id: '5', name: 'Document Request', subject: 'Documents Required - {{job_title}}', body: `Dear {{candidate_name}},

As part of our onboarding process for the {{job_title}} position, we kindly request the following documents:

{{#each documents}}
- {{this}}
{{/each}}

Please upload these documents to your candidate portal or reply to this email with the attachments by {{deadline}}.

If you have any questions or need assistance, please let me know.

Best regards,
{{recruiter_name}}`, category: 'general', variables: ['candidate_name', 'job_title', 'documents', 'deadline', 'recruiter_name'] },
  { id: '6', name: 'Interview Reminder', subject: 'Reminder: Interview Tomorrow - {{job_title}}', body: `Dear {{candidate_name}},

This is a friendly reminder about your upcoming interview for the {{job_title}} position.

Interview Details:
- Date: {{interview_date}}
- Time: {{interview_time}}
- Type: {{interview_type}}
{{#if interview_location}}- Location: {{interview_location}}{{/if}}
{{#if video_link}}- Video Link: {{video_link}}{{/if}}

Please arrive 5-10 minutes early. If you need to reschedule, please let us know as soon as possible.

We look forward to speaking with you!

Best regards,
{{recruiter_name}}`, category: 'interview', variables: ['candidate_name', 'job_title', 'interview_date', 'interview_time', 'interview_type', 'interview_location', 'video_link', 'recruiter_name'] },
];

export default function TemplatesView() {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Template | null>(null);

  const selected = templates.find(t => t.id === selectedId);
  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter);
  const categories = ['all', 'application', 'interview', 'rejection', 'offer', 'general'];

  const startEdit = () => { if (selected) { setEditForm({ ...selected }); setEditing(true); } };
  const saveEdit = () => {
    if (!editForm) return;
    setTemplates(templates.map(t => t.id === editForm.id ? editForm : t));
    setEditing(false);
    setEditForm(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const newT = { ...selected, id: Date.now().toString(), name: `${selected.name} (Copy)` };
    setTemplates([...templates, newT]);
    setSelectedId(newT.id);
  };
  const deleteTemplate = () => {
    if (!selected || templates.length <= 1) return;
    if (!confirm('Delete this template?')) return;
    const newTs = templates.filter(t => t.id !== selected.id);
    setTemplates(newTs);
    setSelectedId(newTs[0].id);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)' }}>
      <style>{`
        .tpl-sidebar{width:320px;background:#f9fafb;border-right:1px solid #e5e7eb;display:flex;flex-direction:column}
        .tpl-filters{display:flex;gap:6px;padding:16px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
        .tpl-filter{padding:6px 12px;font-size:11px;font-weight:500;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;text-transform:capitalize;transition:all .15s}
        .tpl-filter:hover{border-color:#d1d5db}
        .tpl-filter.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .tpl-list{flex:1;overflow-y:auto;padding:12px}
        .tpl-item{padding:14px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:all .15s}
        .tpl-item:hover{border-color:#d1d5db}
        .tpl-item.active{border-color:#4f46e5;background:#eef2ff}
        .tpl-item-name{font-size:14px;font-weight:600;color:#111;margin-bottom:4px}
        .tpl-item-subject{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .tpl-item-cat{display:inline-block;padding:2px 8px;font-size:10px;font-weight:500;border-radius:4px;background:#e5e7eb;color:#374151;margin-top:8px;text-transform:capitalize}
        .tpl-preview{flex:1;padding:24px;overflow-y:auto}
        .tpl-preview-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        .tpl-preview-title{font-size:20px;font-weight:600;color:#111}
        .tpl-preview-actions{display:flex;gap:8px}
        .tpl-btn{padding:8px 16px;font-size:12px;font-weight:500;border-radius:6px;cursor:pointer;border:none;transition:all .15s}
        .tpl-btn.secondary{background:#f3f4f6;color:#374151}
        .tpl-btn.secondary:hover{background:#e5e7eb}
        .tpl-btn.primary{background:#4f46e5;color:#fff}
        .tpl-btn.primary:hover{background:#4338ca}
        .tpl-btn.danger{background:#fef2f2;color:#dc2626}
        .tpl-btn.danger:hover{background:#fee2e2}
        .tpl-section{margin-bottom:24px}
        .tpl-section-label{font-size:12px;font-weight:500;color:#6b7280;margin-bottom:8px}
        .tpl-subject{font-size:14px;color:#111;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb}
        .tpl-body{font-size:13px;color:#374151;line-height:1.7;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap;font-family:inherit}
        .tpl-variables{display:flex;flex-wrap:wrap;gap:6px}
        .tpl-var{padding:4px 10px;font-size:11px;background:#e0e7ff;color:#4f46e5;border-radius:4px;font-family:monospace}
        .edit-input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;margin-bottom:12px}
        .edit-input:focus{outline:none;border-color:#6366f1}
        .edit-textarea{width:100%;padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;min-height:300px;font-family:inherit;line-height:1.6;resize:vertical}
        .edit-textarea:focus{outline:none;border-color:#6366f1}
      `}</style>
      
      <div className="tpl-sidebar">
        <div className="tpl-filters">
          {categories.map(c => <button key={c} className={`tpl-filter ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>{c}</button>)}
        </div>
        <div className="tpl-list">
          {filtered.map(t => (
            <div key={t.id} className={`tpl-item ${selectedId === t.id ? 'active' : ''}`} onClick={() => { setSelectedId(t.id); setEditing(false); }}>
              <div className="tpl-item-name">{t.name}</div>
              <div className="tpl-item-subject">{t.subject}</div>
              <span className="tpl-item-cat">{t.category}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="tpl-preview">
        {selected && !editing && <>
          <div className="tpl-preview-header">
            <h2 className="tpl-preview-title">{selected.name}</h2>
            <div className="tpl-preview-actions">
              <button className="tpl-btn danger" onClick={deleteTemplate}>Delete</button>
              <button className="tpl-btn secondary" onClick={duplicate}>Duplicate</button>
              <button className="tpl-btn primary" onClick={startEdit}>Edit</button>
            </div>
          </div>
          <div className="tpl-section"><div className="tpl-section-label">Subject</div><div className="tpl-subject">{selected.subject}</div></div>
          <div className="tpl-section"><div className="tpl-section-label">Body</div><div className="tpl-body">{selected.body}</div></div>
          <div className="tpl-section"><div className="tpl-section-label">Available Variables</div><div className="tpl-variables">{selected.variables.map(v => <span key={v} className="tpl-var">{`{{${v}}}`}</span>)}</div></div>
        </>}
        
        {editing && editForm && <>
          <div className="tpl-preview-header">
            <h2 className="tpl-preview-title">Edit Template</h2>
            <div className="tpl-preview-actions">
              <button className="tpl-btn secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="tpl-btn primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
          <div className="tpl-section">
            <div className="tpl-section-label">Name</div>
            <input className="edit-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="tpl-section">
            <div className="tpl-section-label">Subject</div>
            <input className="edit-input" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} />
          </div>
          <div className="tpl-section">
            <div className="tpl-section-label">Body</div>
            <textarea className="edit-textarea" value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })} />
          </div>
          <div className="tpl-section"><div className="tpl-section-label">Variables (click to insert)</div><div className="tpl-variables">{editForm.variables.map(v => <span key={v} className="tpl-var" style={{cursor:'pointer'}} onClick={() => setEditForm({ ...editForm, body: editForm.body + `{{${v}}}` })}>{`{{${v}}}`}</span>)}</div></div>
        </>}
      </div>
    </div>
  );
}
