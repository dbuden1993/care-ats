'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatSidebarProps {
  selectedCandidateId?: string;
  selectedCandidateName?: string;
  onSelectCandidate?: (candidate: any) => void;
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
}

const QUICK_PROMPTS = [
  'What needs my attention today?',
  "Who hasn't been contacted this week?",
  'Find me candidates for a new care package',
  'How is my pipeline looking?',
];

export default function AIChatSidebar({
  selectedCandidateId,
  selectedCandidateName,
  onSelectCandidate,
  initialPrompt,
  onInitialPromptConsumed,
}: AIChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Convert to API format (role + content only)
      const apiMessages = updatedMessages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          contextCandidateId: selectedCandidateId || undefined,
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'Something went wrong.';

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: reply, timestamp: new Date() },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Network error — please try again.', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, selectedCandidateId]);

  // Handle initial prompt (e.g. from "Ask AI about this candidate" button)
  useEffect(() => {
    if (initialPrompt) {
      setIsOpen(true);
      sendMessage(initialPrompt);
      onInitialPromptConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Render message text — detect candidate name patterns like [CANDIDATE:id:name]
  // The AI can optionally emit these, but mostly we just render plain text
  function renderMessageContent(content: string) {
    // Simple linkification for candidate IDs if the AI includes them
    // Format: any UUID-like pattern we recognise from the DB
    const lines = content.split('\n');
    return lines.map((line, i) => (
      <span key={i}>
        {line}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="AI Assistant"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: isOpen ? '364px' : '16px',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: '#6366f1',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
          transition: 'right 0.25s ease',
          color: '#fff',
        }}
      >
        {isOpen ? '›' : '🤖'}
      </button>

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '360px',
          background: '#0f172a',
          borderLeft: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px' }}>AI Assistant</div>
            {selectedCandidateName && (
              <div style={{ color: '#6366f1', fontSize: '11px', marginTop: '1px' }}>
                Context: {selectedCandidateName}
              </div>
            )}
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Clear conversation"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {messages.length === 0 && (
            <div style={{ color: '#475569', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🤖</div>
              <div style={{ marginBottom: '16px' }}>Ask me anything about your candidates, pipeline, or inbox.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      fontSize: '12px',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#273548')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#1e293b')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}
            >
              <div style={{
                background: msg.role === 'user' ? '#6366f1' : '#1e293b',
                color: '#f1f5f9',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}>
                {renderMessageContent(msg.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ alignSelf: 'flex-start' }}>
              <div style={{
                background: '#1e293b',
                borderRadius: '16px 16px 16px 4px',
                padding: '10px 16px',
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#6366f1',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '12px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Enter to send)"
            rows={1}
            style={{
              flex: 1,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '10px',
              color: '#f1f5f9',
              fontSize: '13px',
              padding: '10px 12px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: '120px',
              overflowY: 'auto',
            }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              background: '#6366f1',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !loading ? 1 : 0.4,
              padding: '10px 14px',
              fontSize: '16px',
              transition: 'opacity 0.15s',
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}
