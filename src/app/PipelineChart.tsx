'use client';
import { useMemo } from 'react';
import AnimatedCounter from './AnimatedCounter';

interface Props {
  data: { stage: string; count: number; color: string }[];
  onStageClick?: (stage: string) => void;
  activeStage?: string;
}

export default function PipelineChart({ data, onStageClick, activeStage }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ padding: 8 }}>
      <style>{`
        .pipeline-row{display:flex;align-items:center;gap:16px;padding:12px 0;cursor:pointer;border-radius:10px;margin:0 -8px;padding-left:8px;padding-right:8px;transition:all .15s}
        .pipeline-row:hover{background:#f9fafb}
        .pipeline-row.active{background:#eef2ff}
        .pipeline-label{width:90px;font-size:13px;font-weight:600;color:#374151;flex-shrink:0}
        .pipeline-bar-wrap{flex:1;height:36px;background:#f3f4f6;border-radius:10px;overflow:hidden;position:relative}
        .pipeline-bar{height:100%;border-radius:10px;display:flex;align-items:center;padding:0 14px;transition:width .6s cubic-bezier(.4,0,.2,1)}
        .pipeline-bar-label{font-size:13px;font-weight:700;color:#fff;white-space:nowrap}
        .pipeline-count{width:50px;text-align:right;font-size:15px;font-weight:700;color:#111;font-variant-numeric:tabular-nums}
        .pipeline-percent{width:45px;text-align:right;font-size:12px;color:#9ca3af;font-weight:500}
      `}</style>

      {data.map((item, i) => {
        const widthPercent = Math.max((item.count / maxCount) * 100, item.count > 0 ? 15 : 5);
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const isActive = activeStage === item.stage;

        return (
          <div 
            key={item.stage}
            className={`pipeline-row ${isActive ? 'active' : ''}`}
            onClick={() => onStageClick?.(item.stage)}
          >
            <span className="pipeline-label">{item.stage}</span>
            <div className="pipeline-bar-wrap">
              <div 
                className="pipeline-bar" 
                style={{ 
                  width: `${widthPercent}%`, 
                  background: `linear-gradient(90deg, ${item.color}, ${item.color}dd)` 
                }}
              >
                {item.count > 0 && widthPercent > 20 && (
                  <span className="pipeline-bar-label">{item.count}</span>
                )}
              </div>
            </div>
            <span className="pipeline-count"><AnimatedCounter value={item.count} /></span>
            <span className="pipeline-percent">{percent}%</span>
          </div>
        );
      })}

      <div style={{ 
        marginTop: 16, 
        paddingTop: 16, 
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Total in Pipeline</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#111' }}><AnimatedCounter value={total} /></span>
      </div>
    </div>
  );
}
