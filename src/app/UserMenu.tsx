'use client';
import { useState } from 'react';

interface Props {
  onNavigate: (section: string) => void;
}

export default function UserMenu({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  const user = {
    name: 'John Doe',
    email: 'john@carerecruit.com',
    role: 'Recruiter',
    avatar: 'JD'
  };

  const menuItems = [
    { icon: '👤', label: 'My Profile', action: () => {} },
    { icon: '⚙️', label: 'Settings', action: () => onNavigate('settings') },
    { icon: '🔔', label: 'Notification Preferences', action: () => onNavigate('settings') },
    { icon: '❓', label: 'Help & Support', action: () => {} },
    { divider: true },
    { icon: '🚪', label: 'Sign Out', action: () => {}, danger: true },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .user-btn{display:flex;align-items:center;gap:10px;padding:6px 10px 6px 6px;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;transition:all .15s}
        .user-btn:hover{background:#e5e7eb}
        .user-avatar{width:32px;height:32px;background:linear-gradient(135deg,#10b981,#059669);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:12px}
        .user-info{text-align:left}
        .user-name{font-size:13px;font-weight:500;color:#111}
        .user-role{font-size:10px;color:#6b7280}
        .user-chevron{font-size:12px;color:#6b7280;margin-left:4px}
        .user-dropdown{position:absolute;top:100%;right:0;width:220px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.15);margin-top:8px;z-index:100;overflow:hidden}
        .user-dropdown-header{padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:12px}
        .user-dropdown-avatar{width:40px;height:40px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:14px}
        .user-dropdown-info h4{font-size:14px;font-weight:600;color:#111;margin:0}
        .user-dropdown-info p{font-size:11px;color:#6b7280;margin:2px 0 0}
        .user-dropdown-menu{padding:8px}
        .user-menu-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .15s;border:none;background:none;width:100%;text-align:left;font-size:13px;color:#374151}
        .user-menu-item:hover{background:#f3f4f6}
        .user-menu-item.danger{color:#dc2626}
        .user-menu-item.danger:hover{background:#fef2f2}
        .user-menu-icon{width:20px;text-align:center}
        .user-menu-divider{height:1px;background:#e5e7eb;margin:8px 0}
      `}</style>
      
      <button className="user-btn" onClick={() => setOpen(!open)}>
        <div className="user-avatar">{user.avatar}</div>
        <div className="user-info">
          <div className="user-name">{user.name}</div>
          <div className="user-role">{user.role}</div>
        </div>
        <span className="user-chevron">▼</span>
      </button>
      
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div className="user-dropdown">
            <div className="user-dropdown-header">
              <div className="user-dropdown-avatar">{user.avatar}</div>
              <div className="user-dropdown-info">
                <h4>{user.name}</h4>
                <p>{user.email}</p>
              </div>
            </div>
            <div className="user-dropdown-menu">
              {menuItems.map((item, i) => 
                item.divider ? (
                  <div key={i} className="user-menu-divider" />
                ) : (
                  <button 
                    key={i} 
                    className={`user-menu-item ${item.danger ? 'danger' : ''}`}
                    onClick={() => { item.action?.(); setOpen(false); }}
                  >
                    <span className="user-menu-icon">{item.icon}</span>
                    {item.label}
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
