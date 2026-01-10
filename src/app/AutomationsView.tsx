'use client';
import { useState } from 'react';

interface Automation {
  id: string; name: string; enabled: boolean; trigger_type: string; trigger_config: any;
  actions: { type: string; config: any }[]; runs: number; last_run?: string;
}

const TRIGGER_TYPES = [
  { id: 'new_application', label: 'New Application', icon: '📥', desc: 'When a candidate applies' },
  { id: 'stage_change', label: 'Stage Changed', icon: '📊', desc: 'When candidate moves to a stage' },
  { id: 'time_in_stage', label: 'Time in Stage', icon: '⏰', desc: 'After X days in a stage' },
  { id: 'interview_scheduled', label: 'Interview Scheduled', icon: '📅', desc: 'When interview is booked' },
  { id: 'interview_completed', label: 'Interview Done', icon: '✅', desc: 'When interview is marked complete' },
  { id: 'offer_accepted', label: 'Offer Accepted', icon: '🎉', desc: 'When candidate accepts offer' },
];

const ACTION_TYPES = [
  { id: 'send_email', label: 'Send Email', icon: '📧' },
  { id: 'move_stage', label: 'Move to Stage', icon: '📊' },
  { id: 'notify_team', label: 'Notify Team', icon: '🔔' },
  { id: 'add_task', label: 'Create Task', icon: '✓' },
  { id: 'add_tag', label: 'Add Tag', icon: '🏷️' },
  { id: 'reject', label: 'Auto-Reject', icon: '❌' },
];

