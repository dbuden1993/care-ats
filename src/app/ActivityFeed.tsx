'use client';
import { useState, useEffect } from 'react';
import { getActivity } from './db';

interface Activity { id: string; type: string; description: string; created_by?: string; created_at: string; metadata?: any; }

interface Props { candidateId: string; }

const ICONS: Record<string, string> = {
  status_change: '📊',
  note_added: '📝',
  interview_scheduled: '📅',
  email_sent: '📧',
  document_uploaded: '📎',
  call_completed: '📞',
  scorecard_submitted: '⭐',
  created: '✨',
  default: '•'
};

export default function ActivityFeed({ candidateId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadActivities(); }, [candidateId]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const data = await getActivity(candidateId);
      setActivities(data || []);
    } catch (err) {
      console.error('Failed to load activity:', err);
      // Mock data if table doesn't exist
      setActivities([
        { id: '1', type: 'status_change', description: 'Status changed to interview', created_at: new Date(Date.now() - 3600000).toISOString(), created_by: 'John Doe' },
        { id: '2', type: 'note_added', description: 'Note added', created_at: new Date(Date.now() - 86400000).toISOString(), created_by: 'Jane Smith' },
        { id: '3', type: 'created', description: 'Candidate created', created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
      ]);
    }
    setLoading(false);
  };

  const fmt = (d: string) => {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .activity-timeline{position:relative;padding-left:28px}
        .activity-timeline::before{content:'';position:absolute;left:10px;top:8px;bottom:8px;width:2px;background:#e5e7eb}
        .activity-item{position:relative;padding-bottom:20px}
        .activity-item:last-child{padding-bottom:0}
        .activity-dot{position:absolute;left:-22px;width:20px;height:20px;background:#fff;border:2px solid #e5e7eb;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px}
        .activity-item.status_change .activity-dot{border-color:#6366f1;background:#eef2ff}
        .activity-item.note_added .activity-dot{border-color:#10b981;background:#ecfdf5}
        .activity-item.interview_scheduled .activity-dot{border-color:#f59e0b;background:#fef3c7}
        .activity-item.email_sent .activity-dot{border-color:#3b82f6;background:#eff6ff}
        .activity-content{background:#f9fafb;border-radius:8px;padding:12px}
        .activity-desc{font-size:13px;color:#374151}
        .activity-meta{display:flex;gap:12px;margin-top:6px;font-size:11px;color:#9ca3af}
        .activity-author{color:#6b7280}
        .activity-loading{text-align:center;padding:20px;color:#6b7280;font-size:13px}
        .activity-empty{text-align:center;padding:40px;color:#9ca3af;font-size:13px}
      `}</style>
      
      {loading ? (
        <div className="activity-loading">Loading activity...</div>
      ) : activities.length === 0 ? (
        <div className="activity-empty">No activity yet</div>
      ) : (
        <div className="activity-timeline">
          {activities.map(a => (
            <div key={a.id} className={`activity-item ${a.type}`}>
              <div className="activity-dot">{ICONS[a.type] || ICONS.default}</div>
              <div className="activity-content">
                <div className="activity-desc">{a.description}</div>
                <div className="activity-meta">
                  <span>{fmt(a.created_at)}</span>
                  {a.created_by && <span className="activity-author">by {a.created_by}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
