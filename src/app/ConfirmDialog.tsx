'use client';
import { useState, createContext, useContext, useCallback } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context.confirm;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }} onClick={() => handleClose(false)}>
          <style>{`
            .confirm-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 400px; animation: scaleIn 0.15s ease; }
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            .confirm-header { padding: 24px 24px 0; text-align: center; }
            .confirm-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px; }
            .confirm-icon.danger { background: #fef2f2; }
            .confirm-icon.warning { background: #fef3c7; }
            .confirm-icon.info { background: #eef2ff; }
            .confirm-title { font-size: 18px; font-weight: 600; color: #111; margin-bottom: 8px; }
            .confirm-message { font-size: 14px; color: #6b7280; line-height: 1.5; padding: 0 24px 24px; text-align: center; }
            .confirm-actions { display: flex; gap: 12px; padding: 0 24px 24px; }
            .confirm-btn { flex: 1; padding: 12px; font-size: 14px; font-weight: 500; border-radius: 8px; cursor: pointer; border: none; transition: all 0.15s; }
            .confirm-btn.cancel { background: #f3f4f6; color: #374151; }
            .confirm-btn.cancel:hover { background: #e5e7eb; }
            .confirm-btn.danger { background: #dc2626; color: #fff; }
            .confirm-btn.danger:hover { background: #b91c1c; }
            .confirm-btn.warning { background: #f59e0b; color: #fff; }
            .confirm-btn.warning:hover { background: #d97706; }
            .confirm-btn.info { background: #4f46e5; color: #fff; }
            .confirm-btn.info:hover { background: #4338ca; }
          `}</style>
          
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-header">
              <div className={`confirm-icon ${dialog.type || 'info'}`}>
                {dialog.type === 'danger' ? '⚠️' : dialog.type === 'warning' ? '❓' : 'ℹ️'}
              </div>
              <div className="confirm-title">{dialog.title}</div>
            </div>
            <div className="confirm-message">{dialog.message}</div>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={() => handleClose(false)}>
                {dialog.cancelText || 'Cancel'}
              </button>
              <button className={`confirm-btn ${dialog.type || 'info'}`} onClick={() => handleClose(true)}>
                {dialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
