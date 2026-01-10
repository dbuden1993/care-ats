'use client';
import { useEffect, useState } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
}

interface Props {
  shortcuts: Shortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        
        if (keyMatch && ctrlMatch && shiftMatch) {
          e.preventDefault();
          shortcut.action();
          break;
        }
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}

export function ShortcutsHelp({ shortcuts, onClose }: { shortcuts: Shortcut[]; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .shortcuts-modal { background: #fff; border-radius: 16px; width: 100%; max-width: 400px; animation: slideUp 0.2s ease; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .shortcuts-header { padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .shortcuts-title { font-size: 16px; font-weight: 600; color: #111; }
        .shortcuts-close { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; }
        .shortcuts-list { padding: 12px 20px; }
        .shortcut-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
        .shortcut-row:last-child { border-bottom: none; }
        .shortcut-desc { font-size: 13px; color: #374151; }
        .shortcut-keys { display: flex; gap: 4px; }
        .shortcut-key { padding: 4px 8px; background: #f3f4f6; border-radius: 4px; font-size: 11px; font-weight: 600; color: #374151; font-family: monospace; }
      `}</style>
      
      <div className="shortcuts-modal">
        <div className="shortcuts-header">
          <span className="shortcuts-title">⌨️ Keyboard Shortcuts</span>
          <button className="shortcuts-close" onClick={onClose}>×</button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((s, i) => (
            <div key={i} className="shortcut-row">
              <span className="shortcut-desc">{s.description}</span>
              <div className="shortcut-keys">
                {s.ctrl && <span className="shortcut-key">⌘</span>}
                {s.shift && <span className="shortcut-key">⇧</span>}
                <span className="shortcut-key">{s.key.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function KeyboardShortcutsProvider({ children, shortcuts }: { children: React.ReactNode; shortcuts: Shortcut[] }) {
  const [showHelp, setShowHelp] = useState(false);
  
  const allShortcuts = [
    ...shortcuts,
    { key: '/', description: 'Focus search', action: () => document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="Search"]')?.focus() },
    { key: '?', shift: true, description: 'Show shortcuts', action: () => setShowHelp(true) },
    { key: 'Escape', description: 'Close modal / Clear selection', action: () => {} }
  ];
  
  useKeyboardShortcuts(allShortcuts);
  
  return (
    <>
      {children}
      {showHelp && <ShortcutsHelp shortcuts={allShortcuts} onClose={() => setShowHelp(false)} />}
    </>
  );
}
