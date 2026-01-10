'use client';
import { useState } from 'react';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';

interface TimelineEvent {
  id: string;
  type: 'status_change' | 'note' | 'email' | 'call' | 'interview' | 'document' | 'created';
  title: string;
  description?: string;
  timestamp: string;
  user?: string;
  metadata?: any;
}

interface Props {
  candidateId: string;
  candidateName?: string;
}

const MOCK_EVENTS: TimelineEvent[] = [
  { id: '1', type: 'created', title: 'Candidate added', description: 'Applied via job board', timestamp: new Date(Date.now() - 7 * 86400000).toISOString(), user: 'System' },
  { id: '2', type: 'status_change', title: 'Status changed to Screening', timestamp: new Date(Date.now() - 6 * 86400000).toISOString(), user: 'John Doe', metadata: { from: 'new', to: 'screening' } },
  { id: '3', type: 'call', title: 'Phone screening completed', description: 'Discussed availability and experience. Very enthusiastic candidate.', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), user: 'John Doe' },
  { id: '4', type: 'note', title: 'Note added', description: 'Has 5 years care experience, available immediately. Prefers morning shifts.', timestamp: new Date(Date.now() - 5 * 86400000).toISOString(), user: 'John Doe' },
  { id: '5', type: 'email', title: 'Email sent', description: 'Interview invitation sent', timestamp: new Date(Date.now() - 4 * 86400000).toISOString(), user: 'Jane Smith' },
  { id: '6', type: 'status_change', title: 'Status changed to Interview', timestamp: new Date(Date.now() - 4 * 86400000).toISOString(), user: 'Jane Smith', metadata: { from: 'screening', to: 'interview' } },
  { id: '7', type: 'document', title: 'Document uploaded', description: 'CV_Sarah_Johnson.pdf', timestamp: new Date(Date.now() - 3 * 86400000).toISOString(), user: 'Sarah Johnson' },
  { id: '8', type: 'interview', title: 'Interview scheduled', description: 'Video interview on Friday at 10:00 AM', timestamp: new Date(Date.now() - 2 * 86400000).toISOString(), user: 'John Doe' },
];

const EVENT_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  created: { icon: '✨', color: '#6366f1', bg: '#eef2ff' },
  status_change: { icon: '↗️', color: '#8b5cf6', bg: '#f3e8ff' },
  note: { icon: '📝', color: '#f59e0b', bg: '#fef3c7' },
  email: { icon: '✉️', color: '#3b82f6', bg: '#dbeafe' },
  call: { icon: '📞', color: '#10b981', bg: '#ecfdf5' },
  interview: { icon: '📅', color: '#ec4899', bg: '#fce7f3' },
  document: { icon: '📄', color: '#6b7280', bg: '#f3f4f6' },
};

export default function TimelineView({ candidateId, candidateName }: Props) {
  const [events] = useState<TimelineEvent[]>(MOCK_EVENTS);
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 172800) return 'Yesterday';
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const groupByDate = (events: TimelineEvent[]) => {
    const groups: Record<string, TimelineEvent[]> = {};
    events.forEach(e => {
      const date = new Date(e.timestamp).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(e);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  };

  const grouped = groupByDate(filtered);

  return (
    <div style={{ padding: 20 }}>
      <style>{`
        .timeline-filters{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
        .timeline-filter{padding:6px 12px;font-size:11px;font-weight:600;border:1px solid #e5e7eb;border-radius:20px;background:#fff;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:4px}
        .timeline-filter:hover{border-color:#d1d5db}
        .timeline-filter.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .timeline-group{margin-bottom:24px}
        .timeline-date{font-size:12px;font-weight:600;color:#6b7280;margin-bottom:12px;padding-left:44px}
        .timeline-events{position:relative}
        .timeline-events::before{content:'';position:absolute;left:19px;top:0;bottom:0;width:2px;background:#e5e7eb}
        .timeline-event{display:flex;gap:16px;padding:12px 0;position:relative}
        .timeline-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;position:relative;z-index:1}
        .timeline-content{flex:1;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;transition:all .15s}
        .timeline-content:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
        .timeline-header{display:flex;align-items:start;justify-content:space-between;margin-bottom:6px}
        .timeline-title{font-size:13px;font-weight:600;color:#111}
        .timeline-time{font-size:11px;color:#9ca3af}
        .timeline-desc{font-size:13px;color:#6b7280;line-height:1.5}
        .timeline-user{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #f3f4f6}
        .timeline-user-name{font-size:11px;color:#6b7280}
        .timeline-status-change{display:flex;align-items:center;gap:8px;margin-top:8px}
        .timeline-arrow{color:#9ca3af;font-size:12px}
        .timeline-empty{text-align:center;padding:40px;color:#9ca3af}
        .timeline-empty-icon{font-size:40px;margin-bottom:12px;opacity:.5}
      `}</style>

      <div className="timeline-filters">
        <button className={`timeline-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Activity</button>
        {Object.entries(EVENT_CONFIG).map(([key, config]) => (
          <button key={key} className={`timeline-filter ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>
            {config.icon} {key.replace('_', ' ')}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">📋</div>
          <div>No activity found</div>
        </div>
      ) : (
        grouped.map(([date, events]) => (
          <div key={date} className="timeline-group">
            <div className="timeline-date">{fmtDate(events[0].timestamp)}</div>
            <div className="timeline-events">
              {events.map(event => {
                const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.note;
                return (
                  <div key={event.id} className="timeline-event">
                    <div className="timeline-icon" style={{ background: config.bg, color: config.color }}>
                      {config.icon}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <span className="timeline-title">{event.title}</span>
                        <span className="timeline-time">{fmtTime(event.timestamp)}</span>
                      </div>
                      {event.description && <div className="timeline-desc">{event.description}</div>}
                      {event.type === 'status_change' && event.metadata && (
                        <div className="timeline-status-change">
                          <StatusBadge status={event.metadata.from} size="sm" />
                          <span className="timeline-arrow">→</span>
                          <StatusBadge status={event.metadata.to} size="sm" />
                        </div>
                      )}
                      {event.user && (
                        <div className="timeline-user">
                          <Avatar name={event.user} size="xs" />
                          <span className="timeline-user-name">{event.user}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
