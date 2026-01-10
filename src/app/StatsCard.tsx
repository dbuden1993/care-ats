'use client';
import AnimatedCounter from './AnimatedCounter';

interface Props {
  title: string;
  value: number;
  icon: string;
  trend?: { value: number; label: string; direction: 'up' | 'down' | 'neutral' };
  color?: 'indigo' | 'green' | 'amber' | 'rose' | 'purple' | 'cyan';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  active?: boolean;
  suffix?: string;
  prefix?: string;
}

const COLORS = {
  indigo: { bg: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', icon: '#4f46e5', accent: '#6366f1' },
  green: { bg: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', icon: '#059669', accent: '#10b981' },
  amber: { bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', icon: '#d97706', accent: '#f59e0b' },
  rose: { bg: 'linear-gradient(135deg, #fef2f2, #fecaca)', icon: '#dc2626', accent: '#ef4444' },
  purple: { bg: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', icon: '#7c3aed', accent: '#8b5cf6' },
  cyan: { bg: 'linear-gradient(135deg, #ecfeff, #cffafe)', icon: '#0891b2', accent: '#06b6d4' },
};

const SIZES = {
  sm: { padding: '14px 16px', iconSize: 40, valueSize: 24, labelSize: 11 },
  md: { padding: '18px 20px', iconSize: 48, valueSize: 32, labelSize: 12 },
  lg: { padding: '24px', iconSize: 56, valueSize: 40, labelSize: 13 },
};

export default function StatsCard({ 
  title, 
  value, 
  icon, 
  trend, 
  color = 'indigo', 
  size = 'md',
  onClick,
  active = false,
  suffix = '',
  prefix = ''
}: Props) {
  const colorConfig = COLORS[color];
  const sizeConfig = SIZES[size];

  return (
    <div 
      onClick={onClick}
      style={{
        background: '#fff',
        border: active ? `2px solid ${colorConfig.accent}` : '1px solid #e5e7eb',
        borderRadius: 16,
        padding: sizeConfig.padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseOver={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <style>{`
        .stats-card-shine{position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--accent-light));opacity:0;transition:opacity .2s}
        .stats-card:hover .stats-card-shine{opacity:1}
      `}</style>
      
      <div 
        className="stats-card-shine" 
        style={{ 
          '--accent': colorConfig.accent, 
          '--accent-light': colorConfig.icon 
        } as any} 
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
        <div style={{
          width: sizeConfig.iconSize,
          height: sizeConfig.iconSize,
          borderRadius: 12,
          background: colorConfig.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: sizeConfig.iconSize * 0.45,
        }}>
          {icon}
        </div>
        
        {trend && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: trend.direction === 'up' ? '#ecfdf5' : trend.direction === 'down' ? '#fef2f2' : '#f3f4f6',
            color: trend.direction === 'up' ? '#059669' : trend.direction === 'down' ? '#dc2626' : '#6b7280',
          }}>
            {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '•'}
            {trend.value > 0 ? '+' : ''}{trend.value} {trend.label}
          </div>
        )}
      </div>
      
      <div style={{
        fontSize: sizeConfig.valueSize,
        fontWeight: 800,
        color: active ? colorConfig.accent : '#111',
        marginBottom: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {prefix}<AnimatedCounter value={value} />{suffix}
      </div>
      
      <div style={{
        fontSize: sizeConfig.labelSize,
        color: '#6b7280',
        fontWeight: 500,
      }}>
        {title}
      </div>
    </div>
  );
}
