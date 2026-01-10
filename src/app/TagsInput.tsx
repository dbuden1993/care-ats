'use client';
import { useState, useRef } from 'react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  maxTags?: number;
}

const DEFAULT_SUGGESTIONS = [
  'urgent', 'follow-up', 'high-priority', 'silver-medalist', 
  'rehire', 'referral', 'experienced', 'entry-level',
  'night-shift', 'weekend', 'full-time', 'part-time'
];

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  urgent: { bg: '#fef2f2', text: '#dc2626' },
  'high-priority': { bg: '#fef3c7', text: '#b45309' },
  'follow-up': { bg: '#eef2ff', text: '#4f46e5' },
  'silver-medalist': { bg: '#f3e8ff', text: '#7c3aed' },
  rehire: { bg: '#ecfdf5', text: '#059669' },
  referral: { bg: '#fce7f3', text: '#be185d' },
  experienced: { bg: '#ecfdf5', text: '#059669' },
  'entry-level': { bg: '#e0f2fe', text: '#0369a1' },
  default: { bg: '#f3f4f6', text: '#374151' }
};

export default function TagsInput({ tags, onChange, suggestions = DEFAULT_SUGGESTIONS, placeholder = 'Add tag...', maxTags = 10 }: Props) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const getColor = (tag: string) => TAG_COLORS[tag.toLowerCase()] || TAG_COLORS.default;

  const addTag = (tag: string) => {
    const clean = tag.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    if (clean && !tags.includes(clean) && tags.length < maxTags) {
      onChange([...tags, clean]);
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredSuggestions = suggestions.filter(s => 
    !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .tags-container{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;min-height:42px;cursor:text;transition:border-color .15s}
        .tags-container:focus-within{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .tag-item{display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;font-size:12px;font-weight:500}
        .tag-remove{width:14px;height:14px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.1);border-radius:50%;cursor:pointer;font-size:10px;line-height:1}
        .tag-remove:hover{background:rgba(0,0,0,.2)}
        .tag-input{flex:1;min-width:100px;border:none;outline:none;font-size:13px;padding:4px}
        .tag-input::placeholder{color:#9ca3af}
        .tag-suggestions{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-top:4px;box-shadow:0 4px 12px rgba(0,0,0,.1);z-index:10;max-height:200px;overflow-y:auto}
        .tag-suggestion{padding:8px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px}
        .tag-suggestion:hover{background:#f9fafb}
        .tag-suggestion-preview{padding:2px 6px;border-radius:4px;font-size:11px;font-weight:500}
        .tag-hint{font-size:11px;color:#9ca3af;padding:8px 12px;border-top:1px solid #f3f4f6}
      `}</style>
      
      <div className="tags-container" onClick={() => inputRef.current?.focus()}>
        {tags.map(tag => {
          const color = getColor(tag);
          return (
            <span key={tag} className="tag-item" style={{ background: color.bg, color: color.text }}>
              {tag}
              <span className="tag-remove" onClick={(e) => { e.stopPropagation(); removeTag(tag); }}>×</span>
            </span>
          );
        })}
        <input
          ref={inputRef}
          className="tag-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={tags.length >= maxTags}
        />
      </div>
      
      {focused && (input || filteredSuggestions.length > 0) && (
        <div className="tag-suggestions">
          {input && !suggestions.includes(input.toLowerCase()) && (
            <div className="tag-suggestion" onClick={() => addTag(input)}>
              Create "<strong>{input}</strong>"
            </div>
          )}
          {filteredSuggestions.slice(0, 8).map(s => {
            const color = getColor(s);
            return (
              <div key={s} className="tag-suggestion" onClick={() => addTag(s)}>
                <span className="tag-suggestion-preview" style={{ background: color.bg, color: color.text }}>{s}</span>
              </div>
            );
          })}
          <div className="tag-hint">Press Enter or comma to add</div>
        </div>
      )}
    </div>
  );
}
