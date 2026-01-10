'use client';
import { useState } from 'react';

interface NewHire { id: string; name: string; job: string; start_date: string; progress: number; tasks_done: number; tasks_total: number; manager: string; }

export default function OnboardingView() {
  const [hires] = useState<NewHire[]>([
    { id: '1', name: 'Emma Watson', job: 'Care Assistant', start_date: '2024-02-01', progress: 75, tasks_done: 6, tasks_total: 8, manager: 'John Doe' },
    { id: '2', name: 'James Smith', job: 'Senior Carer', start_date: '2024-02-05', progress: 40, tasks_done: 4, tasks_total: 10, manager: 'Jane Smith' },
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tasks] = useState([
    { id: '1', title: 'Sign employment contract', done: true, due: '2024-01-28', assignee: 'candidate' },
    { id: '2', title: 'Complete right-to-work check', done: true, due: '2024-01-29', assignee: 'hr' },
    { id: '3', title: 'Submit DBS application', done: true, due: '2024-01-30', assignee: 'candidate' },
    { id: '4', title: 'Complete mandatory training', done: false, due: '2024-02-01', assignee: 'candidate' },
    { id: '5', title: 'Set up IT accounts', done: false, due: '2024-02-01', assignee: 'it' },
    { id: '6', title: 'Schedule orientation meeting', done: true, due: '2024-01-31', assignee: 'manager' },
  ]);

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .onb-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
        .onb-stat{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px}
        .onb-stat-value{font-size:28px;font-weight:700;color:#111}
        .onb-stat-label{font-size:12px;color:#6b7280;margin-top:4px}
        .onb-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        .onb-list{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .onb-list-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111}
        .onb-item{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid #f3f4f6;cursor:pointer}
        .onb-item:hover{background:#f9fafb}
        .onb-item.active{background:#eef2ff}
        .onb-avatar{width:44px;height:44px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600}
        .onb-info{flex:1}
        .onb-name{font-size:14px;font-weight:600;color:#111}
        .onb-job{font-size:12px;color:#6b7280}
        .onb-progress{width:80px}
        .onb-progress-bar{height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden}
        .onb-progress-fill{height:100%;background:#10b981;transition:width .3s}
        .onb-progress-text{font-size:11px;color:#6b7280;margin-top:4px;text-align:right}
        .onb-detail{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .onb-detail-header{padding:20px;border-bottom:1px solid #e5e7eb}
        .onb-detail-name{font-size:18px;font-weight:600;color:#111}
        .onb-detail-meta{font-size:13px;color:#6b7280;margin-top:4px}
        .onb-tasks{padding:16px 20px}
        .onb-task{display:flex;align-items:center;gap:12px;padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:8px}
        .onb-task.done{opacity:.6}
        .onb-task-check{width:22px;height:22px;border:2px solid #d1d5db;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer}
        .onb-task-check.done{background:#10b981;border-color:#10b981;color:#fff}
        .onb-task-info{flex:1}
        .onb-task-title{font-size:13px;color:#111}
        .onb-task-due{font-size:11px;color:#6b7280}
        .onb-task-badge{padding:3px 8px;font-size:10px;border-radius:4px;background:#e5e7eb;color:#374151}
        .onb-empty{display:flex;align-items:center;justify-content:center;height:300px;color:#9ca3af;font-size:14px}
      `}</style>
      
      <div className="onb-stats">
        <div className="onb-stat"><div className="onb-stat-value">{hires.length}</div><div className="onb-stat-label">Onboarding</div></div>
        <div className="onb-stat"><div className="onb-stat-value">{hires.filter(h => h.progress === 100).length}</div><div className="onb-stat-label">Completed</div></div>
        <div className="onb-stat"><div className="onb-stat-value">{Math.round(hires.reduce((s,h) => s+h.progress,0)/hires.length)}%</div><div className="onb-stat-label">Avg Progress</div></div>
      </div>
      
      <div className="onb-grid">
        <div className="onb-list">
          <div className="onb-list-header">New Hires</div>
          {hires.map(h => (
            <div key={h.id} className={`onb-item ${selected === h.id ? 'active' : ''}`} onClick={() => setSelected(h.id)}>
              <div className="onb-avatar">{h.name[0]}</div>
              <div className="onb-info">
                <div className="onb-name">{h.name}</div>
                <div className="onb-job">{h.job} • Starts {new Date(h.start_date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
              </div>
              <div className="onb-progress">
                <div className="onb-progress-bar"><div className="onb-progress-fill" style={{width:`${h.progress}%`}} /></div>
                <div className="onb-progress-text">{h.tasks_done}/{h.tasks_total} tasks</div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="onb-detail">
          {!selected ? <div className="onb-empty">Select a new hire to view tasks</div> : <>
            <div className="onb-detail-header">
              <div className="onb-detail-name">{hires.find(h => h.id === selected)?.name}</div>
              <div className="onb-detail-meta">Manager: {hires.find(h => h.id === selected)?.manager}</div>
            </div>
            <div className="onb-tasks">
              {tasks.map(t => (
                <div key={t.id} className={`onb-task ${t.done ? 'done' : ''}`}>
                  <div className={`onb-task-check ${t.done ? 'done' : ''}`}>{t.done && '✓'}</div>
                  <div className="onb-task-info">
                    <div className="onb-task-title">{t.title}</div>
                    <div className="onb-task-due">Due {new Date(t.due).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                  </div>
                  <span className="onb-task-badge">{t.assignee}</span>
                </div>
              ))}
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}
