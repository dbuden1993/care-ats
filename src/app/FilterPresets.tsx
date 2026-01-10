'use client';
import { useState, useEffect } from 'react';

interface FilterState {
  status: string;
  qualification: string;
  energy: string;
  job: string;
}

interface Preset {
  id: string;
  name: string;
  icon: string;
  filters: Partial<FilterState>;
  color?: string;
}

interface Props {
  currentFilters: FilterState;
  onApply: (filters: Partial<FilterState>) => void;
}

const DEFAULT_PRESETS: Preset[] = [
  { id: 'ready-to-hire', name: 'Ready to Hire', icon: '✅', filters: { status: 'offer', qualification: 'all', energy: 'high' }, color: '#059669' },
  { id: 'needs-follow-up', name: 'Needs Follow-up', icon: '📞', filters: { status: 'screening', energy: 'low' }, color: '#f59e0b' },
  { id: 'interview-ready', name: 'Interview Ready', icon: '📅', filters: { status: 'interview' }, color: '#6366f1' },
  { id: 'qualified-drivers', name: 'Qualified Drivers', icon: '🚗', filters: { qualification: 'driver' }, color: '#10b981' },
  { id: 'new-this-week', name: 'New This Week', icon: '✨', filters: { status: 'new' }, color: '#8b5cf6' },
];

const PRESET_KEY = 'ats_filter_presets';

export default function FilterPresets({ currentFilters, onApply }: Props) {
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveIcon, setSaveIcon] = useState('🔖');

  useEffect(() => {
    const saved = localStorage.getItem(PRESET_KEY);
    if (saved) {
      try {
        const custom = JSON.parse(saved);
        setPresets([...DEFAULT_PRESETS, ...custom]);
      } catch (e) {}
    }
  }, []);

  const isActive = (preset: Preset) => {
    return Object.entries(preset.filters).every(([key, value]) => 
      currentFilters[key as keyof FilterState] === value
    );
  };

  const hasActiveFilters = Object.values(currentFilters).some(v => v !== 'all');

  const savePreset = () => {
    if (!saveName.trim()) return;
    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name: saveName.trim(),
      icon: saveIcon,
      filters: Object.fromEntries(
        Object.entries(currentFilters).filter(([_, v]) => v !== 'all')
      ),
    };
    const customPresets = presets.filter(p => p.id.startsWith('custom-'));
    const updated = [...customPresets, newPreset];
    localStorage.setItem(PRESET_KEY, JSON.stringify(updated));
    setPresets([...DEFAULT_PRESETS, ...updated]);
    setShowSave(false);
    setSaveName('');
  };

  const deletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    const customOnly = updated.filter(p => p.id.startsWith('custom-'));
    localStorage.setItem(PRESET_KEY, JSON.stringify(customOnly));
    setPresets(updated);
  };

  const icons = ['🔖', '⭐', '🎯', '🔥', '💎', '🚀', '💼', '📊', '🎪', '🌟'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <style>{`
        .preset-btn{display:flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;font-weight:500;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;transition:all .15s;white-space:nowrap}
        .preset-btn:hover{border-color:#d1d5db;background:#f9fafb}
        .preset-btn.active{border-color:#4f46e5;background:#eef2ff;color:#4f46e5}
        .preset-btn .icon{font-size:12px}
        .preset-custom{position:relative}
        .preset-delete{position:absolute;top:-6px;right:-6px;width:16px;height:16px;background:#ef4444;color:#fff;border:none;border-radius:50%;font-size:10px;cursor:pointer;display:none;align-items:center;justify-content:center;line-height:1}
        .preset-custom:hover .preset-delete{display:flex}
        .preset-save{display:flex;align-items:center;gap:4px;padding:6px 10px;font-size:11px;color:#6b7280;border:1px dashed #d1d5db;border-radius:6px;background:none;cursor:pointer;transition:all .15s}
        .preset-save:hover{border-color:#6366f1;color:#6366f1}
        .save-modal{position:absolute;top:100%;left:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:20;width:220px;margin-top:8px}
        .save-input{width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;margin-bottom:8px}
        .save-input:focus{outline:none;border-color:#6366f1}
        .save-icons{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
        .save-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;font-size:14px;transition:all .1s}
        .save-icon:hover{border-color:#d1d5db}
        .save-icon.selected{border-color:#4f46e5;background:#eef2ff}
        .save-actions{display:flex;gap:6px}
        .save-btn{flex:1;padding:6px;font-size:11px;font-weight:500;border-radius:6px;cursor:pointer;border:none}
        .save-btn.cancel{background:#f3f4f6;color:#374151}
        .save-btn.save{background:#4f46e5;color:#fff}
      `}</style>
      
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Quick filters:</span>
      
      {presets.map(preset => (
        <div key={preset.id} className={preset.id.startsWith('custom-') ? 'preset-custom' : ''} style={{ position: 'relative' }}>
          <button 
            className={`preset-btn ${isActive(preset) ? 'active' : ''}`}
            onClick={() => onApply(preset.filters)}
            style={preset.color && isActive(preset) ? { borderColor: preset.color, color: preset.color } : {}}
          >
            <span className="icon">{preset.icon}</span>
            {preset.name}
          </button>
          {preset.id.startsWith('custom-') && (
            <button className="preset-delete" onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}>×</button>
          )}
        </div>
      ))}
      
      {hasActiveFilters && (
        <div style={{ position: 'relative' }}>
          <button className="preset-save" onClick={() => setShowSave(!showSave)}>
            + Save filter
          </button>
          {showSave && (
            <div className="save-modal" onClick={e => e.stopPropagation()}>
              <input 
                className="save-input" 
                placeholder="Filter name..." 
                value={saveName} 
                onChange={e => setSaveName(e.target.value)}
                autoFocus
              />
              <div className="save-icons">
                {icons.map(icon => (
                  <div 
                    key={icon} 
                    className={`save-icon ${saveIcon === icon ? 'selected' : ''}`}
                    onClick={() => setSaveIcon(icon)}
                  >
                    {icon}
                  </div>
                ))}
              </div>
              <div className="save-actions">
                <button className="save-btn cancel" onClick={() => setShowSave(false)}>Cancel</button>
                <button className="save-btn save" onClick={savePreset}>Save</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
