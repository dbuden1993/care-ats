'use client';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
  footer?: React.ReactNode;
}

const SIZES = {
  sm: 400,
  md: 500,
  lg: 640,
  xl: 800,
  full: '90vw',
};

export default function Modal({ 
  open, 
  onClose, 
  title, 
  subtitle,
  children, 
  size = 'md',
  showClose = true,
  footer
}: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        zIndex: 1000,
        animation: 'modalBgIn .2s ease',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        @keyframes modalBgIn{from{opacity:0}to{opacity:1}}
        @keyframes modalIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .modal-container{background:#fff;border-radius:20px;width:100%;max-width:${typeof SIZES[size] === 'number' ? SIZES[size] + 'px' : SIZES[size]};max-height:90vh;display:flex;flex-direction:column;animation:modalIn .25s cubic-bezier(.4,0,.2,1);box-shadow:0 20px 60px rgba(0,0,0,.2)}
        .modal-header{padding:24px 24px 0;display:flex;align-items:start;justify-content:space-between}
        .modal-title-wrap{flex:1}
        .modal-title{font-size:20px;font-weight:700;color:#111;margin:0}
        .modal-subtitle{font-size:14px;color:#6b7280;margin-top:4px}
        .modal-close{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:10px;cursor:pointer;font-size:16px;color:#6b7280;transition:all .15s;flex-shrink:0;margin-left:16px}
        .modal-close:hover{background:#e5e7eb;color:#111}
        .modal-body{flex:1;overflow-y:auto;padding:24px}
        .modal-footer{padding:16px 24px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px;background:#fafbfc;border-radius:0 0 20px 20px}
      `}</style>

      <div className="modal-container">
        {(title || showClose) && (
          <div className="modal-header">
            <div className="modal-title-wrap">
              {title && <h2 className="modal-title">{title}</h2>}
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            {showClose && (
              <button className="modal-close" onClick={onClose}>✕</button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
