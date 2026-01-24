'use client';

interface Props {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  src?: string | null;
  status?: 'online' | 'offline' | 'busy' | 'away' | null;
  className?: string;
}

export default function Avatar({ name, size = 'md', src, status, className = '' }: Props) {
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
    return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
  };

  const getColor = (name: string | null | undefined): string => {
    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
      'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
    ];
    const index = (name?.charCodeAt(0) || 0) % colors.length;
    return colors[index];
  };

  const sizeConfig = {
    xs: { size: 24, fontSize: 10, statusSize: 8 },
    sm: { size: 32, fontSize: 12, statusSize: 10 },
    md: { size: 40, fontSize: 14, statusSize: 12 },
    lg: { size: 52, fontSize: 18, statusSize: 14 },
    xl: { size: 72, fontSize: 24, statusSize: 18 },
  };

  const statusColors = {
    online: '#10b981',
    offline: '#94a3b8',
    busy: '#ef4444',
    away: '#f59e0b',
  };

  const config = sizeConfig[size];

  const styles = `
    .avatar-container {
      position: relative;
      display: inline-flex;
    }
    
    .avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      color: white;
      font-weight: 700;
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-status {
      position: absolute;
      bottom: -2px;
      right: -2px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className={`avatar-container ${className}`}>
        <div 
          className="avatar"
          style={{
            width: config.size,
            height: config.size,
            fontSize: config.fontSize,
            background: src ? 'var(--gray-200)' : getColor(name),
            borderRadius: size === 'xs' || size === 'sm' ? 'var(--radius-md)' : 'var(--radius-lg)',
          }}
        >
          {src ? (
            <img src={src} alt={name || 'Avatar'} />
          ) : (
            getInitials(name)
          )}
        </div>
        {status && (
          <div 
            className="avatar-status"
            style={{
              width: config.statusSize,
              height: config.statusSize,
              background: statusColors[status],
            }}
          />
        )}
      </div>
    </>
  );
}
