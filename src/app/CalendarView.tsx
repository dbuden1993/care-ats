'use client';
import { useState, useEffect } from 'react';
import { getInterviews, updateInterview, deleteInterview } from './db';

interface Interview { id: string; candidate_id: string; scheduled_at: string; duration_minutes: number; type: string; location?: string; video_link?: string; interviewers: string[]; status: string; notes?: string; }

interface Props { 
  candidates: any[];
  onSchedule?: (candidate: any) => void;
}

export default function CalendarView({ candidates, onSchedule }: Props) {
  const [cur, setCur] = useState(new Date());
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => { loadInterviews(); }, []);

  const loadInterviews = async () => {
    setLoading(true);
    try {
      const data = await getInterviews();
      setInterviews(data || []);
    } catch (err) {
      console.error('Failed to load interviews:', err);
      // Mock data for demo
      setInterviews([
        { id: '1', candidate_id: candidates[0]?.id || '', scheduled_at: new Date(Date.now() + 86400000).toISOString(), duration_minutes: 30, type: 'video', interviewers: ['John Doe'], status: 'scheduled' },
        { id: '2', candidate_id: candidates[1]?.id || '', scheduled_at: new Date(Date.now() + 172800000).toISOString(), duration_minutes: 45, type: 'in-person', interviewers: ['Jane Smith'], status: 'scheduled' },
      ]);
    }
    setLoading(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateInterview(id, { status });
      setSelectedInterview(null);
      await loadInterviews();
    } catch (err) {
      console.error('Failed to update interview:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cancel this interview?')) return;
    try {
      await deleteInterview(id);
      setSelectedInterview(null);
      await loadInterviews();
    } catch (err) {
      console.error('Failed to delete interview:', err);
    }
  };

  const handleDateClick = (date: Date) => {
    if (selectedDate?.toDateString() === date.toDateString()) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
      setSelectedInterview(null);
    }
  };

  const handleInterviewClick = (int: Interview, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedInterview?.id === int.id) {
      setSelectedInterview(null);
    } else {
      setSelectedInterview(int);
      setSelectedDate(null);
    }
  };

  const clearSelection = () => {
    setSelectedInterview(null);
    setSelectedDate(null);
  };
  
  const days = (() => {
    const y = cur.getFullYear(), m = cur.getMonth();
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    const d: (Date|null)[] = [];
    for (let i = 0; i < first.getDay(); i++) d.push(null);
    for (let i = 1; i <= last.getDate(); i++) d.push(new Date(y, m, i));
    return d;
  })();

  const getInts = (d: Date) => interviews.filter(i => new Date(i.scheduled_at).toDateString() === d.toDateString());
  const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const getCand = (id: string) => candidates.find(c => c.id === id);
  
  const todayInterviews = interviews.filter(i => new Date(i.scheduled_at).toDateString() === new Date().toDateString() && i.status === 'scheduled');
  const upcoming = interviews.filter(i => new Date(i.scheduled_at) > new Date() && i.status === 'scheduled').sort((a,b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const selectedDateInterviews = selectedDate ? getInts(selectedDate) : [];

  return (
    <div style={{ display: 'flex', gap: 20, padding: 20 }}>
      <style>{`
        .cal-sidebar{width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:16px}
        .cal-main{flex:1;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}
        .cal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e5e7eb}
        .cal-nav{display:flex;align-items:center;gap:8px}
        .cal-title{font-size:16px;font-weight:600;color:#111;min-width:160px}
        .cal-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;transition:all .15s;font-size:14px}
        .cal-btn:hover{background:#f9fafb;border-color:#d1d5db}
        .cal-today-btn{padding:6px 12px;font-size:12px;font-weight:500;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;transition:all .15s}
        .cal-today-btn:hover{background:#f9fafb;border-color:#d1d5db}
        .cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}
        .cal-day-head{padding:10px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;text-transform:uppercase}
        .cal-day{min-height:90px;padding:6px;border-right:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .15s}
        .cal-day:nth-child(7n){border-right:none}
        .cal-day:hover{background:#f9fafb}
        .cal-day.today{background:#eef2ff}
        .cal-day.selected{background:#e0e7ff;box-shadow:inset 0 0 0 2px #6366f1}
        .cal-day-num{font-size:12px;font-weight:500;color:#111;margin-bottom:4px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%}
        .cal-day.today .cal-day-num{background:#4f46e5;color:#fff}
        .cal-event{padding:2px 6px;border-radius:4px;font-size:10px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;transition:all .15s;border-left:3px solid}
        .cal-event:hover{opacity:.8}
        .cal-event.scheduled{background:#eef2ff;border-color:#4f46e5;color:#4f46e5}
        .cal-event.completed{background:#ecfdf5;border-color:#10b981;color:#059669}
        .cal-event.cancelled{background:#fef2f2;border-color:#ef4444;color:#dc2626;opacity:.6}
        .cal-event.active{box-shadow:0 0 0 2px #4f46e5}
        .cal-more{font-size:10px;color:#6b7280;padding:2px 4px}
        .sidebar-card{background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden}
        .sidebar-header{padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .sidebar-title{font-size:13px;font-weight:600;color:#111;display:flex;align-items:center;gap:6px}
        .sidebar-close{width:22px;height:22px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;font-size:11px}
        .sidebar-close:hover{background:#e5e7eb}
        .sidebar-body{padding:12px;max-height:300px;overflow-y:auto}
        .today-banner{background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;padding:16px;border-radius:12px}
        .today-banner-title{font-size:12px;font-weight:500;opacity:.9;margin-bottom:4px;display:flex;align-items:center;gap:6px}
        .today-banner-count{font-size:28px;font-weight:700}
        .today-banner-label{font-size:11px;opacity:.8}
        .int-card{background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:8px;cursor:pointer;transition:all .15s;border:2px solid transparent}
        .int-card:last-child{margin-bottom:0}
        .int-card:hover{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .int-card.selected{border-color:#4f46e5;background:#eef2ff}
        .int-time{font-size:11px;color:#6366f1;font-weight:600;margin-bottom:4px}
        .int-name{font-size:13px;font-weight:600;color:#111}
        .int-meta{font-size:11px;color:#6b7280;margin-top:2px}
        .int-type{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;background:#e5e7eb;border-radius:4px;font-size:9px;font-weight:500;margin-top:6px}
        .int-actions{display:flex;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb}
        .int-btn{flex:1;padding:6px;font-size:10px;font-weight:500;border-radius:6px;cursor:pointer;border:none;transition:all .15s;text-align:center}
        .int-btn.complete{background:#ecfdf5;color:#059669}
        .int-btn.complete:hover{background:#d1fae5}
        .int-btn.cancel{background:#fef2f2;color:#dc2626}
        .int-btn.cancel:hover{background:#fee2e2}
        .empty-sidebar{text-align:center;padding:24px 12px;color:#9ca3af}
        .empty-sidebar-icon{font-size:24px;margin-bottom:6px;opacity:.6}
        .empty-sidebar-text{font-size:12px}
      `}</style>
      
      {/* Left Sidebar */}
      <div className="cal-sidebar">
        <div className="today-banner">
          <div className="today-banner-title">📅 Today</div>
          <div className="today-banner-count">{todayInterviews.length}</div>
          <div className="today-banner-label">interview{todayInterviews.length !== 1 ? 's' : ''} scheduled</div>
        </div>

        {/* Selected Interview Detail */}
        {selectedInterview && (
          <div className="sidebar-card">
            <div className="sidebar-header">
              <span className="sidebar-title">📋 Details</span>
              <button className="sidebar-close" onClick={() => setSelectedInterview(null)}>×</button>
            </div>
            <div className="sidebar-body">
              {(() => {
                const cand = getCand(selectedInterview.candidate_id);
                return (
                  <div className="int-card selected" style={{cursor:'default',margin:0}}>
                    <div className="int-time">
                      {new Date(selectedInterview.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {fmtTime(selectedInterview.scheduled_at)}
                    </div>
                    <div className="int-name">{cand?.name || 'Candidate'}</div>
                    <div className="int-meta">{selectedInterview.duration_minutes} min • {selectedInterview.interviewers?.join(', ') || 'TBD'}</div>
                    <span className="int-type">{selectedInterview.type === 'video' ? '📹' : selectedInterview.type === 'phone' ? '📞' : '🏢'} {selectedInterview.type}</span>
                    <div className="int-actions">
                      <button className="int-btn complete" onClick={() => handleStatusChange(selectedInterview.id, 'completed')}>✓ Done</button>
                      <button className="int-btn cancel" onClick={() => handleDelete(selectedInterview.id)}>× Cancel</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Selected Date Detail */}
        {selectedDate && !selectedInterview && (
          <div className="sidebar-card">
            <div className="sidebar-header">
              <span className="sidebar-title">📆 {selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              <button className="sidebar-close" onClick={() => setSelectedDate(null)}>×</button>
            </div>
            <div className="sidebar-body">
              {selectedDateInterviews.length === 0 ? (
                <div className="empty-sidebar">
                  <div className="empty-sidebar-icon">📭</div>
                  <div className="empty-sidebar-text">No interviews</div>
                </div>
              ) : (
                selectedDateInterviews.map(int => {
                  const cand = getCand(int.candidate_id);
                  return (
                    <div key={int.id} className="int-card" onClick={() => setSelectedInterview(int)}>
                      <div className="int-time">{fmtTime(int.scheduled_at)}</div>
                      <div className="int-name">{cand?.name || 'Candidate'}</div>
                      <div className="int-meta">{int.duration_minutes} min</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Upcoming */}
        <div className="sidebar-card">
          <div className="sidebar-header">
            <span className="sidebar-title">⏰ Upcoming</span>
          </div>
          <div className="sidebar-body">
            {loading ? (
              <div className="empty-sidebar"><div className="empty-sidebar-text">Loading...</div></div>
            ) : upcoming.length === 0 ? (
              <div className="empty-sidebar">
                <div className="empty-sidebar-icon">📭</div>
                <div className="empty-sidebar-text">No upcoming interviews</div>
              </div>
            ) : (
              upcoming.slice(0, 4).map(int => {
                const cand = getCand(int.candidate_id);
                const isSelected = selectedInterview?.id === int.id;
                return (
                  <div key={int.id} className={`int-card ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedInterview(isSelected ? null : int)}>
                    <div className="int-time">
                      {new Date(int.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} • {fmtTime(int.scheduled_at)}
                    </div>
                    <div className="int-name">{cand?.name || 'Candidate'}</div>
                    <span className="int-type">{int.type === 'video' ? '📹' : int.type === 'phone' ? '📞' : '🏢'} {int.type}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      
      {/* Calendar Main */}
      <div className="cal-main">
        <div className="cal-head">
          <div className="cal-nav">
            <button className="cal-btn" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))}>←</button>
            <span className="cal-title">{cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
            <button className="cal-btn" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))}>→</button>
          </div>
          <button className="cal-today-btn" onClick={() => setCur(new Date())}>Today</button>
        </div>
        <div className="cal-grid">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="cal-day-head">{d}</div>)}
          {days.map((d, i) => {
            const dayInts = d ? getInts(d) : [];
            const isToday = d?.toDateString() === new Date().toDateString();
            const isSelected = d && selectedDate?.toDateString() === d.toDateString();
            return (
              <div 
                key={i} 
                className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => d && handleDateClick(d)}
              >
                {d && <>
                  <div className="cal-day-num">{d.getDate()}</div>
                  {dayInts.slice(0, 2).map(int => {
                    const cand = getCand(int.candidate_id);
                    const isActive = selectedInterview?.id === int.id;
                    return (
                      <div 
                        key={int.id} 
                        className={`cal-event ${int.status} ${isActive ? 'active' : ''}`}
                        onClick={(e) => handleInterviewClick(int, e)}
                      >
                        {fmtTime(int.scheduled_at)} {cand?.name?.split(' ')[0] || 'Interview'}
                      </div>
                    );
                  })}
                  {dayInts.length > 2 && <div className="cal-more">+{dayInts.length - 2} more</div>}
                </>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
