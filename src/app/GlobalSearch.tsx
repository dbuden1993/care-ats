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
  const [isClosing, setIsClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setSelectedIndex(0);
      setIsClosing(false);
    }
  }, [open]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setQuery('');
      setIsClosing(false);
    }, 150);
  };

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
    { icon: '👤', label: 'Add Candidate', description: 'Create a new candidate profile', action: () => onNavigate('add-candidate'), color: '#6366f1' },
    { icon: '💼', label: 'Create Job', description: 'Post a new job listing', action: () => onNavigate('add-job'), color: '#f59e0b' },
    { icon: '📞', label: 'Call History', description: 'View all call recordings', action: () => onNavigate('call-history'), color: '#ec4899' },
    { icon: '📱', label: 'SMS Campaign', description: 'Start bulk SMS outreach', action: () => onNavigate('sms'), color: '#06b6d4' },
    { icon: '📊', label: 'Dashboard', description: 'View recruitment overview', action: () => onNavigate('dashboard'), color: '#10b981' },
    { icon: '📈', label: 'Reports', description: 'Analytics and insights', action: () => onNavigate('reports'), color: '#8b5cf6' },
  ];

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
    handleClose();
  };

  const getRolesDisplay = (roles: any): string => {
    if (!roles) return '';
    if (Array.isArray(roles)) return roles.join(', ');
    return String(roles);
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const styles = `
    @keyframes searchOverlayIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes searchOverlayOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes searchModalIn {
      from { opacity: 0; transform: scale(0.96) translateY(-20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    
    @keyframes searchModalOut {
      from { opacity: 1; transform: scale(1) translateY(0); }
      to { opacity: 0; transform: scale(0.96) translateY(-20px); }
    }
    
    .gs-trigger {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      cursor: pointer;
      font-size: 14px;
      color: var(--gray-500);
      transition: all var(--transition-fast);
      min-width: 220px;
    }
    
    .gs-trigger:hover {
      border-color: var(--gray-300);
      box-shadow: var(--shadow-sm);
    }
    
    .gs-trigger-icon {
      font-size: 16px;
    }
    
    .gs-trigger-text {
      flex: 1;
    }
    
    .gs-trigger-kbd {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--gray-100);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      font-family: var(--font-mono);
      color: var(--gray-500);
    }
    
    .gs-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
      z-index: 1100;
      animation: searchOverlayIn 0.15s ease-out forwards;
    }
    
    .gs-overlay.closing {
      animation: searchOverlayOut 0.15s ease-out forwards;
    }
    
    .gs-modal {
      background: white;
      border-radius: var(--radius-2xl);
      width: 100%;
      max-width: 600px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: searchModalIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }
    
    .gs-overlay.closing .gs-modal {
      animation: searchModalOut 0.15s ease-out forwards;
    }
    
    .gs-input-wrap {
      padding: 20px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      align-items: center;
      gap: 14px;
    }
    
    .gs-input-icon {
      font-size: 22px;
      color: var(--gray-400);
    }
    
    .gs-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 18px;
      font-family: var(--font-body);
      color: var(--gray-900);
      background: transparent;
    }
    
    .gs-input::placeholder {
      color: var(--gray-400);
    }
    
    .gs-input-kbd {
      padding: 6px 10px;
      background: var(--gray-100);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--gray-500);
      font-family: var(--font-mono);
    }
    
    .gs-results {
      max-height: 420px;
      overflow-y: auto;
    }
    
    .gs-section {
      padding: 8px 0;
    }
    
    .gs-section-title {
      padding: 10px 20px 8px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--gray-400);
    }
    
    .gs-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 20px;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .gs-item:hover,
    .gs-item.selected {
      background: var(--gray-50);
    }
    
    .gs-item.selected {
      background: var(--primary-50);
    }
    
    .gs-item-icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    
    .gs-item-icon.action {
      background: var(--gray-100);
    }
    
    .gs-item-icon.candidate {
      color: white;
      font-weight: 700;
    }
    
    .gs-item-icon.job {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    }
    
    .gs-item-info {
      flex: 1;
      min-width: 0;
    }
    
    .gs-item-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--gray-900);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .gs-item-sub {
      font-size: 12px;
      color: var(--gray-500);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .gs-item-badge {
      padding: 4px 10px;
      background: var(--gray-100);
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 600;
      color: var(--gray-600);
      text-transform: capitalize;
    }
    
    .gs-item-arrow {
      font-size: 14px;
      color: var(--gray-400);
      opacity: 0;
      transition: opacity var(--transition-fast);
    }
    
    .gs-item:hover .gs-item-arrow,
    .gs-item.selected .gs-item-arrow {
      opacity: 1;
    }
    
    .gs-empty {
      padding: 48px 20px;
      text-align: center;
    }
    
    .gs-empty-icon {
      font-size: 48px;
      margin-bottom: 12px;
      opacity: 0.4;
    }
    
    .gs-empty-text {
      font-size: 14px;
      color: var(--gray-500);
    }
    
    .gs-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--gray-100);
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: var(--gray-400);
      background: var(--gray-50);
    }
    
    .gs-footer-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .gs-footer-kbd {
      padding: 3px 6px;
      background: white;
      border: 1px solid var(--gray-200);
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
    }
  `;

  if (!open) {
    return (
      <>
        <style>{styles}</style>
        <button className="gs-trigger" onClick={() => setOpen(true)}>
          <span className="gs-trigger-icon">🔍</span>
          <span className="gs-trigger-text">Search...</span>
          <span className="gs-trigger-kbd">⌘K</span>
        </button>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div 
        className={`gs-overlay ${isClosing ? 'closing' : ''}`} 
        onClick={handleClose}
      >
        <div className="gs-modal" onClick={e => e.stopPropagation()}>
          <div className="gs-input-wrap">
            <span className="gs-input-icon">🔍</span>
            <input
              ref={inputRef}
              className="gs-input"
              placeholder="Search candidates, jobs, or commands..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
            />
            <span className="gs-input-kbd">ESC</span>
          </div>
          
          <div className="gs-results">
            {query.length < 2 && (
              <div className="gs-section">
                <div className="gs-section-title">Quick Actions</div>
                {quickActions.map((a, i) => (
                  <div 
                    key={i} 
                    className={`gs-item ${selectedIndex === i ? 'selected' : ''}`}
                    onClick={() => handleSelect('action', a)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div 
                      className="gs-item-icon action"
                      style={{ background: `${a.color}15`, color: a.color }}
                    >
                      {a.icon}
                    </div>
                    <div className="gs-item-info">
                      <div className="gs-item-title">{a.label}</div>
                      <div className="gs-item-sub">{a.description}</div>
                    </div>
                    <span className="gs-item-arrow">→</span>
                  </div>
                ))}
              </div>
            )}
            
            {filteredCandidates.length > 0 && (
              <div className="gs-section">
                <div className="gs-section-title">Candidates</div>
                {filteredCandidates.map((c, i) => (
                  <div 
                    key={c.id} 
                    className={`gs-item ${selectedIndex === i ? 'selected' : ''}`}
                    onClick={() => handleSelect('candidate', c)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div 
                      className="gs-item-icon candidate"
                      style={{ background: getAvatarColor(c.name) }}
                    >
                      {(c.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="gs-item-info">
                      <div className="gs-item-title">{c.name || 'Unknown'}</div>
                      <div className="gs-item-sub">
                        {getRolesDisplay(c.roles) || c.phone_e164 || 'No details'}
                      </div>
                    </div>
                    <span className="gs-item-badge">{c.status || 'new'}</span>
                    <span className="gs-item-arrow">→</span>
                  </div>
                ))}
              </div>
            )}
            
            {filteredJobs.length > 0 && (
              <div className="gs-section">
                <div className="gs-section-title">Jobs</div>
                {filteredJobs.map((j, i) => {
                  const idx = filteredCandidates.length + i;
                  return (
                    <div 
                      key={j.id} 
                      className={`gs-item ${selectedIndex === idx ? 'selected' : ''}`}
                      onClick={() => handleSelect('job', j)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <div className="gs-item-icon job">💼</div>
                      <div className="gs-item-info">
                        <div className="gs-item-title">{j.title}</div>
                        <div className="gs-item-sub">
                          {j.department || 'No department'} • {j.location || 'No location'}
                        </div>
                      </div>
                      <span className="gs-item-badge">{j.status || 'draft'}</span>
                      <span className="gs-item-arrow">→</span>
                    </div>
                  );
                })}
              </div>
            )}
            
            {query.length >= 2 && filteredCandidates.length === 0 && filteredJobs.length === 0 && (
              <div className="gs-empty">
                <div className="gs-empty-icon">🔍</div>
                <div className="gs-empty-text">No results found for "{query}"</div>
              </div>
            )}
          </div>
          
          <div className="gs-footer">
            <span className="gs-footer-item">
              <span className="gs-footer-kbd">↵</span> Select
            </span>
            <span className="gs-footer-item">
              <span className="gs-footer-kbd">↑</span>
              <span className="gs-footer-kbd">↓</span> Navigate
            </span>
            <span className="gs-footer-item">
              <span className="gs-footer-kbd">ESC</span> Close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
