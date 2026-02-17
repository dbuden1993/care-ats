'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface ImportResult {
  success: boolean;
  contactName: string;
  candidateId: string | null;
  candidateCreated: boolean;
  total: number;
  inserted: number;
  skipped: number;
  analysed: number;
  error?: string;
}

export default function WhatsAppImportView() {
  const [myName, setMyName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Persist myName in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wa_my_name');
    if (saved) setMyName(saved);
  }, []);

  const saveMyName = (name: string) => {
    setMyName(name);
    localStorage.setItem('wa_my_name', name);
  };

  // Quick parse to count messages and show preview (client-side only)
  const analyseFile = useCallback((text: string) => {
    const MSG_REGEX = /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}:\d{2}:\d{2})\] ([^:]+): (.*)/;
    const lines = text.split('\n');
    const msgLines: string[] = [];
    for (const line of lines) {
      if (MSG_REGEX.test(line)) msgLines.push(line.slice(0, 90));
    }
    setMessageCount(msgLines.length);
    setPreviewLines(msgLines.slice(0, 5));
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.txt')) {
      setError('Please upload a .txt file exported from WhatsApp.');
      return;
    }
    setError('');
    setResult(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setFileContent(text);
      analyseFile(text);
    };
    reader.readAsText(f, 'utf-8');
  }, [analyseFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!fileContent || !myName.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/whatsapp-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatText: fileContent,
          myName: myName.trim(),
          contactPhone: contactPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Import failed');
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setFileContent('');
    setPreviewLines([]);
    setMessageCount(0);
    setResult(null);
    setError('');
    setContactPhone('');
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📲 Import WhatsApp Chat</div>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
          Export a chat from WhatsApp (Open chat → ⋮ → More → Export Chat → Without Media)
          and upload the .txt file here. All messages will be imported and AI-analysed.
          The extension will keep tracking new messages going forward.
        </p>
      </div>

      {/* Step 1 — Your name */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 6 }}>
          Your name in WhatsApp *
        </label>
        <input
          type="text"
          value={myName}
          onChange={e => saveMyName(e.target.value)}
          placeholder="e.g. Dario"
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
            borderRadius: 8, fontSize: 14, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          This tells us which messages are yours (outbound) vs the candidate's (inbound).
          Must match exactly how you appear in the chat.
        </p>
      </div>

      {/* Step 2 — Optional phone */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: '#374151', marginBottom: 6 }}>
          Contact's phone number <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
        </label>
        <input
          type="text"
          value={contactPhone}
          onChange={e => setContactPhone(e.target.value)}
          placeholder="e.g. +447911123456"
          style={{
            width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
            borderRadius: 8, fontSize: 14, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          Used to match or create the candidate record. If left blank, we'll match by name.
        </p>
      </div>

      {/* Step 3 — File upload */}
      {!file ? (
        <div
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#6366f1' : '#d1d5db'}`,
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? '#eef2ff' : '#f9fafb',
            transition: 'all 0.15s',
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Drop your WhatsApp export here
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>or click to browse — .txt files only</div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div style={{
          border: '1px solid #d1d5db', borderRadius: 12, padding: 20,
          background: '#f9fafb', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 32 }}>📄</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#111', marginBottom: 2 }}>{file.name}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                {messageCount > 0
                  ? `${messageCount.toLocaleString()} messages detected`
                  : 'Reading file…'}
              </div>

              {/* Preview */}
              {previewLines.length > 0 && (
                <div style={{
                  marginTop: 12, background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 11,
                  color: '#374151', maxHeight: 120, overflowY: 'auto',
                }}>
                  {previewLines.map((l, i) => (
                    <div key={i} style={{ marginBottom: 2, opacity: 0.8 }}>{l}</div>
                  ))}
                  {messageCount > 5 && (
                    <div style={{ color: '#9ca3af', marginTop: 4 }}>
                      … and {(messageCount - 5).toLocaleString()} more messages
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={reset}
              style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18 }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '12px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 16,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12,
          padding: 20, marginBottom: 24,
        }}>
          <div style={{ fontWeight: 700, color: '#065f46', fontSize: 16, marginBottom: 12 }}>
            ✅ Import complete!
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Contact', value: result.contactName },
              { label: 'Candidate', value: result.candidateCreated ? '✨ Created new' : '🔗 Linked existing' },
              { label: 'Messages imported', value: result.inserted.toLocaleString() },
              { label: 'Duplicates skipped', value: result.skipped.toLocaleString() },
              { label: 'Total in file', value: result.total.toLocaleString() },
              { label: 'AI-analysed', value: `${result.analysed} recent messages` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 14, color: '#111', fontWeight: 600, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
          {result.candidateId && (
            <p style={{ fontSize: 13, color: '#065f46', marginTop: 12 }}>
              You can now find this candidate in the Pipeline and chat to the AI about them.
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16, padding: '8px 20px', background: '#059669', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Import another chat
          </button>
        </div>
      )}

      {/* Import button */}
      {file && !result && (
        <button
          onClick={handleImport}
          disabled={!myName.trim() || !fileContent || loading}
          style={{
            width: '100%', padding: '14px', background: loading ? '#c7d2fe' : '#6366f1',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: loading || !myName.trim() ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading
            ? '⏳ Importing and analysing…'
            : `📥 Import ${messageCount > 0 ? messageCount.toLocaleString() + ' messages' : 'chat'}`}
        </button>
      )}

      {/* Instructions */}
      <div style={{ marginTop: 40, background: '#f8fafc', borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', marginBottom: 12 }}>
          How to export a WhatsApp chat
        </div>
        {[
          'Open WhatsApp on your phone',
          'Open the chat with the candidate',
          'Tap ⋮ (three dots) → More → Export Chat',
          'Choose "Without Media"',
          'Save or share the .txt file to your computer',
          'Upload it here',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', background: '#e0e7ff',
              color: '#4f46e5', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
