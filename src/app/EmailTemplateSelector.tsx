'use client';
import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

interface Props {
  onSelect: (template: Template) => void;
  onClose: () => void;
}

const TEMPLATES: Template[] = [
  { id: '1', name: 'Application Received', subject: 'Thank you for your application', body: 'Dear {{name}},\n\nThank you for applying to the {{role}} position at {{company}}. We have received your application and will review it shortly.\n\nWe aim to respond within 5 working days.\n\nBest regards,\n{{sender}}', category: 'Application' },
  { id: '2', name: 'Phone Screen Invite', subject: 'Next steps: Phone screening', body: 'Dear {{name}},\n\nThank you for your interest in the {{role}} position. We would like to invite you for a brief phone screening.\n\nPlease let us know your availability for a 15-minute call.\n\nBest regards,\n{{sender}}', category: 'Screening' },
  { id: '3', name: 'Interview Invitation', subject: 'Interview Invitation - {{role}}', body: 'Dear {{name}},\n\nWe are pleased to invite you for an interview for the {{role}} position.\n\nInterview Details:\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}\n\nPlease confirm your attendance.\n\nBest regards,\n{{sender}}', category: 'Interview' },
  { id: '4', name: 'Interview Reminder', subject: 'Reminder: Your interview tomorrow', body: 'Dear {{name}},\n\nThis is a friendly reminder about your interview tomorrow.\n\nDate: {{date}}\nTime: {{time}}\nLocation: {{location}}\n\nWe look forward to meeting you.\n\nBest regards,\n{{sender}}', category: 'Interview' },
  { id: '5', name: 'Offer Letter', subject: 'Job Offer - {{role}}', body: 'Dear {{name}},\n\nWe are delighted to offer you the position of {{role}} at {{company}}.\n\nPlease find attached your formal offer letter with full details of the role and compensation.\n\nWe look forward to welcoming you to the team.\n\nBest regards,\n{{sender}}', category: 'Offer' },
  { id: '6', name: 'Rejection - After Application', subject: 'Update on your application', body: 'Dear {{name}},\n\nThank you for your interest in the {{role}} position at {{company}}.\n\nAfter careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs.\n\nWe wish you the best in your job search.\n\nBest regards,\n{{sender}}', category: 'Rejection' },
  { id: '7', name: 'Rejection - After Interview', subject: 'Update on your application', body: 'Dear {{name}},\n\nThank you for taking the time to interview with us for the {{role}} position.\n\nAfter careful consideration, we have decided to proceed with another candidate. This was a difficult decision as we were impressed by your background.\n\nWe will keep your details on file for future opportunities.\n\nBest regards,\n{{sender}}', category: 'Rejection' },
  { id: '8', name: 'Reference Request', subject: 'Reference Request for {{candidate}}', body: 'Dear {{name}},\n\n{{candidate}} has listed you as a reference for their application to {{company}}.\n\nWe would appreciate if you could provide a brief reference. Please reply to this email or call us at {{phone}}.\n\nThank you for your time.\n\nBest regards,\n{{sender}}', category: 'Reference' },
];

