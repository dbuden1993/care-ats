'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  onSearch: (query: string) => void;
  placeholder?: string;
  initialValue?: string;
}

const SUGGESTIONS = [
  { label: 'Drivers with DBS', query: 'driver with DBS certificate' },
  { label: 'Available immediately', query: 'can start immediately' },
  { label: 'Experienced carers', query: 'experienced care assistant' },
  { label: 'Night shift workers', query: 'night shift available' },
  { label: 'Full training', query: 'completed mandatory training' },
];

const RECENT_KEY = 'ats_recent_searches';

export default function SearchBar({ onSearch, placeholder = 'Search candidates...', initialValue = '' }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY);
    if (saved) setRecent(JSON.parse(saved).slice(0, 5));
  }, []);

  const saveRecent = (q: string) => {
    const updated = [q, ...recent.filter(r => r !== q)].slice(0, 5);
    setRecent(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const handleSearch = (q: string = query) => {
    if (!q.trim()) return;
    setLoading(true);
    saveRecent(q.trim());
    onSearch(q.trim());
    setFocused(false);
    setTimeout(() => setLoading(false), 500);
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 3) {
      debounceRef.current = setTimeout(() => {
        handleSearch(value);
      }, 500);
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = focused && query.length === 0;

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .search-container { position: relative; width: 280px; }
        .search-input-wrapper { position: relative; display: flex; align-items: center; }
        .search-input { width: 100%; padding: 9px 36px 9px 36px; font-size: 13px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; transition: all 0.15s; }
        .search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
        .search-input::placeholder { color: #9ca3af; }
        .search-icon { position: absolute; left: 12px; color: #9ca3af; font-size: 14px; pointer-events: none; }
        .search-icon.loading { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .search-clear { position: absolute; right: 8px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; color: #6b7280; }
        .search-clear:hover { background: #e5e7eb; }
        .search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 4px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); z-index: 50; overflow: hidden; }
        .search-section { padding: 8px 0; }
        .search-section:not(:last-child) { border-bottom: 1px solid #f3f4f6; }
        .search-section-title { padding: 6px 12px; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; }
        .search-item { padding: 8px 12px; font-size: 13px; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .search-item:hover { background: #f9fafb; }
        .search-item-icon { font-size: 14px; opacity: 0.6; }
        .search-kbd { margin-left: auto; padding: 2px 6px; background: #f3f4f6; border-radius: 4px; font-size: 10px; color: #6b7280; font-family: monospace; }
      `}</style>
      
      <div className="search-container">
        <div className="search-input-wrapper">
          <span className={`search-icon ${loading ? 'loading' : ''}`}>{loading ? '⟳' : '🔍'}</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            onKeyDown={handleKeyDown}
          />
          {query && <button className="search-clear" onClick={handleClear}>×</button>}
        </div>
        
        {showDropdown && (
          <div className="search-dropdown">
            {recent.length > 0 && (
              <div className="search-section">
                <div className="search-section-title">Recent</div>
                {recent.map((r, i) => (
                  <div key={i} className="search-item" onClick={() => { setQuery(r); handleSearch(r); }}>
                    <span className="search-item-icon">🕐</span>
                    {r}
                  </div>
                ))}
              </div>
            )}
            <div className="search-section">
              <div className="search-section-title">Try searching for</div>
              {SUGGESTIONS.map((s, i) => (
                <div key={i} className="search-item" onClick={() => { setQuery(s.query); handleSearch(s.query); }}>
                  <span className="search-item-icon">✨</span>
                  {s.label}
                </div>
              ))}
            </div>
            <div className="search-section">
              <div className="search-item" style={{ color: '#6b7280', fontSize: 12 }}>
                <span className="search-item-icon">💡</span>
                Use natural language to search
                <span className="search-kbd">↵</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
