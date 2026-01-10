'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  candidates: any[];
  jobs: any[];
  onSelectCandidate: (candidate: any) => void;
  onSelectJob: (job: any) => void;
  onNavigate: (section: string) => void;
}

export default function GlobalSearch({ candidates, jobs, onSelectCandidate, onSelectJob, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [open]);

  // Safe string matching helper
  const matchesQuery = (value: any, searchQuery: string): boolean => {
    if (!value || !searchQuery) return false;
    const str = Array.isArray(value) ? value.join(' ') : String(value);
    return str.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const filteredCandidates = query.length >= 2 
    ? candidates.filter(c => 
        matchesQuery(c.name, query) ||
        matchesQuery(c.phone_e164, query) ||
        matchesQuery(c.roles, query) ||
        matchesQuery(c.email, query)
      ).slice(0, 5)
    : [];

  const filteredJobs = query.length >= 2
    ? jobs.filter(j => 
        matchesQuery(j.title, query) ||
        matchesQuery(j.department, query) ||
        matchesQuery(j.location, query)
      ).slice(0, 3)
    : [];

  const quickActions = [
    { icon: '➕', label: 'Add Candidate', action: () => onNavigate('add-candidate') },
    { icon: '💼', label: 'Create Job', action: () => onNavigate('add-job') },
    { icon: '📅', label: 'View Calendar', action: () => onNavigate('interviews') },
    { icon: '📊', label: 'View Reports', action: () => onNavigate('reports') },
    { icon: '👥', label: 'All Candidates', action: () => onNavigate('candidates') },
    { icon: '⚙️', label: 'Settings', action: () => onNavigate('settings') },
  ];

  // Build flat list for keyboard navigation
  const allItems: { type: string; item: any }[] = [];
  if (query.length < 2) {
    quickActions.forEach(a => allItems.push({ type: 'action', item: a }));
  } else {
    filteredCandidates.forEach(c => allItems.push({ type: 'candidate', item: c }));
    filteredJobs.forEach(j => allItems.push({ type: 'job', item: j }));
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(allItems[selectedIndex].type, allItems[selectedIndex].item);
    }
  };

  const handleSelect = (type: string, item: any) => {
    if (type === 'candidate') onSelectCandidate(item);
    else if (type === 'job') onSelectJob(item);
    else if (type === 'action') item.action();
    setOpen(false);
    setQuery('');
  };

  // Get display value for roles (handle array or string)
  const getRolesDisplay = (roles: any): string => {
    if (!roles) return '';
    if (Array.isArray(roles)) return roles.join(', ');
    return String(roles);
  };

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#f3f4f6',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 13,
          color: '#6b7280',
          transition: 'all 0.15s'
        }}
      >
        <span>🔍</span>
        <span>Search...</span>
        <span style={{ 
          padding: '2px 6px', 
          background: '#fff', 
          borderRadius: 4, 
          fontSize: 10, 
          fontWeight: 600,
          border: '1px solid #e5e7eb'
        }}>⌘K</span>
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 100,
      zIndex: 1100
    }} onClick={() => { setOpen(false); setQuery(''); }}>
      <style>{`
        .gsearch-modal{background:#fff;border-radius:16px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:gsearchIn .15s ease}
        @keyframes gsearchIn{from{opacity:0;transform:scale(.98) translateY(-10px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .gsearch-input-wrap{padding:16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:12px}
        .gsearch-icon{font-size:18px;color:#9ca3af}
        .gsearch-input{flex:1;border:none;outline:none;font-size:16px;color:#111}
        .gsearch-input::placeholder{color:#9ca3af}
        .gsearch-kbd{padding:4px 8px;background:#f3f4f6;border-radius:4px;font-size:10px;color:#6b7280;font-family:monospace}
        .gsearch-results{max-height:400px;overflow-y:auto}
        .gsearch-section{padding:8px 0}
        .gsearch-section-title{padding:8px 16px;font-size:10px;font-weight:600;color:#9ca3af;text-transform:uppercase}
        .gsearch-item{display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;transition:background .1s}
        .gsearch-item:hover,.gsearch-item.selected{background:#f3f4f6}
        .gsearch-item.selected{background:#eef2ff}
        .gsearch-item-icon{width:36px;height:36px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px}
        .gsearch-item-icon.candidate{background:#eef2ff;color:#4f46e5}
        .gsearch-item-icon.job{background:#ecfdf5;color:#059669}
        .gsearch-item-icon.action{background:#f3f4f6;color:#374151}
        .gsearch-item-info{flex:1;min-width:0}
        .gsearch-item-title{font-size:13px;font-weight:500;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gsearch-item-sub{font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .gsearch-item-badge{padding:3px 8px;background:#f3f4f6;border-radius:4px;font-size:10px;font-weight:500;color:#6b7280;text-transform:capitalize}
        .gsearch-empty{padding:32px;text-align:center;color:#9ca3af;font-size:13px}
        .gsearch-footer{padding:12px 16px;border-top:1px solid #e5e7eb;display:flex;gap:16px;font-size:11px;color:#9ca3af}
        .gsearch-footer span{display:flex;align-items:center;gap:4px}
        .gsearch-footer kbd{padding:2px 6px;background:#f3f4f6;border-radius:3px;font-family:monospace}
      `}</style>
      
      <div className="gsearch-modal" onClick={e => e.stopPropagation()}>
        <div className="gsearch-input-wrap">
          <span className="gsearch-icon">🔍</span>
          <input
            ref={inputRef}
            className="gsearch-input"
            placeholder="Search candidates, jobs, or type a command..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <span className="gsearch-kbd">ESC</span>
        </div>
        
        <div className="gsearch-results">
          {query.length < 2 && (
            <div className="gsearch-section">
              <div className="gsearch-section-title">Quick Actions</div>
              {quickActions.map((a, i) => (
                <div 
                  key={i} 
                  className={`gsearch-item ${selectedIndex === i ? 'selected' : ''}`}
                  onClick={() => handleSelect('action', a)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <div className="gsearch-item-icon action">{a.icon}</div>
                  <div className="gsearch-item-info">
                    <div className="gsearch-item-title">{a.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {filteredCandidates.length > 0 && (
            <div className="gsearch-section">
              <div className="gsearch-section-title">Candidates</div>
              {filteredCandidates.map((c, i) => {
                const idx = i;
                return (
                  <div 
                    key={c.id} 
                    className={`gsearch-item ${selectedIndex === idx ? 'selected' : ''}`}
                    onClick={() => handleSelect('candidate', c)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="gsearch-item-icon candidate">{(c.name || '?')[0].toUpperCase()}</div>
                    <div className="gsearch-item-info">
                      <div className="gsearch-item-title">{c.name || 'Unknown'}</div>
                      <div className="gsearch-item-sub">{getRolesDisplay(c.roles) || c.phone_e164 || 'No details'}</div>
                    </div>
                    <span className="gsearch-item-badge">{c.status || 'new'}</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {filteredJobs.length > 0 && (
            <div className="gsearch-section">
              <div className="gsearch-section-title">Jobs</div>
              {filteredJobs.map((j, i) => {
                const idx = filteredCandidates.length + i;
                return (
                  <div 
                    key={j.id} 
                    className={`gsearch-item ${selectedIndex === idx ? 'selected' : ''}`}
                    onClick={() => handleSelect('job', j)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="gsearch-item-icon job">💼</div>
                    <div className="gsearch-item-info">
                      <div className="gsearch-item-title">{j.title}</div>
                      <div className="gsearch-item-sub">{j.department || 'No department'} • {j.location || 'No location'}</div>
                    </div>
                    <span className="gsearch-item-badge">{j.status || 'draft'}</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {query.length >= 2 && filteredCandidates.length === 0 && filteredJobs.length === 0 && (
            <div className="gsearch-empty">
              <div style={{fontSize:32,marginBottom:8}}>🔍</div>
              No results found for "{query}"
            </div>
          )}
        </div>
        
        <div className="gsearch-footer">
          <span><kbd>↵</kbd> Select</span>
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>ESC</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