export default function EmailTemplateSelector({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [preview, setPreview] = useState<Template | null>(null);

  const categories = ['all', ...new Set(TEMPLATES.map(t => t.category))];
  
  const filtered = TEMPLATES.filter(t => {
    if (category !== 'all' && t.category !== category) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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
        .tpl-modal{background:#fff;border-radius:20px;width:100%;max-width:800px;max-height:85vh;display:flex;flex-direction:column;animation:tplIn .2s ease}
        @keyframes tplIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
        .tpl-header{padding:20px 24px;border-bottom:1px solid #e5e7eb}
        .tpl-header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .tpl-title{font-size:18px;font-weight:700;color:#111}
        .tpl-close{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;font-size:16px;color:#6b7280}
        .tpl-close:hover{background:#e5e7eb}
        .tpl-search{width:100%;padding:10px 14px 10px 40px;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;margin-bottom:12px}
        .tpl-search:focus{outline:none;border-color:#6366f1}
        .tpl-categories{display:flex;gap:6px;flex-wrap:wrap}
        .tpl-cat{padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;border-radius:20px;background:#fff;cursor:pointer;transition:all .15s}
        .tpl-cat:hover{border-color:#d1d5db}
        .tpl-cat.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .tpl-body{display:flex;flex:1;overflow:hidden}
        .tpl-list{width:280px;border-right:1px solid #e5e7eb;overflow-y:auto;padding:12px}
        .tpl-item{padding:14px;border-radius:10px;cursor:pointer;transition:all .15s;margin-bottom:6px}
        .tpl-item:hover{background:#f9fafb}
        .tpl-item.active{background:#eef2ff}
        .tpl-item-name{font-size:13px;font-weight:600;color:#111;margin-bottom:4px}
        .tpl-item-cat{font-size:11px;color:#6b7280;display:inline-flex;padding:2px 8px;background:#f3f4f6;border-radius:10px}
        .tpl-preview{flex:1;padding:24px;overflow-y:auto;background:#fafbfc}
        .tpl-preview-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#9ca3af}
        .tpl-preview-empty-icon{font-size:48px;margin-bottom:12px;opacity:.5}
        .tpl-preview-subject{font-size:14px;font-weight:600;color:#111;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #e5e7eb}
        .tpl-preview-body{font-size:13px;color:#374151;line-height:1.8;white-space:pre-wrap;font-family:inherit}
        .tpl-preview-var{background:#fef3c7;color:#92400e;padding:1px 4px;border-radius:4px;font-size:12px}
        .tpl-footer{padding:16px 24px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px}
        .tpl-btn{padding:10px 20px;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;border:none;transition:all .15s}
        .tpl-btn.secondary{background:#f3f4f6;color:#374151}
        .tpl-btn.secondary:hover{background:#e5e7eb}
        .tpl-btn.primary{background:#4f46e5;color:#fff}
        .tpl-btn.primary:hover{background:#4338ca}
        .tpl-btn.primary:disabled{opacity:.5;cursor:not-allowed}
      `}</style>

      <div className="tpl-modal">
        <div className="tpl-header">
          <div className="tpl-header-top">
            <h2 className="tpl-title">📝 Email Templates</h2>
            <button className="tpl-close" onClick={onClose}>✕</button>
          </div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
            <input
              className="tpl-search"
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="tpl-categories">
            {categories.map(cat => (
              <button
                key={cat}
                className={`tpl-cat ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        <div className="tpl-body">
          <div className="tpl-list">
            {filtered.map(t => (
              <div
                key={t.id}
                className={`tpl-item ${preview?.id === t.id ? 'active' : ''}`}
                onClick={() => setPreview(t)}
              >
                <div className="tpl-item-name">{t.name}</div>
                <span className="tpl-item-cat">{t.category}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>
                No templates found
              </div>
            )}
          </div>

          <div className="tpl-preview">
            {preview ? (
              <>
                <div className="tpl-preview-subject">
                  Subject: {preview.subject.replace(/\{\{(\w+)\}\}/g, '<span class="tpl-preview-var">{{$1}}</span>')}
                </div>
                <div 
                  className="tpl-preview-body"
                  dangerouslySetInnerHTML={{ 
                    __html: preview.body.replace(/\{\{(\w+)\}\}/g, '<span class="tpl-preview-var">{{$1}}</span>') 
                  }}
                />
              </>
            ) : (
              <div className="tpl-preview-empty">
                <div className="tpl-preview-empty-icon">📧</div>
                <div>Select a template to preview</div>
              </div>
            )}
          </div>
        </div>

        <div className="tpl-footer">
          <button className="tpl-btn secondary" onClick={onClose}>Cancel</button>
          <button 
            className="tpl-btn primary" 
            disabled={!preview}
            onClick={() => preview && onSelect(preview)}
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
