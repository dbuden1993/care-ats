'use client';
import { useState } from 'react';
import { updateCandidateStatus } from './db';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import Tooltip from './Tooltip';

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

  // Helper to get stage label (supports both 'label' and 'name')
  const getStageLabel = (stage: Stage) => stage.label || stage.name || stage.id;
  const getStageColor = (stage: Stage) => stage.color || '#6b7280';

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Add drag ghost styling
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
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
    if (!roles) return 'No role';
    if (Array.isArray(roles)) return roles[0] || 'No role';
    return String(roles).split(',')[0] || 'No role';
  };

  const fmtDate = (d: string) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const stageColors: Record<string, { bg: string; border: string; header: string }> = {
    new: { bg: '#f8faff', border: '#c7d2fe', header: '#4f46e5' },
    screening: { bg: '#faf5ff', border: '#ddd6fe', header: '#7c3aed' },
    interview: { bg: '#fffbeb', border: '#fde68a', header: '#d97706' },
    offer: { bg: '#ecfdf5', border: '#a7f3d0', header: '#059669' },
    hired: { bg: '#ecfdf5', border: '#6ee7b7', header: '#047857' },
    rejected: { bg: '#fef2f2', border: '#fecaca', header: '#dc2626' },
  };

  return (
    <div style={{ display: 'flex', gap: 16, padding: 20, overflowX: 'auto', minHeight: 'calc(100vh - 220px)', background: '#f8fafc' }}>
      <style>{`
        .kanban-col{width:300px;flex-shrink:0;display:flex;flex-direction:column;background:#fff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;transition:all .2s}
        .kanban-col.drag-over{box-shadow:0 0 0 2px #4f46e5,0 8px 24px rgba(79,70,229,.15)}
        .kanban-header{padding:16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}
        .kanban-header-left{display:flex;align-items:center;gap:10px}
        .kanban-dot{width:10px;height:10px;border-radius:50%}
        .kanban-title{font-size:14px;font-weight:600;color:#111}
        .kanban-count{background:#f3f4f6;color:#6b7280;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
        .kanban-body{flex:1;padding:12px;overflow-y:auto;min-height:200px}
        .kanban-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:10px;cursor:grab;transition:all .15s;position:relative}
        .kanban-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);transform:translateY(-2px)}
        .kanban-card:active{cursor:grabbing}
        .kanban-card.dragging{opacity:.5}
        .kanban-card-header{display:flex;align-items:start;gap:12px;margin-bottom:10px}
        .kanban-card-info{flex:1;min-width:0}
        .kanban-card-name{font-size:14px;font-weight:600;color:#111;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .kanban-card-role{font-size:12px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .kanban-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .kanban-card-badge{display:flex;align-items:center;gap:3px;padding:3px 8px;background:#f3f4f6;border-radius:6px;font-size:10px;font-weight:500;color:#6b7280}
        .kanban-card-badge.qual{background:#ecfdf5;color:#059669}
        .kanban-card-badge.qual.no{background:#fef2f2;color:#dc2626}
        .kanban-card-time{font-size:10px;color:#9ca3af;margin-left:auto}
        .kanban-card-actions{position:absolute;top:10px;right:10px;display:flex;gap:4px;opacity:0;transition:opacity .15s}
        .kanban-card:hover .kanban-card-actions{opacity:1}
        .kanban-card-action{width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;font-size:11px;transition:all .15s}
        .kanban-card-action:hover{background:#e5e7eb}
        .kanban-empty{text-align:center;padding:40px 20px;color:#9ca3af}
        .kanban-empty-icon{font-size:32px;margin-bottom:8px;opacity:.5}
        .kanban-empty-text{font-size:12px}
        .kanban-add{width:100%;padding:10px;background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;font-size:12px;color:#6b7280;cursor:pointer;transition:all .15s;margin-top:8px}
        .kanban-add:hover{background:#f3f4f6;border-color:#9ca3af}
      `}</style>

      {stages.map(stage => {
        const stageCandidates = getStageCandidates(stage.id);
        const colors = stageColors[stage.id] || { bg: '#f9fafb', border: '#e5e7eb', header: getStageColor(stage) };
        const isDragOver = dragOverStage === stage.id;
        
        return (
          <div
            key={stage.id}
            className={`kanban-col ${isDragOver ? 'drag-over' : ''}`}
            style={{ background: colors.bg }}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            <div className="kanban-header" style={{ borderBottomColor: colors.border }}>
              <div className="kanban-header-left">
                <div className="kanban-dot" style={{ background: colors.header }} />
                <span className="kanban-title">{getStageLabel(stage)}</span>
              </div>
              <span className="kanban-count">{getStageCount(stage.id)}</span>
            </div>
            
            <div className="kanban-body">
              {stageCandidates.length === 0 ? (
                <div className="kanban-empty">
                  <div className="kanban-empty-icon">📋</div>
                  <div className="kanban-empty-text">No candidates</div>
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
                      <Avatar name={candidate.name} size="sm" />
                      <div className="kanban-card-info">
                        <div className="kanban-card-name">{candidate.name || 'Unknown'}</div>
                        <div className="kanban-card-role">{getRoles(candidate.roles)}</div>
                      </div>
                    </div>
                    
                    <div className="kanban-card-meta">
                      {candidate.driver === 'Yes' && (
                        <Tooltip content="Has driver's license">
                          <span className="kanban-card-badge qual">🚗</span>
                        </Tooltip>
                      )}
                      {candidate.dbs_update_service === 'Yes' && (
                        <Tooltip content="DBS checked">
                          <span className="kanban-card-badge qual">🔒</span>
                        </Tooltip>
                      )}
                      {candidate.mandatory_training === 'Yes' && (
                        <Tooltip content="Training completed">
                          <span className="kanban-card-badge qual">📚</span>
                        </Tooltip>
                      )}
                      {candidate.energy_ratio && (
                        <span className="kanban-card-badge" style={{ 
                          background: candidate.energy_ratio >= 4 ? '#ecfdf5' : candidate.energy_ratio >= 3 ? '#fef3c7' : '#fef2f2',
                          color: candidate.energy_ratio >= 4 ? '#059669' : candidate.energy_ratio >= 3 ? '#d97706' : '#dc2626'
                        }}>
                          ⚡ {candidate.energy_ratio.toFixed(1)}
                        </span>
                      )}
                      <span className="kanban-card-time">{fmtDate(candidate.updated_at || candidate.created_at)}</span>
                    </div>
                    
                    <div className="kanban-card-actions">
                      <Tooltip content="Call">
                        <button className="kanban-card-action" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${candidate.phone_e164}`; }}>📞</button>
                      </Tooltip>
                      <Tooltip content="WhatsApp">
                        <button className="kanban-card-action" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/${candidate.phone_e164?.replace(/\D/g, '')}`, '_blank'); }}>💬</button>
                      </Tooltip>
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
