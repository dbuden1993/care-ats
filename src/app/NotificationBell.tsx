'use client';
import { useState } from 'react';

interface Notification {
  id: string;
  type: 'interview' | 'application' | 'message' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'interview', title: 'Interview Reminder', message: 'Interview with Sarah Johnson in 30 minutes', time: '30m ago', read: false },
  { id: '2', type: 'application', title: 'New Application', message: 'Michael Chen applied for Care Assistant', time: '1h ago', read: false },
  { id: '3', type: 'message', title: 'Team Message', message: 'Jane commented on David Wilson\'s profile', time: '2h ago', read: true },
  { id: '4', type: 'system', title: 'Weekly Report Ready', message: 'Your hiring report for this week is ready', time: '1d ago', read: true },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const typeIcons = { interview: '📅', application: '📥', message: '💬', system: '🔔' };
  const typeColors = { 
    interview: { bg: '#fef3c7', color: '#b45309' }, 
    application: { bg: '#ecfdf5', color: '#059669' },
    message: { bg: '#eef2ff', color: '#4f46e5' },
    system: { bg: '#f3f4f6', color: '#374151' }
  };

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .notif-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;position:relative;transition:all .15s;font-size:18px}
        .notif-btn:hover{background:#e5e7eb}
        .notif-badge{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;background:#ef4444;color:#fff;border-radius:9px;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;padding:0 4px}
        .notif-dropdown{position:absolute;top:100%;right:0;width:360px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.15);margin-top:8px;z-index:100;overflow:hidden}
        .notif-header{padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .notif-title{font-size:14px;font-weight:600;color:#111}
        .notif-mark-read{font-size:11px;color:#6366f1;cursor:pointer;background:none;border:none;font-weight:500}
        .notif-mark-read:hover{text-decoration:underline}
        .notif-list{max-height:360px;overflow-y:auto}
        .notif-item{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;transition:background .15s}
        .notif-item:hover{background:#f9fafb}
        .notif-item:last-child{border-bottom:none}
        .notif-item.unread{background:#fafbff}
        .notif-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
        .notif-content{flex:1;min-width:0}
        .notif-content-title{font-size:13px;font-weight:500;color:#111;margin-bottom:2px}
        .notif-item.unread .notif-content-title{font-weight:600}
        .notif-content-msg{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .notif-time{font-size:10px;color:#9ca3af;flex-shrink:0}
        .notif-dot{width:8px;height:8px;background:#4f46e5;border-radius:50%;flex-shrink:0}
        .notif-empty{padding:32px;text-align:center;color:#9ca3af;font-size:13px}
        .notif-footer{padding:12px 16px;border-top:1px solid #e5e7eb;text-align:center}
        .notif-footer a{font-size:12px;color:#6366f1;text-decoration:none;font-weight:500}
        .notif-footer a:hover{text-decoration:underline}
      `}</style>
      
      <button className="notif-btn" onClick={() => setOpen(!open)}>
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>
      
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-header">
              <span className="notif-title">Notifications</span>
              {unreadCount > 0 && (
                <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
              )}
            </div>
            <div className="notif-list">
              {notifications.length === 0 ? (
                <div className="notif-empty">No notifications</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`notif-item ${!n.read ? 'unread' : ''}`}
                    onClick={() => markRead(n.id)}
                  >
                    <div className="notif-icon" style={{ background: typeColors[n.type].bg, color: typeColors[n.type].color }}>
                      {typeIcons[n.type]}
                    </div>
                    <div className="notif-content">
                      <div className="notif-content-title">{n.title}</div>
                      <div className="notif-content-msg">{n.message}</div>
                    </div>
                    <span className="notif-time">{n.time}</span>
                    {!n.read && <div className="notif-dot" />}
                  </div>
                ))
              )}
            </div>
            <div className="notif-footer">
              <a href="#">View all notifications</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
