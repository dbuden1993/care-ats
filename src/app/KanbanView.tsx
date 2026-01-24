'use client';
import { useState } from 'react';
import { updateCandidateStatus } from './db';

interface Stage {
  id: string;
  name?: string;
  label?: string;
  color?: string;
}

interface Props {
  candidates: any[];
  stages: Stage[];
  onUpdate: () => void;
  onCandidateClick?: (candidate: any) => void;
}

export default function KanbanView({ candidates, stages, onUpdate, onCandidateClick }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const getStageLabel = (stage: Stage) => stage.label || stage.name || stage.id;

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.6';
    el.style.transform = 'rotate(2deg)';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    el.style.transform = 'none';
    setDraggedId(null);
    setDragOverStage(null);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (!draggedId) return;
    
    const candidate = candidates.find(c => c.id === draggedId);
    if (candidate && candidate.status !== stageId) {
      try {
        await updateCandidateStatus(draggedId, stageId);
        onUpdate();
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    }
    setDraggedId(null);
    setDragOverStage(null);
  };

  const getStageCount = (stageId: string) => candidates.filter(c => c.status === stageId).length;
  const getStageCandidates = (stageId: string) => candidates.filter(c => c.status === stageId);

  const getRoles = (roles: any): string => {
    if (!roles) return 'No role specified';
    if (Array.isArray(roles)) return roles[0] || 'No role specified';
    return String(roles).split(',')[0] || 'No role specified';
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const stageConfig: Record<string, { bg: string; headerBg: string; accent: string; icon: string }> = {
    new: { bg: '#fafbff', headerBg: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', accent: '#6366f1', icon: '✨' },
    screening: { bg: '#faf5ff', headerBg: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)', accent: '#8b5cf6', icon: '🔍' },
    interview: { bg: '#fffbeb', headerBg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', accent: '#f59e0b', icon: '📅' },
    offer: { bg: '#ecfdf5', headerBg: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', accent: '#10b981', icon: '📄' },
    hired: { bg: '#ecfdf5', headerBg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', accent: '#059669', icon: '🎉' },
    rejected: { bg: '#fef2f2', headerBg: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)', accent: '#ef4444', icon: '❌' },
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const styles = `
    .kanban {
      display: flex;
      gap: 20px;
      padding: 24px;
      overflow-x: auto;
      min-height: calc(100vh - 200px);
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }
    
    .kanban-col {
      width: 320px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      background: white;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-card);
      overflow: hidden;
      transition: all var(--transition-normal);
    }
    
    .kanban-col.drag-over {
      box-shadow: 0 0 0 3px var(--primary), var(--shadow-lg);
      transform: scale(1.02);
    }
    
    .kanban-header {
      padding: 16px 18px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .kanban-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .kanban-header-icon {
      font-size: 18px;
    }
    
    .kanban-header-title {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 700;
      text-transform: capitalize;
    }
    
    .kanban-header-count {
      background: rgba(255, 255, 255, 0.25);
      padding: 4px 10px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 700;
    }
    
    .kanban-body {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
      min-height: 250px;
    }
    
    .kanban-card {
      background: white;
      border: 1px solid var(--gray-100);
      border-radius: var(--radius-lg);
      padding: 16px;
      margin-bottom: 12px;
      cursor: grab;
      transition: all var(--transition-normal);
      position: relative;
    }
    
    .kanban-card:hover {
      border-color: var(--gray-200);
      box-shadow: var(--shadow-md);
      transform: translateY(-2px);
    }
    
    .kanban-card:active {
      cursor: grabbing;
    }
    
    .kanban-card.dragging {
      opacity: 0.6;
      transform: rotate(2deg);
    }
    
    .kanban-card-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .kanban-card-avatar {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .kanban-card-info {
      flex: 1;
      min-width: 0;
    }
    
    .kanban-card-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .kanban-card-role {
      font-size: 12px;
      color: var(--gray-500);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .kanban-card-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    
    .kanban-card-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--gray-100);
      border-radius: var(--radius-md);
      font-size: 11px;
      font-weight: 500;
      color: var(--gray-600);
    }
    
    .kanban-card-badge.qual-yes {
      background: var(--success-light);
      color: var(--success-dark);
    }
    
    .kanban-card-badge.energy-high {
      background: var(--success-light);
      color: var(--success-dark);
    }
    
    .kanban-card-badge.energy-mid {
      background: var(--warning-light);
      color: var(--warning-dark);
    }
    
    .kanban-card-badge.energy-low {
      background: var(--danger-light);
      color: var(--danger-dark);
    }
    
    .kanban-card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid var(--gray-100);
    }
    
    .kanban-card-time {
      font-size: 11px;
      color: var(--gray-400);
    }
    
    .kanban-card-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    .kanban-card:hover .kanban-card-actions {
      opacity: 1;
    }
    
    .kanban-card-action {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-100);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 12px;
      transition: all var(--transition-fast);
    }
    
    .kanban-card-action:hover {
      background: var(--gray-200);
    }
    
    .kanban-card-action.call:hover {
      background: var(--success-light);
    }
    
    .kanban-card-action.whatsapp:hover {
      background: #dcfce7;
    }
    
    .kanban-empty {
      text-align: center;
      padding: 48px 20px;
    }
    
    .kanban-empty-icon {
      font-size: 40px;
      margin-bottom: 12px;
      opacity: 0.3;
    }
    
    .kanban-empty-text {
      font-size: 13px;
      color: var(--gray-400);
    }
    
    .kanban-add {
      width: 100%;
      padding: 12px;
      background: var(--gray-50);
      border: 2px dashed var(--gray-200);
      border-radius: var(--radius-lg);
      font-size: 13px;
      font-weight: 500;
      color: var(--gray-500);
      cursor: pointer;
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    
    .kanban-add:hover {
      background: var(--gray-100);
      border-color: var(--gray-300);
      color: var(--gray-700);
    }
  `;

  return (
    <div className="kanban">
      <style>{styles}</style>

      {stages.map(stage => {
        const stageCandidates = getStageCandidates(stage.id);
        const config = stageConfig[stage.id] || { 
          bg: '#f9fafb', 
          headerBg: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)', 
          accent: '#64748b',
          icon: '📋'
        };
        const isDragOver = dragOverStage === stage.id;
        
        return (
          <div
            key={stage.id}
            className={`kanban-col ${isDragOver ? 'drag-over' : ''}`}
            style={{ background: config.bg }}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="kanban-header" style={{ background: config.headerBg }}>
              <div className="kanban-header-left">
                <span className="kanban-header-icon">{config.icon}</span>
                <span className="kanban-header-title">{getStageLabel(stage)}</span>
              </div>
              <span className="kanban-header-count">{getStageCount(stage.id)}</span>
            </div>
            
            <div className="kanban-body">
              {stageCandidates.length === 0 ? (
                <div className="kanban-empty">
                  <div className="kanban-empty-icon">📋</div>
                  <div className="kanban-empty-text">
                    Drop candidates here or<br/>they'll appear when added
                  </div>
                </div>
              ) : (
                stageCandidates.map(candidate => (
                  <div
                    key={candidate.id}
                    className={`kanban-card ${draggedId === candidate.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, candidate.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onCandidateClick?.(candidate)}
                  >
                    <div className="kanban-card-header">
                      <div 
                        className="kanban-card-avatar"
                        style={{ background: getAvatarColor(candidate.name) }}
                      >
                        {(candidate.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="kanban-card-info">
                        <div className="kanban-card-name">{candidate.name || 'Unknown'}</div>
                        <div className="kanban-card-role">{getRoles(candidate.roles)}</div>
                      </div>
                    </div>
                    
                    <div className="kanban-card-badges">
                      {candidate.driver === 'Yes' && (
                        <span className="kanban-card-badge qual-yes" title="Has driver's license">
                          🚗 Driver
                        </span>
                      )}
                      {candidate.dbs_update_service === 'Yes' && (
                        <span className="kanban-card-badge qual-yes" title="DBS checked">
                          🔒 DBS
                        </span>
                      )}
                      {candidate.mandatory_training === 'Yes' && (
                        <span className="kanban-card-badge qual-yes" title="Training complete">
                          📚 Trained
                        </span>
                      )}
                      {candidate.energy_ratio && (
                        <span className={`kanban-card-badge ${
                          candidate.energy_ratio >= 4 ? 'energy-high' : 
                          candidate.energy_ratio >= 3 ? 'energy-mid' : 'energy-low'
                        }`}>
                          ⚡ {candidate.energy_ratio.toFixed(1)}
                        </span>
                      )}
                    </div>
                    
                    <div className="kanban-card-footer">
                      <span className="kanban-card-time">
                        {fmtDate(candidate.updated_at || candidate.created_at)}
                      </span>
                      <div className="kanban-card-actions">
                        <button 
                          className="kanban-card-action call" 
                          title="Call"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            window.location.href = `tel:${candidate.phone_e164}`; 
                          }}
                        >
                          📞
                        </button>
                        <button 
                          className="kanban-card-action whatsapp" 
                          title="WhatsApp"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            window.open(`https://wa.me/${candidate.phone_e164?.replace(/\D/g, '')}`, '_blank'); 
                          }}
                        >
                          💬
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
