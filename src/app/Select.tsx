'use client';
import { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

interface Props {
  label?: string;
  value?: string;
  options: Option[];
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
}

export default function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select...',
  error,
  disabled = false,
  required = false,
  searchable = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);
  const filtered = searchable && search 
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleSelect = (optValue: string) => {
    onChange?.(optValue);
    setOpen(false);
    setSearch('');
  };

  return (
    <div style={{ marginBottom: 16 }} ref={ref}>
      <style>{`
        .select-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;margin-top:4px;box-shadow:0 10px 40px rgba(0,0,0,.12);z-index:100;max-height:240px;overflow-y:auto;animation:selectIn .15s ease}
        @keyframes selectIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .select-option{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .1s}
        .select-option:hover{background:#f3f4f6}
        .select-option.selected{background:#eef2ff}
        .select-option-icon{font-size:16px}
        .select-option-content{flex:1}
        .select-option-label{font-size:13px;font-weight:500;color:#111}
        .select-option-desc{font-size:11px;color:#6b7280}
        .select-check{color:#4f46e5;font-weight:700}
        .select-search{padding:10px 14px;border-bottom:1px solid #e5e7eb}
        .select-search input{width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none}
        .select-search input:focus{border-color:#6366f1}
        .select-empty{padding:20px;text-align:center;color:#9ca3af;font-size:13px}
      `}</style>

      {label && (
        <label style={{
          display: 'block',
          marginBottom: 6,
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
        }}>
          {label}
          {required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <div
          onClick={() => !disabled && setOpen(!open)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: disabled ? '#f9fafb' : '#fff',
            border: `1px solid ${error ? '#ef4444' : open ? '#6366f1' : '#e5e7eb'}`,
            borderRadius: 10,
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
            boxShadow: open ? '0 0 0 3px rgba(99, 102, 241, 0.1)' : 'none',
          }}
        >
          {selected?.icon && <span style={{ fontSize: 16 }}>{selected.icon}</span>}
          <span style={{
            flex: 1,
            fontSize: 14,
            color: selected ? '#111' : '#9ca3af',
          }}>
            {selected?.label || placeholder}
          </span>
          <span style={{ 
            fontSize: 12, 
            color: '#9ca3af',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}>
            ▼
          </span>
        </div>

        {open && (
          <div className="select-dropdown">
            {searchable && (
              <div className="select-search">
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="select-empty">No options found</div>
            ) : (
              filtered.map(option => (
                <div
                  key={option.value}
                  className={`select-option ${value === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.icon && <span className="select-option-icon">{option.icon}</span>}
                  <div className="select-option-content">
                    <div className="select-option-label">{option.label}</div>
                    {option.description && <div className="select-option-desc">{option.description}</div>}
                  </div>
                  {value === option.value && <span className="select-check">✓</span>}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {error && (
        <p style={{ marginTop: 6, fontSize: 12, color: '#ef4444' }}>{error}</p>
      )}
    </div>
  );
}
