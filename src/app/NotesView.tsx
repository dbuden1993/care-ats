'use client';
import { useState, useEffect } from 'react';
import { getNotes, createNote, deleteNote } from './db';

interface Note { id: string; author_name: string; content: string; created_at: string; is_private: boolean; }

interface Props { candidateId: string; authorName?: string; }

export default function NotesPanel({ candidateId, authorName = 'You' }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [candidateId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const data = await getNotes(candidateId);
      setNotes(data || []);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
    setLoading(false);
  };

  const addNote = async () => {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    try {
      await createNote({ candidate_id: candidateId, author_name: authorName, content: newNote.trim(), is_private: isPrivate });
      setNewNote('');
      await loadNotes();
    } catch (err) {
      console.error('Failed to add note:', err);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNote(id);
      setNotes(notes.filter(n => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const fmt = (d: string) => {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .note-input{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;background:#f9fafb;border-radius:10px;padding:12px}
        .note-textarea{width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;resize:none;min-height:80px;font-family:inherit;transition:border-color .15s}
        .note-textarea:focus{outline:none;border-color:#6366f1}
        .note-actions{display:flex;justify-content:space-between;align-items:center}
        .note-private{display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;cursor:pointer}
        .note-private input{cursor:pointer}
        .note-btn{padding:8px 16px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s}
        .note-btn:disabled{opacity:.5;cursor:not-allowed}
        .note-btn:hover:not(:disabled){background:#4338ca}
        .note-list{display:flex;flex-direction:column;gap:12px}
        .note-item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;position:relative;transition:all .15s}
        .note-item:hover{border-color:#d1d5db}
        .note-item.private{background:#fef3c7;border-color:#fcd34d}
        .note-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .note-author{font-size:13px;font-weight:600;color:#111}
        .note-time{font-size:11px;color:#9ca3af}
        .note-content{font-size:13px;color:#374151;line-height:1.5}
        .note-mention{color:#4f46e5;font-weight:500}
        .note-badge{font-size:10px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;margin-left:8px}
        .note-delete{position:absolute;top:8px;right:8px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;opacity:0;transition:opacity .15s;font-size:12px}
        .note-item:hover .note-delete{opacity:1}
        .note-delete:hover{background:#fef2f2;color:#dc2626}
        .note-empty{text-align:center;padding:40px;color:#9ca3af;font-size:13px}
        .note-loading{text-align:center;padding:20px;color:#6b7280;font-size:13px}
      `}</style>
      
      <div className="note-input">
        <textarea 
          className="note-textarea" 
          placeholder="Add a note... Use @name to mention team members" 
          value={newNote} 
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote(); }}
        />
        <div className="note-actions">
          <label className="note-private">
            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} /> 
            Private note (only visible to you)
          </label>
          <button className="note-btn" onClick={addNote} disabled={!newNote.trim() || saving}>
            {saving ? 'Saving...' : 'Add Note'}
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="note-loading">Loading notes...</div>
      ) : (
        <div className="note-list">
          {notes.length === 0 ? (
            <div className="note-empty">No notes yet. Add one above!</div>
          ) : (
            notes.map(n => (
              <div key={n.id} className={`note-item ${n.is_private ? 'private' : ''}`}>
                <button className="note-delete" onClick={() => handleDelete(n.id)}>×</button>
                <div className="note-header">
                  <span className="note-author">
                    {n.author_name}
                    {n.is_private && <span className="note-badge">Private</span>}
                  </span>
                  <span className="note-time">{fmt(n.created_at)}</span>
                </div>
                <div 
                  className="note-content" 
                  dangerouslySetInnerHTML={{ __html: n.content.replace(/@(\w+)/g, '<span class="note-mention">@$1</span>') }} 
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
