'use client';
import { useState, createContext, useContext, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const contextValue: ToastContextType = {
    toast: addToast,
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const colors = {
    success: { bg: '#ecfdf5', border: '#10b981', text: '#059669' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },
    info: { bg: '#eef2ff', border: '#6366f1', text: '#4f46e5' },
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <style>{`
          .toast-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: slideIn 0.2s ease; min-width: 280px; border-left: 4px solid; }
          @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
          .toast-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
          .toast-message { flex: 1; font-size: 13px; font-weight: 500; }
          .toast-close { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; opacity: 0.5; font-size: 14px; }
          .toast-close:hover { opacity: 1; }
        `}</style>
        {toasts.map(t => (
          <div 
            key={t.id} 
            className="toast-item"
            style={{ 
              background: colors[t.type].bg, 
              borderColor: colors[t.type].border,
              color: colors[t.type].text 
            }}
          >
            <div className="toast-icon" style={{ background: colors[t.type].border, color: '#fff' }}>
              {icons[t.type]}
            </div>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
