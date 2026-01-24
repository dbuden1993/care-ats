'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = { id, type, message, duration };
    
    setToasts(prev => [...prev, toast]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: ToastContextType = {
    toasts,
    success: (message, duration) => addToast('success', message, duration),
    error: (message, duration) => addToast('error', message, duration),
    warning: (message, duration) => addToast('warning', message, duration),
    info: (message, duration) => addToast('info', message, duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const toastConfig = {
    success: {
      icon: '✓',
      bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
    },
    error: {
      icon: '✕',
      bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
    },
    warning: {
      icon: '!',
      bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
    },
    info: {
      icon: 'i',
      bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
    },
  };

  const styles = `
    @keyframes toastSlideIn {
      from {
        opacity: 0;
        transform: translateX(100%) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
    
    @keyframes toastSlideOut {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(100%) scale(0.9);
      }
    }
    
    @keyframes toastProgress {
      from { width: 100%; }
      to { width: 0%; }
    }
    
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }
    
    .toast {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      border-radius: var(--radius-xl);
      color: white;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.2), 0 4px 10px -5px rgba(0, 0, 0, 0.1);
      animation: toastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      pointer-events: auto;
      position: relative;
      overflow: hidden;
      min-width: 300px;
      max-width: 420px;
    }
    
    .toast.dismissing {
      animation: toastSlideOut 0.3s ease-out forwards;
    }
    
    .toast-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }
    
    .toast-content {
      flex: 1;
      line-height: 1.4;
    }
    
    .toast-dismiss {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.15);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    
    .toast-dismiss:hover {
      background: rgba(255, 255, 255, 0.25);
    }
    
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: rgba(255, 255, 255, 0.4);
      border-radius: 0 0 var(--radius-xl) var(--radius-xl);
    }
    
    @media (max-width: 480px) {
      .toast-container {
        left: 12px;
        right: 12px;
        top: 12px;
      }
      
      .toast {
        min-width: 0;
        width: 100%;
      }
    }
  `;

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{styles}</style>
      <div className="toast-container">
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          return (
            <div
              key={toast.id}
              className="toast"
              style={{ background: config.bg }}
              role="alert"
            >
              <div className="toast-icon" style={{ background: config.iconBg }}>
                {config.icon}
              </div>
              <div className="toast-content">{toast.message}</div>
              <button
                className="toast-dismiss"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
              {toast.duration && toast.duration > 0 && (
                <div 
                  className="toast-progress"
                  style={{ 
                    animation: `toastProgress ${toast.duration}ms linear forwards` 
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
