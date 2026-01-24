'use client';
import { useState, useRef, useEffect } from 'react';

interface Props {
  onSearch: (query: string) => void;
  initialValue?: string;
  placeholder?: string;
}

export default function SearchBar({ onSearch, initialValue = '', placeholder = 'Search candidates...' }: Props) {
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      onSearch(newValue);
    }, 300);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
      inputRef.current?.blur();
    }
    if (e.key === 'Enter') {
      onSearch(value);
    }
  };

  const styles = `
    .search-bar {
      position: relative;
      width: 280px;
    }
    
    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: white;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-lg);
      transition: all var(--transition-fast);
    }
    
    .search-input-wrap:hover {
      border-color: var(--gray-300);
    }
    
    .search-input-wrap.focused {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px var(--primary-50);
    }
    
    .search-icon {
      font-size: 16px;
      color: var(--gray-400);
      flex-shrink: 0;
      transition: color var(--transition-fast);
    }
    
    .search-input-wrap.focused .search-icon {
      color: var(--primary);
    }
    
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
      font-family: var(--font-body);
      color: var(--gray-800);
      background: transparent;
      min-width: 0;
    }
    
    .search-input::placeholder {
      color: var(--gray-400);
    }
    
    .search-clear {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-100);
      border: none;
      border-radius: var(--radius-full);
      cursor: pointer;
      font-size: 12px;
      color: var(--gray-500);
      flex-shrink: 0;
      transition: all var(--transition-fast);
      opacity: 0;
      transform: scale(0.8);
    }
    
    .search-input-wrap.has-value .search-clear {
      opacity: 1;
      transform: scale(1);
    }
    
    .search-clear:hover {
      background: var(--gray-200);
      color: var(--gray-700);
    }
    
    .search-hint {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      padding: 8px 14px;
      background: white;
      border: 1px solid var(--gray-200);
      border-top: none;
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      font-size: 12px;
      color: var(--gray-500);
      box-shadow: var(--shadow-md);
      opacity: 0;
      visibility: hidden;
      transition: all var(--transition-fast);
    }
    
    .search-input-wrap.focused + .search-hint {
      opacity: 1;
      visibility: visible;
    }
    
    .search-hint-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
    }
    
    .search-hint-key {
      padding: 2px 6px;
      background: var(--gray-100);
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
    }
  `;

  return (
    <div className="search-bar">
      <style>{styles}</style>
      
      <div className={`search-input-wrap ${isFocused ? 'focused' : ''} ${value ? 'has-value' : ''}`}>
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          className="search-input"
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button 
          className="search-clear" 
          onClick={handleClear}
          tabIndex={-1}
          type="button"
        >
          ×
        </button>
      </div>
    </div>
  );
}
