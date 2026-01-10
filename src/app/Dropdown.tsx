'use client';
import { useState, useRef, useEffect } from 'react';

interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  danger?: boolean;
  divider?: boolean;
}

interface Props {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  align?: 'left' | 'right';
  width?: number;
}

export default function Dropdown({ trigger, items, onSelect, align = 'left', width = 200 }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <style>{`
        .dropdown-menu{position:absolute;top:100%;${align === 'right' ? 'right:0' : 'left:0'};width:${width}px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px;box-shadow:0 10px 40px rgba(0,0,0,.12);z-index:100;margin-top:8px;animation:dropdownIn .15s ease}
        @keyframes dropdownIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .dropdown-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .1s;font-size:13px;color:#374151}
        .dropdown-item:hover{background:#f3f4f6}
        .dropdown-item.danger{color:#dc2626}
        .dropdown-item.danger:hover{background:#fef2f2}
        .dropdown-icon{width:20px;text-align:center;font-size:14px}
        .dropdown-content{flex:1;min-width:0}
        .dropdown-label{font-weight:500}
        .dropdown-desc{font-size:11px;color:#9ca3af;margin-top:2px}
        .dropdown-divider{height:1px;background:#e5e7eb;margin:6px 0}
      `}</style>

      <div onClick={() => setOpen(!open)}>{trigger}</div>
      
      {open && (
        <div className="dropdown-menu">
          {items.map((item, i) => 
            item.divider ? (
              <div key={i} className="dropdown-divider" />
            ) : (
              <div 
                key={item.id}
                className={`dropdown-item ${item.danger ? 'danger' : ''}`}
                onClick={() => handleSelect(item.id)}
              >
                {item.icon && <span className="dropdown-icon">{item.icon}</span>}
                <div className="dropdown-content">
                  <div className="dropdown-label">{item.label}</div>
                  {item.description && <div className="dropdown-desc">{item.description}</div>}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
