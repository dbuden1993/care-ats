'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  onSearch: (query: string) => void;
  placeholder?: string;
  suggestions?: string[];
}

const RECENT_KEY = 'recent_searches';

export default function SearchBar({ onSearch, placeholder = 'Search candidates...', suggestions = [] }: Props) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(RECENT_KEY);
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
      if (value.trim() && !recentSearches.includes(value)) {
        const updated = [value, ...recentSearches].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      }
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    inputRef.current?.focus();
  };

  const selectSuggestion = (s: string) => {
    setQuery(s);
    onSearch(s);
    setShowSuggestions(false);
  };

  const allSuggestions = [...new Set([...suggestions, ...recentSearches])].filter(s => 
    s.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
      <style>{`
        .sb-input{width:100%;padding:10px 40px 10px 40px;font-size:14px;border:1px solid #e5e7eb;border-radius:10px;outline:none;transition:all .15s}
        .sb-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
        .sb-icon{position:absolute;top:50%;transform:translateY(-50%);color:#9ca3af;font-size:16px;pointer-events:none}
        .sb-clear{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:20px;height:20px;border:none;background:#e5e7eb;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;color:#6b7280}
        .sb-clear:hover{background:#d1d5db}
        .sb-dropdown{position:absolute;top:100%;left:0;right:0;margin-top:4px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 25px rgba(0,0,0,.1);z-index:50;overflow:hidden}
        .sb-item{padding:10px 14px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:10px}
        .sb-item:hover{background:#f3f4f6}
        .sb-item-icon{color:#9ca3af;font-size:14px}
      `}</style>
      
      <span className="sb-icon" style={{ left: 14 }}>🔍</span>
      
      <input
        ref={inputRef}
        type="text"
        className="sb-input"
        placeholder={placeholder}
        value={query}
        onChange={e => handleSearch(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />
      
      {query && (
        <button className="sb-clear" onClick={handleClear}>✕</button>
      )}
      
      {showSuggestions && allSuggestions.length > 0 && (
        <div className="sb-dropdown">
          {allSuggestions.map((s, i) => (
            <div key={i} className="sb-item" onClick={() => selectSuggestion(s)}>
              <span className="sb-item-icon">{recentSearches.includes(s) ? '🕐' : '🔍'}</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
