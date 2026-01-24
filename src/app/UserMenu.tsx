'use client';
import { useState } from 'react';

interface Props {
  onNavigate: (section: string) => void;
}

export default function UserMenu({ onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 150);
  };

  const menuItems = [
    { icon: '👤', label: 'My Profile', action: () => onNavigate('settings') },
    { icon: '⚙️', label: 'Settings', action: () => onNavigate('settings') },
    { icon: '🔔', label: 'Notifications', action: () => onNavigate('settings') },
    { icon: '❓', label: 'Help & Support', action: () => {} },
    { divider: true },
    { icon: '🚪', label: 'Sign Out', action: () => {}, danger: true },
  ];

  const styles = `
    @keyframes userMenuIn {
      from { opacity: 0; transform: translateY(10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    
    @keyframes userMenuOut {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(10px) scale(0.95); }
    }
    
    .user-menu {
      position: relative;
    }
    
    .user-trigger {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-fast);
      width: 100%;
    }
    
    .user-trigger:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
    }
    
    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    }
    
    .user-info {
      flex: 1;
      min-width: 0;
      text-align: left;
    }
    
    .user-name {
      font-size: 14px;
      font-weight: 600;
      color: white;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .user-role {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
    }
    
    .user-chevron {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      transition: transform var(--transition-fast);
    }
    
    .user-trigger:hover .user-chevron {
      transform: translateY(2px);
    }
    
    .user-dropdown {
      position: absolute;
      bottom: calc(100% + 12px);
      left: 0;
      right: 0;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-xl);
      box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      z-index: 1000;
      animation: userMenuIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .user-dropdown.closing {
      animation: userMenuOut 0.15s ease-out forwards;
    }
    
    .user-dropdown-header {
      padding: 16px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      align-items: center;
      gap: 14px;
    }
    
    .user-dropdown-avatar {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-xl);
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 18px;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    
    .user-dropdown-info {
      flex: 1;
    }
    
    .user-dropdown-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 2px;
    }
    
    .user-dropdown-email {
      font-size: 12px;
      color: var(--gray-500);
    }
    
    .user-dropdown-list {
      padding: 8px;
    }
    
    .user-dropdown-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-fast);
      font-size: 14px;
      color: var(--gray-700);
    }
    
    .user-dropdown-item:hover {
      background: var(--gray-50);
    }
    
    .user-dropdown-item.danger {
      color: var(--danger);
    }
    
    .user-dropdown-item.danger:hover {
      background: var(--danger-light);
    }
    
    .user-dropdown-item-icon {
      font-size: 18px;
    }
    
    .user-dropdown-divider {
      height: 1px;
      background: var(--gray-100);
      margin: 8px;
    }
    
    .user-dropdown-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--gray-100);
      background: var(--gray-50);
    }
    
    .user-dropdown-version {
      font-size: 11px;
      color: var(--gray-400);
      text-align: center;
    }
  `;

  return (
    <div className="user-menu">
      <style>{styles}</style>
      
      <button 
        className="user-trigger" 
        onClick={() => open ? handleClose() : setOpen(true)}
      >
        <div className="user-avatar">JD</div>
        <div className="user-info">
          <div className="user-name">John Doe</div>
          <div className="user-role">Recruiter</div>
        </div>
        <span className="user-chevron">▼</span>
      </button>
      
      {open && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
            onClick={handleClose} 
          />
          <div className={`user-dropdown ${isClosing ? 'closing' : ''}`}>
            <div className="user-dropdown-header">
              <div className="user-dropdown-avatar">JD</div>
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">John Doe</div>
                <div className="user-dropdown-email">john.doe@carerecruit.com</div>
              </div>
            </div>
            
            <div className="user-dropdown-list">
              {menuItems.map((item, i) => 
                item.divider ? (
                  <div key={i} className="user-dropdown-divider" />
                ) : (
                  <div
                    key={i}
                    className={`user-dropdown-item ${item.danger ? 'danger' : ''}`}
                    onClick={() => { item.action?.(); handleClose(); }}
                  >
                    <span className="user-dropdown-item-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                )
              )}
            </div>
            
            <div className="user-dropdown-footer">
              <div className="user-dropdown-version">CareRecruit ATS v1.0.0</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
