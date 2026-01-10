'use client';
import { useState, useRef } from 'react';
import Button from './Button';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
}

interface Props {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // MB
  onUpload?: (files: File[]) => void;
  label?: string;
}

export default function FileUpload({ 
  accept = '*', 
  multiple = true, 
  maxSize = 10,
  onUpload,
  label = 'Upload Files'
}: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel')) return '📊';
    return '📎';
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    
    const newFiles: UploadedFile[] = Array.from(fileList).map(f => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: f.size,
      type: f.type,
      progress: 0,
      status: 'uploading' as const,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Simulate upload progress
    newFiles.forEach(file => {
      const interval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === file.id && f.progress < 100) {
            const newProgress = Math.min(f.progress + Math.random() * 30, 100);
            return { 
              ...f, 
              progress: newProgress,
              status: newProgress >= 100 ? 'complete' : 'uploading'
            };
          }
          return f;
        }));
      }, 200);

      setTimeout(() => clearInterval(interval), 2000);
    });

    onUpload?.(Array.from(fileList));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <style>{`
        .upload-zone{border:2px dashed #d1d5db;border-radius:16px;padding:32px;text-align:center;transition:all .2s;cursor:pointer;background:#fafbfc}
        .upload-zone:hover{border-color:#6366f1;background:#f8faff}
        .upload-zone.dragover{border-color:#6366f1;background:#eef2ff;transform:scale(1.01)}
        .upload-icon{font-size:40px;margin-bottom:12px;opacity:.6}
        .upload-text{font-size:14px;color:#374151;margin-bottom:4px;font-weight:500}
        .upload-hint{font-size:12px;color:#9ca3af}
        .upload-files{margin-top:16px}
        .upload-file{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px}
        .upload-file-icon{font-size:24px}
        .upload-file-info{flex:1;min-width:0}
        .upload-file-name{font-size:13px;font-weight:500;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .upload-file-size{font-size:11px;color:#6b7280}
        .upload-file-progress{height:4px;background:#e5e7eb;border-radius:2px;margin-top:6px;overflow:hidden}
        .upload-file-progress-bar{height:100%;background:#6366f1;border-radius:2px;transition:width .2s}
        .upload-file-status{font-size:18px}
        .upload-file-remove{width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;font-size:14px;color:#6b7280;transition:all .15s}
        .upload-file-remove:hover{background:#fef2f2;color:#ef4444}
      `}</style>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={e => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />

      <div
        className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon">📁</div>
        <div className="upload-text">{label}</div>
        <div className="upload-hint">
          Drag & drop or click to browse • Max {maxSize}MB per file
        </div>
      </div>

      {files.length > 0 && (
        <div className="upload-files">
          {files.map(file => (
            <div key={file.id} className="upload-file">
              <span className="upload-file-icon">{getFileIcon(file.type)}</span>
              <div className="upload-file-info">
                <div className="upload-file-name">{file.name}</div>
                <div className="upload-file-size">{formatSize(file.size)}</div>
                {file.status === 'uploading' && (
                  <div className="upload-file-progress">
                    <div className="upload-file-progress-bar" style={{ width: `${file.progress}%` }} />
                  </div>
                )}
              </div>
              {file.status === 'complete' && <span className="upload-file-status">✅</span>}
              {file.status === 'error' && <span className="upload-file-status">❌</span>}
              <button className="upload-file-remove" onClick={() => removeFile(file.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
