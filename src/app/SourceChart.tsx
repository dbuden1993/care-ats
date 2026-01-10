'use client';
import AnimatedCounter from './AnimatedCounter';

interface Props {
  data: { source: string; count: number; hired: number }[];
}

const SOURCE_CONFIG: Record<string, { icon: string; color: string }> = {
  indeed: { icon: '🔵', color: '#2557a7' },
  linkedin: { icon: '💼', color: '#0077b5' },
  referral: { icon: '🤝', color: '#10b981' },
  website: { icon: '🌐', color: '#6366f1' },
  agency: { icon: '🏢', color: '#f59e0b' },
  direct: { icon: '📧', color: '#8b5cf6' },
  jobboard: { icon: '📋', color: '#ec4899' },
  other: { icon: '📌', color: '#6b7280' },
};

export default function SourceChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div>
      <style>{`
        .source-row{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f3f4f6}
        .source-row:last-child{border-bottom:none}
        .source-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
        .source-info{flex:1;min-width:0}
        .source-name{font-size:14px;font-weight:600;color:#111;text-transform:capitalize}
        .source-bar-wrap{height:6px;background:#f3f4f6;border-radius:3px;margin-top:6px;overflow:hidden}
        .source-bar{height:100%;border-radius:3px;transition:width .6s ease}
        .source-stats{text-align:right}
        .source-count{font-size:16px;font-weight:700;color:#111}
        .source-hired{font-size:11px;color:#10b981;font-weight:600}
        .source-empty{text-align:center;padding:40px;color:#9ca3af}
      `}</style>

      {sorted.length === 0 ? (
        <div className="source-empty">
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>📊</div>
          <div>No source data available</div>
        </div>
      ) : (
        sorted.map(item => {
          const config = SOURCE_CONFIG[item.source.toLowerCase()] || SOURCE_CONFIG.other;
          const widthPercent = total > 0 ? (item.count / total) * 100 : 0;
          const conversionRate = item.count > 0 ? Math.round((item.hired / item.count) * 100) : 0;

          return (
            <div key={item.source} className="source-row">
              <div className="source-icon" style={{ background: `${config.color}15` }}>
                {config.icon}
              </div>
              <div className="source-info">
                <div className="source-name">{item.source}</div>
                <div className="source-bar-wrap">
                  <div 
                    className="source-bar" 
                    style={{ width: `${widthPercent}%`, background: config.color }}
                  />
                </div>
              </div>
              <div className="source-stats">
                <div className="source-count"><AnimatedCounter value={item.count} /></div>
                <div className="source-hired">{item.hired} hired ({conversionRate}%)</div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
