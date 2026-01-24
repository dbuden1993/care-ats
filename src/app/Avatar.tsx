'use client';
import { ReactNode } from 'react';

interface Props {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  src?: string | null;
  status?: 'online' | 'offline' | 'busy' | 'away' | null;
  color?: string;
  className?: string;
  onClick?: () => void;
}

const COLORS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
];

const SIZE_CONFIG = {
  xs: { size: 24, fontSize: 10, statusSize: 8, borderRadius: 6 },
  sm: { size: 32, fontSize: 12, statusSize: 10, borderRadius: 8 },
  md: { size: 40, fontSize: 14, statusSize: 12, borderRadius: 10 },
  lg: { size: 52, fontSize: 18, statusSize: 14, borderRadius: 12 },
  xl: { size: 72, fontSize: 24, statusSize: 18, borderRadius: 16 },
};

const STATUS_COLORS = {
  online: '#10b981',
  offline: '#94a3b8',
  busy: '#ef4444',
  away: '#f59e0b',
};

function getColorFromName(name?: string | null): string {
  if (!name) return COLORS[0];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
}

export default function Avatar({ name, size = 'md', src, status, color, className = '', onClick }: Props) {
  const config = SIZE_CONFIG[size];
  const bgColor = color || getColorFromName(name);

  return (
    <div 
      className={className}
      style={{
        position: 'relative',
        width: config.size,
        height: config.size,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        display: 'inline-flex',
      }}
      onClick={onClick}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: config.borderRadius,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: config.borderRadius,
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: config.fontSize,
          fontWeight: 700,
          userSelect: 'none',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}>
          {getInitials(name)}
        </div>
      )}
      {status && (
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: config.statusSize,
          height: config.statusSize,
          borderRadius: '50%',
          background: STATUS_COLORS[status],
          border: '2px solid #fff',
          boxSizing: 'content-box',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
        }} />
      )}
    </div>
  );
}

export function AvatarGroup({ children, max = 4 }: { children: ReactNode; max?: number }) {
  const childArray = Array.isArray(children) ? children : [children];
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((child, i) => (
        <div 
          key={i} 
          style={{ 
            marginLeft: i > 0 ? -10 : 0, 
            position: 'relative', 
            zIndex: max - i,
            borderRadius: 10,
            border: '2px solid white',
          }}
        >
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div style={{
          marginLeft: -10,
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#6b7280',
          border: '2px solid #fff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        }}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