export default function AutomationsView() {
  const [automations, setAutomations] = useState<Automation[]>([
    { id: '1', name: 'Welcome Email', enabled: true, trigger_type: 'new_application', trigger_config: {}, actions: [{ type: 'send_email', config: { template: 'Application Received' } }], runs: 156 },
    { id: '2', name: 'Interview Stage Notification', enabled: true, trigger_type: 'stage_change', trigger_config: { stage: 'interview' }, actions: [{ type: 'notify_team', config: { message: 'Candidate ready for interview' } }, { type: 'send_email', config: { template: 'Interview Invitation' } }], runs: 42, last_run: '2024-01-20T14:30:00' },
    { id: '3', name: 'Stale Application Cleanup', enabled: false, trigger_type: 'time_in_stage', trigger_config: { stage: 'screening', days: 14 }, actions: [{ type: 'send_email', config: { template: 'Rejection - After Screening' } }, { type: 'reject', config: {} }], runs: 89 },
    { id: '4', name: 'Interview Reminder', enabled: true, trigger_type: 'interview_scheduled', trigger_config: { hours_before: 24 }, actions: [{ type: 'send_email', config: { template: 'Interview Reminder' } }], runs: 67 },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newAutomation, setNewAutomation] = useState({ name: '', trigger_type: '', actions: [] as { type: string; config: any }[] });

  const toggle = (id: string) => setAutomations(automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  const deleteAutomation = (id: string) => { if (confirm('Delete this automation?')) setAutomations(automations.filter(a => a.id !== id)); };

  const addAction = (type: string) => setNewAutomation({ ...newAutomation, actions: [...newAutomation.actions, { type, config: {} }] });
  const removeAction = (idx: number) => setNewAutomation({ ...newAutomation, actions: newAutomation.actions.filter((_, i) => i !== idx) });
  
  const saveAutomation = () => {
    if (!newAutomation.name || !newAutomation.trigger_type) return;
    setAutomations([...automations, { ...newAutomation, id: Date.now().toString(), enabled: true, runs: 0, trigger_config: {} }]);
    setNewAutomation({ name: '', trigger_type: '', actions: [] });
    setShowCreate(false);
  };

  const fmt = (d?: string) => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never';

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .auto-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
        .auto-title{font-size:16px;color:#6b7280}
        .auto-btn{padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s}
        .auto-btn:hover{background:#4338ca}
        .auto-grid{display:flex;flex-direction:column;gap:16px}
        .auto-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;transition:all .15s}
        .auto-card:hover{border-color:#d1d5db;box-shadow:0 4px 12px rgba(0,0,0,.05)}
        .auto-card.disabled{opacity:.6}
        .auto-card-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:16px}
        .auto-card-title{font-size:16px;font-weight:600;color:#111}
        .auto-card-toggle{width:48px;height:26px;background:#e5e7eb;border-radius:13px;position:relative;cursor:pointer;transition:background .2s}
        .auto-card-toggle.on{background:#10b981}
        .auto-card-toggle::after{content:'';position:absolute;width:22px;height:22px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .auto-card-toggle.on::after{transform:translateX(22px)}
        .auto-flow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .auto-trigger{background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px}
        .auto-trigger-icon{font-size:20px}
        .auto-trigger-text{font-size:13px;color:#4f46e5;font-weight:500}
        .auto-arrow{color:#9ca3af;font-size:18px}
        .auto-action{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px}
        .auto-action-icon{font-size:16px}
        .auto-action-text{font-size:12px;color:#15803d;font-weight:500}
        .auto-card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6}
        .auto-stats{display:flex;gap:16px}
        .auto-stat{font-size:12px;color:#6b7280}
        .auto-stat strong{color:#111}
        .auto-delete{padding:6px 12px;background:#fef2f2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;transition:all .15s}
        .auto-delete:hover{background:#fee2e2}
        .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1000}
        .modal-content{background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto}
        .modal-header{padding:20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .modal-title{font-size:18px;font-weight:600;color:#111}
        .modal-close{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer}
        .modal-body{padding:20px}
        .form-row{margin-bottom:20px}
        .form-label{display:block;font-size:12px;font-weight:500;color:#374151;margin-bottom:8px}
        .form-input{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .trigger-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        .trigger-option{padding:14px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all .15s}
        .trigger-option:hover{border-color:#d1d5db}
        .trigger-option.selected{border-color:#4f46e5;background:#eef2ff}
        .trigger-option-icon{font-size:24px;margin-bottom:6px}
        .trigger-option-label{font-size:13px;font-weight:500;color:#111}
        .trigger-option-desc{font-size:11px;color:#6b7280}
        .action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .action-option{padding:12px;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;text-align:center;transition:all .15s}
        .action-option:hover{border-color:#10b981;background:#f0fdf4}
        .action-option-icon{font-size:20px}
        .action-option-label{font-size:11px;color:#111;margin-top:4px}
        .selected-actions{margin-top:16px;display:flex;flex-direction:column;gap:8px}
        .selected-action{display:flex;align-items:center;gap:10px;padding:10px;background:#f9fafb;border-radius:8px}
        .selected-action-remove{width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#fef2f2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;margin-left:auto}
        .modal-footer{padding:16px 20px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px}
        .modal-btn{padding:10px 20px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:none}
        .modal-btn.secondary{background:#f3f4f6;color:#374151}
        .modal-btn.primary{background:#4f46e5;color:#fff}
      `}</style>
      
      <div className="auto-header">
        <p className="auto-title">{automations.filter(a => a.enabled).length} active automations • {automations.reduce((s, a) => s + a.runs, 0)} total runs</p>
        <button className="auto-btn" onClick={() => setShowCreate(true)}>+ Create Automation</button>
      </div>
      
      <div className="auto-grid">
        {automations.map(a => {
          const trigger = TRIGGER_TYPES.find(t => t.id === a.trigger_type);
          return (
            <div key={a.id} className={`auto-card ${!a.enabled ? 'disabled' : ''}`}>
              <div className="auto-card-header">
                <div className="auto-card-title">{a.name}</div>
                <div className={`auto-card-toggle ${a.enabled ? 'on' : ''}`} onClick={() => toggle(a.id)} />
              </div>
              <div className="auto-flow">
                <div className="auto-trigger"><span className="auto-trigger-icon">{trigger?.icon}</span><span className="auto-trigger-text">{trigger?.label}</span></div>
                <span className="auto-arrow">→</span>
                {a.actions.map((act, i) => {
                  const action = ACTION_TYPES.find(at => at.id === act.type);
                  return <div key={i} className="auto-action"><span className="auto-action-icon">{action?.icon}</span><span className="auto-action-text">{action?.label}</span></div>;
                })}
              </div>
              <div className="auto-card-footer">
                <div className="auto-stats">
                  <span className="auto-stat"><strong>{a.runs}</strong> runs</span>
                  <span className="auto-stat">Last: <strong>{fmt(a.last_run)}</strong></span>
                </div>
                <button className="auto-delete" onClick={() => deleteAutomation(a.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>
      
      {showCreate && (
        <div className="modal" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-content">
            <div className="modal-header"><span className="modal-title">Create Automation</span><button className="modal-close" onClick={() => setShowCreate(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-row"><label className="form-label">Name</label><input className="form-input" placeholder="e.g. Welcome Email" value={newAutomation.name} onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })} /></div>
              <div className="form-row">
                <label className="form-label">Trigger</label>
                <div className="trigger-grid">
                  {TRIGGER_TYPES.map(t => (
                    <div key={t.id} className={`trigger-option ${newAutomation.trigger_type === t.id ? 'selected' : ''}`} onClick={() => setNewAutomation({ ...newAutomation, trigger_type: t.id })}>
                      <div className="trigger-option-icon">{t.icon}</div>
                      <div className="trigger-option-label">{t.label}</div>
                      <div className="trigger-option-desc">{t.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">Actions (click to add)</label>
                <div className="action-grid">
                  {ACTION_TYPES.map(a => (
                    <div key={a.id} className="action-option" onClick={() => addAction(a.id)}>
                      <div className="action-option-icon">{a.icon}</div>
                      <div className="action-option-label">{a.label}</div>
                    </div>
                  ))}
                </div>
                {newAutomation.actions.length > 0 && (
                  <div className="selected-actions">
                    {newAutomation.actions.map((act, i) => {
                      const action = ACTION_TYPES.find(a => a.id === act.type);
                      return (
                        <div key={i} className="selected-action">
                          <span>{action?.icon}</span>
                          <span>{action?.label}</span>
                          <button className="selected-action-remove" onClick={() => removeAction(i)}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="modal-btn primary" onClick={saveAutomation} disabled={!newAutomation.name || !newAutomation.trigger_type}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
