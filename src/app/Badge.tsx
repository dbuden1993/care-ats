'use client';

interface Props {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
  removable?: boolean;
  onRemove?: () => void;
}

const VARIANTS = {
  default: { bg: '#f3f4f6', color: '#374151', dot: '#6b7280' },
  primary: { bg: '#eef2ff', color: '#4f46e5', dot: '#6366f1' },
  success: { bg: '#ecfdf5', color: '#059669', dot: '#10b981' },
  warning: { bg: '#fef3c7', color: '#d97706', dot: '#f59e0b' },
  danger: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  info: { bg: '#e0f2fe', color: '#0284c7', dot: '#0ea5e9' },
};

const SIZES = {
  sm: { padding: '2px 8px', fontSize: 10, dotSize: 6 },
  md: { padding: '4px 10px', fontSize: 11, dotSize: 7 },
  lg: { padding: '6px 14px', fontSize: 12, dotSize: 8 },
};

export default function Badge({ 
  children, 
  variant = 'default', 
  size = 'md', 
  dot = false,
  pulse = false,
  removable = false,
  onRemove
}: Props) {
  const v = VARIANTS[variant];
  const s = SIZES[size];

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: s.padding,
      background: v.bg,
      color: v.color,
      borderRadius: 20,
      fontSize: s.fontSize,
      fontWeight: 600,
    }}>
      {dot && (
        <span style={{
          width: s.dotSize,
          height: s.dotSize,
          borderRadius: '50%',
          background: v.dot,
          animation: pulse ? 'badgePulse 2s ease-in-out infinite' : 'none',
        }}>
          <style>{`@keyframes badgePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}`}</style>
        </span>
      )}
      {children}
      {removable && (
        <button
          onClick={e => { e.stopPropagation(); onRemove?.(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            border: 'none',
            background: 'rgba(0,0,0,.1)',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: 10,
            color: v.color,
            marginLeft: 2,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
