'use client';

interface Props {
  name?: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  color?: string;
  onClick?: () => void;
}

const SIZES = {
  xs: { size: 24, fontSize: 10, statusSize: 6 },
  sm: { size: 32, fontSize: 12, statusSize: 8 },
  md: { size: 40, fontSize: 14, statusSize: 10 },
  lg: { size: 56, fontSize: 18, statusSize: 12 },
  xl: { size: 80, fontSize: 24, statusSize: 14 },
};

const STATUS_COLORS = {
  online: '#10b981',
  offline: '#9ca3af',
  busy: '#ef4444',
  away: '#f59e0b',
};

const COLORS = [
  'linear-gradient(135deg, #6366f1, #4f46e5)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #f43f5e, #e11d48)',
];

function getColorFromName(name?: string): string {
  if (!name) return COLORS[0];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, src, size = 'md', status, color, onClick }: Props) {
  const sizeConfig = SIZES[size];
  const bgColor = color || getColorFromName(name);

  return (
    <div 
      style={{
        position: 'relative',
        width: sizeConfig.size,
        height: sizeConfig.size,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
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
            borderRadius: 10,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          borderRadius: 10,
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: sizeConfig.fontSize,
          fontWeight: 600,
          userSelect: 'none',
        }}>
          {getInitials(name)}
        </div>
      )}
      {status && (
        <div style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: sizeConfig.statusSize,
          height: sizeConfig.statusSize,
          borderRadius: '50%',
          background: STATUS_COLORS[status],
          border: '2px solid #fff',
          boxSizing: 'content-box',
        }} />
      )}
    </div>
  );
}

export function AvatarGroup({ children, max = 4 }: { children: React.ReactNode; max?: number }) {
  const childArray = Array.isArray(children) ? children : [children];
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((child, i) => (
        <div key={i} style={{ marginLeft: i > 0 ? -8 : 0, position: 'relative', zIndex: max - i }}>
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div style={{
          marginLeft: -8,
          width: 32,
          height: 32,
          borderRadius: 10,
          background: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: '#6b7280',
          border: '2px solid #fff',
        }}>
          +{remaining}
        </div>
      )}
    </div>
  );
}
