'use client';
import { useState, useEffect } from 'react';

interface Notification {
  id: string;
  type: 'interview' | 'application' | 'call' | 'sms' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'interview', title: 'Interview Reminder', message: 'Interview with Sarah Johnson in 30 minutes', time: '30m ago', read: false },
  { id: '2', type: 'call', title: 'New Call Graded', message: 'Michael Chen scored Grade A on phone screening', time: '1h ago', read: false },
  { id: '3', type: 'application', title: 'New Application', message: 'Emma Wilson applied for Care Assistant', time: '2h ago', read: true },
  { id: '4', type: 'sms', title: 'SMS Response', message: 'David Brown replied "YES" to your campaign', time: '3h ago', read: true },
  { id: '5', type: 'system', title: 'Weekly Report Ready', message: 'Your hiring report for this week is ready to view', time: '1d ago', read: true },
];

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [isClosing, setIsClosing] = useState(false);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 150);
  };

  const markRead = (id: string) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const typeConfig = {
    interview: { icon: '📅', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', color: '#b45309' },
    application: { icon: '📥', bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', color: '#059669' },
    call: { icon: '📞', bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', color: '#db2777' },
    sms: { icon: '💬', bg: 'linear-gradient(135deg, #cffafe 0%, #a5f3fc 100%)', color: '#0891b2' },
    system: { icon: '🔔', bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', color: '#4f46e5' },
  };

  const styles = `
    @keyframes notifBounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    
    @keyframes notifDropdownIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    @keyframes notifDropdownOut {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(-10px) scale(0.95); }
    }
    
    @keyframes notifSlideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    .notif-btn {
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      cursor: pointer;
      position: relative;
      transition: all var(--transition-fast);
      font-size: 20px;
    }
    
    .notif-btn:hover {
      background: var(--gray-50);
      border-color: var(--gray-300);
    }
    
    .notif-btn.has-unread {
      animation: notifBounce 0.5s ease;
    }
    
    .notif-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: white;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
    }
    
    .notif-dropdown {
      position: absolute;
      top: calc(100% + 12px);
      right: 0;
      width: 400px;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-xl);
      box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.2);
      z-index: 100;
      overflow: hidden;
      animation: notifDropdownIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .notif-dropdown.closing {
      animation: notifDropdownOut 0.15s ease-out forwards;
    }
    
    .notif-header {
      padding: 18px 20px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .notif-title {
      font-family: var(--font-display);
      font-size: 16px;
      font-weight: 700;
      color: var(--gray-900);
    }
    
    .notif-mark-all {
      font-size: 12px;
      color: var(--primary);
      cursor: pointer;
      background: none;
      border: none;
      font-weight: 600;
      transition: color var(--transition-fast);
    }
    
    .notif-mark-all:hover {
      color: var(--primary-dark);
    }
    
    .notif-list {
      max-height: 400px;
      overflow-y: auto;
    }
    
    .notif-item {
      display: flex;
      gap: 14px;
      padding: 16px 20px;
      border-bottom: 1px solid var(--gray-50);
      cursor: pointer;
      transition: all var(--transition-fast);
      position: relative;
      animation: notifSlideIn 0.3s ease-out forwards;
    }
    
    .notif-item:hover {
      background: var(--gray-50);
    }
    
    .notif-item:last-child {
      border-bottom: none;
    }
    
    .notif-item.unread {
      background: linear-gradient(90deg, var(--primary-50) 0%, transparent 100%);
    }
    
    .notif-item.unread::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--primary);
    }
    
    .notif-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    
    .notif-content {
      flex: 1;
      min-width: 0;
    }
    
    .notif-content-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }
    
    .notif-content-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--gray-900);
    }
    
    .notif-item.unread .notif-content-title {
      font-weight: 700;
    }
    
    .notif-time {
      font-size: 11px;
      color: var(--gray-400);
      white-space: nowrap;
    }
    
    .notif-content-msg {
      font-size: 13px;
      color: var(--gray-600);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .notif-delete {
      position: absolute;
      top: 50%;
      right: 16px;
      transform: translateY(-50%);
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-100);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 12px;
      opacity: 0;
      transition: all var(--transition-fast);
    }
    
    .notif-item:hover .notif-delete {
      opacity: 1;
    }
    
    .notif-delete:hover {
      background: var(--danger-light);
      color: var(--danger);
    }
    
    .notif-empty {
      padding: 48px 20px;
      text-align: center;
    }
    
    .notif-empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
    
    .notif-empty-text {
      font-size: 14px;
      color: var(--gray-500);
    }
    
    .notif-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--gray-100);
      text-align: center;
      background: var(--gray-50);
    }
    
    .notif-footer-link {
      font-size: 13px;
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
      transition: color var(--transition-fast);
    }
    
    .notif-footer-link:hover {
      color: var(--primary-dark);
    }
  `;

  return (
    <div style={{ position: 'relative' }}>
      <style>{styles}</style>
      
      <button 
        className={`notif-btn ${unreadCount > 0 ? 'has-unread' : ''}`} 
        onClick={() => open ? handleClose() : setOpen(true)}
      >
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>
      
      {open && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
            onClick={handleClose} 
          />
          <div className={`notif-dropdown ${isClosing ? 'closing' : ''}`}>
            <div className="notif-header">
              <span className="notif-title">Notifications</span>
              {unreadCount > 0 && (
                <button className="notif-mark-all" onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
            </div>
            
            <div className="notif-list">
              {notifications.length === 0 ? (
                <div className="notif-empty">
                  <div className="notif-empty-icon">🔔</div>
                  <div className="notif-empty-text">No notifications yet</div>
                </div>
              ) : (
                notifications.map((n, index) => {
                  const config = typeConfig[n.type];
                  return (
                    <div 
                      key={n.id} 
                      className={`notif-item ${!n.read ? 'unread' : ''}`}
                      onClick={() => markRead(n.id)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div 
                        className="notif-icon" 
                        style={{ background: config.bg, color: config.color }}
                      >
                        {config.icon}
                      </div>
                      <div className="notif-content">
                        <div className="notif-content-header">
                          <span className="notif-content-title">{n.title}</span>
                          <span className="notif-time">{n.time}</span>
                        </div>
                        <div className="notif-content-msg">{n.message}</div>
                      </div>
                      <button 
                        className="notif-delete"
                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="notif-footer">
              <a href="#" className="notif-footer-link">View all notifications →</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
