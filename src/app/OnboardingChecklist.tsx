'use client';
import { useState } from 'react';
import Avatar from './Avatar';
import ProgressRing from './ProgressRing';
import Badge from './Badge';

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  assignee?: string;
  category: string;
}

interface Props {
  candidateId: string;
  candidateName: string;
  startDate?: string;
}

const DEFAULT_TASKS: Task[] = [
  { id: '1', title: 'Complete personal details form', description: 'Fill out emergency contact and personal info', dueDate: 'Day 1', completed: true, category: 'Documentation' },
  { id: '2', title: 'Submit ID documents', description: 'Passport, visa, proof of address', dueDate: 'Day 1', completed: true, category: 'Documentation' },
  { id: '3', title: 'Sign employment contract', description: 'Review and sign via DocuSign', dueDate: 'Day 1', completed: false, category: 'Documentation' },
  { id: '4', title: 'Complete DBS check application', description: 'Online DBS check submission', dueDate: 'Week 1', completed: false, category: 'Compliance' },
  { id: '5', title: 'Mandatory safeguarding training', description: 'Complete online module', dueDate: 'Week 1', completed: false, category: 'Training' },
  { id: '6', title: 'Health & safety induction', description: 'Online course + quiz', dueDate: 'Week 1', completed: false, category: 'Training' },
  { id: '7', title: 'Manual handling training', description: 'In-person session required', dueDate: 'Week 2', completed: false, assignee: 'Training Team', category: 'Training' },
  { id: '8', title: 'IT setup & system access', description: 'Email, scheduling system, timesheet', dueDate: 'Day 1', completed: false, assignee: 'IT Support', category: 'Setup' },
  { id: '9', title: 'Uniform & equipment issued', description: 'Collect from office', dueDate: 'Day 1', completed: false, category: 'Setup' },
  { id: '10', title: 'Meet the team introduction', description: 'Virtual or in-person intro session', dueDate: 'Week 1', completed: false, assignee: 'Team Lead', category: 'Orientation' },
];

export default function OnboardingChecklist({ candidateId, candidateName, startDate }: Props) {
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS);
  const [filter, setFilter] = useState<string>('all');

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  const categories = ['all', ...new Set(tasks.map(t => t.category))];
  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.category === filter);

  const groupedTasks = filteredTasks.reduce((acc, t) => {
    const due = t.dueDate || 'No date';
    if (!acc[due]) acc[due] = [];
    acc[due].push(t);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .onboard-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding:20px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:16px}
        .onboard-header-left{display:flex;align-items:center;gap:16px}
        .onboard-info h2{font-size:18px;font-weight:700;color:#111;margin:0 0 4px}
        .onboard-info p{font-size:13px;color:#6b7280;margin:0}
        .onboard-progress{display:flex;align-items:center;gap:16px}
        .onboard-progress-text{text-align:right}
        .onboard-progress-count{font-size:20px;font-weight:800;color:#111}
        .onboard-progress-label{font-size:11px;color:#6b7280}
        .onboard-filters{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
        .onboard-filter{padding:8px 16px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;border-radius:20px;background:#fff;cursor:pointer;transition:all .15s}
        .onboard-filter:hover{border-color:#d1d5db}
        .onboard-filter.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .onboard-section{margin-bottom:24px}
        .onboard-section-title{font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .onboard-task{display:flex;align-items:start;gap:14px;padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:10px;transition:all .15s;cursor:pointer}
        .onboard-task:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.04)}
        .onboard-task.completed{background:#f9fafb}
        .onboard-task.completed .onboard-task-title{text-decoration:line-through;color:#9ca3af}
        .onboard-checkbox{width:24px;height:24px;border:2px solid #d1d5db;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;margin-top:2px}
        .onboard-checkbox:hover{border-color:#6366f1}
        .onboard-checkbox.checked{background:#10b981;border-color:#10b981;color:#fff}
        .onboard-task-content{flex:1;min-width:0}
        .onboard-task-title{font-size:14px;font-weight:600;color:#111;margin-bottom:4px}
        .onboard-task-desc{font-size:12px;color:#6b7280;margin-bottom:8px}
        .onboard-task-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .onboard-task-assignee{display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280}
      `}</style>

      <div className="onboard-header">
        <div className="onboard-header-left">
          <Avatar name={candidateName} size="lg" />
          <div className="onboard-info">
            <h2>{candidateName}</h2>
            <p>Start date: {startDate || 'TBD'}</p>
          </div>
        </div>
        <div className="onboard-progress">
          <div className="onboard-progress-text">
            <div className="onboard-progress-count">{completedCount}/{tasks.length}</div>
            <div className="onboard-progress-label">Tasks completed</div>
          </div>
          <ProgressRing 
            value={progressPercent} 
            size={70} 
            color={progressPercent === 100 ? '#10b981' : '#6366f1'} 
          />
        </div>
      </div>

      <div className="onboard-filters">
        {categories.map(cat => (
          <button
            key={cat}
            className={`onboard-filter ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}
          >
            {cat === 'all' ? 'All Tasks' : cat}
          </button>
        ))}
      </div>

      {Object.entries(groupedTasks).map(([due, taskList]) => (
        <div key={due} className="onboard-section">
          <div className="onboard-section-title">
            📅 {due}
            <Badge variant={taskList.every(t => t.completed) ? 'success' : 'default'} size="sm">
              {taskList.filter(t => t.completed).length}/{taskList.length}
            </Badge>
          </div>
          {taskList.map(task => (
            <div 
              key={task.id} 
              className={`onboard-task ${task.completed ? 'completed' : ''}`}
              onClick={() => toggleTask(task.id)}
            >
              <div className={`onboard-checkbox ${task.completed ? 'checked' : ''}`}>
                {task.completed && '✓'}
              </div>
              <div className="onboard-task-content">
                <div className="onboard-task-title">{task.title}</div>
                {task.description && <div className="onboard-task-desc">{task.description}</div>}
                <div className="onboard-task-meta">
                  <Badge variant="default" size="sm">{task.category}</Badge>
                  {task.assignee && (
                    <div className="onboard-task-assignee">
                      <Avatar name={task.assignee} size="xs" />
                      {task.assignee}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
