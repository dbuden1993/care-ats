'use client';
import AnimatedCounter from './AnimatedCounter';

interface Metric {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
  color?: string;
  icon?: string;
}

interface Props {
  metrics: Metric[];
  columns?: 2 | 3 | 4;
}

export default function MetricsGrid({ metrics, columns = 4 }: Props) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: `repeat(${columns}, 1fr)`, 
      gap: 16 
    }}>
      <style>{`
        .metric-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:18px;transition:all .15s}
        .metric-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.06)}
        .metric-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        .metric-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px}
        .metric-trend{display:flex;align-items:center;gap:3px;font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px}
        .metric-trend.up{background:#ecfdf5;color:#059669}
        .metric-trend.down{background:#fef2f2;color:#dc2626}
        .metric-trend.neutral{background:#f3f4f6;color:#6b7280}
        .metric-value{font-size:28px;font-weight:800;color:#111;margin-bottom:4px;font-variant-numeric:tabular-nums}
        .metric-label{font-size:12px;color:#6b7280;font-weight:500}
      `}</style>

      {metrics.map((m, i) => (
        <div key={i} className="metric-card">
          <div className="metric-header">
            {m.icon && (
              <div className="metric-icon" style={{ background: m.color ? `${m.color}15` : '#f3f4f6' }}>
                {m.icon}
              </div>
            )}
            {m.trend && (
              <div className={`metric-trend ${m.trend.direction}`}>
                {m.trend.direction === 'up' ? '↑' : m.trend.direction === 'down' ? '↓' : '•'}
                {m.trend.value > 0 && '+'}{m.trend.value}%
              </div>
            )}
          </div>
          <div className="metric-value" style={m.color ? { color: m.color } : {}}>
            {m.prefix}<AnimatedCounter value={m.value} />{m.suffix}
          </div>
          <div className="metric-label">{m.label}</div>
        </div>
      ))}
    </div>
  );
}
