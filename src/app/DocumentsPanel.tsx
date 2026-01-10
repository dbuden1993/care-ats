'use client';
import { useState, useEffect, useRef } from 'react';
import { getDocuments, uploadDocument, deleteDocument } from './db';

interface Doc { id: string; name: string; type: string; size_bytes: number; uploaded_at: string; url: string; }

interface Props { candidateId: string; }

export default function DocumentsPanel({ candidateId }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeIcons: Record<string, string> = { cv: '📄', cover_letter: '✉️', id: '🪪', certificate: '📜', reference: '👤', other: '📎' };
  const typeLabels: Record<string, string> = { cv: 'CV/Resume', cover_letter: 'Cover Letter', id: 'ID Document', certificate: 'Certificate', reference: 'Reference', other: 'Other' };

  useEffect(() => { loadDocs(); }, [candidateId]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const data = await getDocuments(candidateId);
      setDocs(data || []);
    } catch (err) { console.error('Failed to load documents:', err); }
    setLoading(false);
  };

  const detectType = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('cv') || n.includes('resume')) return 'cv';
    if (n.includes('cover')) return 'cover_letter';
    if (n.includes('dbs') || n.includes('certificate') || n.includes('cert')) return 'certificate';
    if (n.includes('reference')) return 'reference';
    if (n.includes('passport') || n.includes('license') || n.includes('id')) return 'id';
    return 'other';
  };

  const handleFiles = async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await uploadDocument(candidateId, file, detectType(file.name));
      } catch (err) { console.error('Upload failed:', err); }
    }
    await loadDocs();
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await deleteDocument(id);
      setDocs(docs.filter(d => d.id !== id));
    } catch (err) { console.error('Delete failed:', err); }
  };

  const fmtSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(0)} KB` : `${(bytes/1048576).toFixed(1)} MB`;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .drop-zone{border:2px dashed #d1d5db;border-radius:12px;padding:32px;text-align:center;margin-bottom:20px;transition:all .2s;cursor:pointer}
        .drop-zone:hover,.drop-zone.over{border-color:#6366f1;background:#eef2ff}
        .drop-zone.uploading{opacity:.6;pointer-events:none}
        .drop-icon{font-size:32px;margin-bottom:8px}
        .drop-text{font-size:14px;color:#374151;margin-bottom:4px}
        .drop-hint{font-size:12px;color:#9ca3af}
        .doc-list{display:flex;flex-direction:column;gap:8px}
        .doc-item{display:flex;align-items:center;gap:12px;padding:12px;background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;transition:all .15s}
        .doc-item:hover{border-color:#d1d5db;background:#fff}
        .doc-icon{width:40px;height:40px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid #e5e7eb}
        .doc-info{flex:1;min-width:0}
        .doc-name{font-size:13px;font-weight:500;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .doc-meta{font-size:11px;color:#6b7280;display:flex;gap:8px}
        .doc-type{padding:2px 6px;background:#e5e7eb;border-radius:4px;font-size:10px;font-weight:500;color:#374151}
        .doc-actions{display:flex;gap:4px}
        .doc-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #e5e7eb;border-radius:6px;cursor:pointer;font-size:12px;transition:all .15s}
        .doc-btn:hover{border-color:#6366f1;color:#6366f1}
        .doc-btn.danger:hover{border-color:#dc2626;color:#dc2626}
        .doc-empty{text-align:center;padding:40px;color:#9ca3af;font-size:13px}
        .doc-loading{text-align:center;padding:20px;color:#6b7280}
      `}</style>
      
      <input type="file" ref={fileInputRef} multiple hidden onChange={e => e.target.files && handleFiles(e.target.files)} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
      
      <div 
        className={`drop-zone ${dragOver ? 'over' : ''} ${uploading ? 'uploading' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="drop-icon">{uploading ? '⏳' : '📁'}</div>
        <div className="drop-text">{uploading ? 'Uploading...' : 'Drag & drop files here'}</div>
        <div className="drop-hint">or click to browse • PDF, DOC, JPG up to 10MB</div>
      </div>
      
      {loading ? <div className="doc-loading">Loading documents...</div> : (
        <div className="doc-list">
          {docs.length === 0 ? <div className="doc-empty">No documents uploaded yet</div> : docs.map(d => (
            <div key={d.id} className="doc-item">
              <div className="doc-icon">{typeIcons[d.type] || '📎'}</div>
              <div className="doc-info">
                <div className="doc-name">{d.name}</div>
                <div className="doc-meta"><span>{fmtSize(d.size_bytes)}</span><span>•</span><span>{fmtDate(d.uploaded_at)}</span></div>
              </div>
              <span className="doc-type">{typeLabels[d.type] || d.type}</span>
              <div className="doc-actions">
                <a href={d.url} target="_blank" rel="noopener" className="doc-btn" title="View">👁</a>
                <a href={d.url} download className="doc-btn" title="Download">↓</a>
                <button className="doc-btn danger" title="Delete" onClick={() => handleDelete(d.id)}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
