'use client';
import { useState, forwardRef } from 'react';

interface Props {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number' | 'date' | 'textarea';
  icon?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  name?: string;
}

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  icon,
  error,
  hint,
  disabled = false,
  required = false,
  rows = 3,
  name,
}, ref) => {
  const [focused, setFocused] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: icon ? '12px 12px 12px 44px' : '12px 16px',
    fontSize: 14,
    border: `1px solid ${error ? '#ef4444' : focused ? '#6366f1' : '#e5e7eb'}`,
    borderRadius: 10,
    background: disabled ? '#f9fafb' : '#fff',
    color: '#111',
    transition: 'all 0.15s',
    outline: 'none',
    boxShadow: focused && !error ? '0 0 0 3px rgba(99, 102, 241, 0.1)' : error ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : 'none',
  };

  return (
    <div style={{ marginBottom: 16 }}>
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
        {icon && (
          <span style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 16,
            color: '#9ca3af',
            pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        
        {type === 'textarea' ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            rows={rows}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type={type}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            style={inputStyle}
          />
        )}
      </div>
      
      {(error || hint) && (
        <p style={{
          marginTop: 6,
          fontSize: 12,
          color: error ? '#ef4444' : '#6b7280',
        }}>
          {error || hint}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
