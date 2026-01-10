'use client';

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

const PADDING = {
  none: 0,
  sm: 12,
  md: 20,
  lg: 28,
};

export default function Card({ 
  children, 
  title, 
  subtitle,
  icon,
  action, 
  padding = 'md',
  hover = false,
  onClick
}: Props) {
  const p = PADDING[padding];

  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'all 0.2s',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseOver={e => {
        if (hover || onClick) {
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {(title || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `16px ${p}px`,
          borderBottom: '1px solid #f3f4f6',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
            <div>
              {title && <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{title}</h3>}
              {subtitle && <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div style={{ padding: p }}>{children}</div>
    </div>
  );
}
