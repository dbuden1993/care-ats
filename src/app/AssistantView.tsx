'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WhatsAppMessage {
  id: string;
  candidate_id: string;
  chat_name: string;
  phone_e164: string;
  direction: string;
  message_text: string;
  captured_at: string;
  ai_intent: string | null;
  ai_sentiment: string | null;
  ai_suggested_action: string | null;
  candidates?: { name: string; status: string; phone_e164: string };
}

interface EmailMessage {
  id: string;
  candidate_id: string | null;
  subject: string;
  from_name: string;
  from_email: string;
  body_preview: string;
  received_at: string;
  ai_summary: string | null;
  ai_intent: string | null;
  ai_suggested_action: string | null;
  candidates?: { name: string; status: string };
}

interface FollowUpCandidate {
  id: string;
  name: string;
  phone_e164: string;
  status: string;
  last_called_at: string | null;
  last_whatsapp_at?: string | null;
  days_since_contact: number;
  last_message_text?: string | null;
}

interface ReplyState {
  messageId: string;
  type: 'whatsapp' | 'email';
  candidateName: string;
  originalMessage: string;
  draftReply: string;
  phone?: string;
  loading: boolean;
}

const INTENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  interested: { label: 'Interested', color: '#059669', bg: '#d1fae5' },
  not_interested: { label: 'Not interested', color: '#dc2626', bg: '#fee2e2' },
  question: { label: 'Question', color: '#2563eb', bg: '#dbeafe' },
  availability_update: { label: 'Availability', color: '#7c3aed', bg: '#ede9fe' },
  callback_request: { label: 'Wants callback', color: '#d97706', bg: '#fef3c7' },
  document_sent: { label: 'Document sent', color: '#0891b2', bg: '#e0f2fe' },
  general: { label: 'General', color: '#6b7280', bg: '#f3f4f6' },
};

const ACTION_LABELS: Record<string, string> = {
  call_back: '📞 Call back',
  send_info: '📄 Send info',
  schedule_interview: '📅 Schedule interview',
  add_to_pool: '➕ Add to pool',
  urgent_response: '🚨 Urgent response',
  no_action: '',
};

export default function AssistantView({ onSelectCandidate }: { onSelectCandidate?: (c: any) => void }) {
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inbox' | 'followups' | 'emails'>('inbox');
  const [replyState, setReplyState] = useState<ReplyState | null>(null);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [syncingEmail, setSyncingEmail] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [pendingBackfill, setPendingBackfill] = useState(0);

  const fetchWhatsAppInbox = useCallback(async () => {
    // Widen to 7 days so messages don't vanish after 48h
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Skip media-only placeholder messages at DB level
    const MEDIA_PATTERNS = ['[Image]', '[Video]', '[Audio]', '[Document]', '[Sticker]', '[GIF]', '<Media omitted>'];

    const { data: inbound } = await supabase
      .from('whatsapp_messages')
      .select('*, candidates(name, status, phone_e164)')
      .eq('direction', 'inbound')
      .neq('ai_suggested_action', 'no_action')
      .gte('captured_at', cutoff)
      .order('captured_at', { ascending: false })
      .limit(100);

    if (!inbound?.length) { setWhatsappMessages([]); return; }

    // Filter out media-only messages
    const withText = inbound.filter(m => !MEDIA_PATTERNS.some(p => m.message_text?.trim() === p));

    // Find which chats have already been replied to (outbound sent AFTER the inbound)
    const candidateIds = [...new Set(withText.map(m => m.candidate_id).filter(Boolean))];
    const chatNames = [...new Set(withText.map(m => m.chat_name).filter(Boolean))];

    const { data: outbound } = await supabase
      .from('whatsapp_messages')
      .select('candidate_id, chat_name, captured_at')
      .eq('direction', 'outbound')
      .or(
        [
          candidateIds.length ? `candidate_id.in.(${candidateIds.join(',')})` : null,
          chatNames.length ? `chat_name.in.(${chatNames.map(n => `"${n}"`).join(',')})` : null,
        ].filter(Boolean).join(',')
      )
      .order('captured_at', { ascending: false });

    // Build map: chat key → latest outbound time
    const lastReply: Record<string, number> = {};
    for (const m of outbound || []) {
      const key = m.candidate_id || m.chat_name;
      if (!key) continue;
      const t = new Date(m.captured_at).getTime();
      if (!lastReply[key] || t > lastReply[key]) lastReply[key] = t;
    }

    // Keep only inbound messages that haven't been replied to yet
    const unreplied = withText.filter(m => {
      const key = m.candidate_id || m.chat_name;
      if (!key) return true;
      const inboundTime = new Date(m.captured_at).getTime();
      const replyTime = lastReply[key];
      return !replyTime || replyTime < inboundTime;
    });

    // Deduplicate: one card per candidate — keep the most urgent / most recent message
    const seen = new Map<string, WhatsAppMessage>();
    for (const m of unreplied) {
      const key = m.candidate_id || m.chat_name;
      if (!key) continue;
      const existing = seen.get(key);
      if (!existing) { seen.set(key, m); continue; }
      // Prefer urgent over non-urgent, otherwise keep more recent
      const mIsUrgent = m.ai_suggested_action === 'urgent_response';
      const exIsUrgent = existing.ai_suggested_action === 'urgent_response';
      if (mIsUrgent && !exIsUrgent) { seen.set(key, m); continue; }
      if (!mIsUrgent && exIsUrgent) continue;
      if (new Date(m.captured_at) > new Date(existing.captured_at)) seen.set(key, m);
    }

    // Sort: urgent first, then by most recent
    const sorted = [...seen.values()].sort((a, b) => {
      const aUrgent = a.ai_suggested_action === 'urgent_response' ? 1 : 0;
      const bUrgent = b.ai_suggested_action === 'urgent_response' ? 1 : 0;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      return new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime();
    });
    setWhatsappMessages(sorted);
  }, []);

  const fetchEmailInbox = useCallback(async () => {
    // Check if email_messages table exists
    const { data, error } = await supabase
      .from('email_messages')
      .select('*, candidates(name, status)')
      .eq('direction', 'inbound')
      .order('received_at', { ascending: false })
      .limit(30);
    if (!error) setEmailMessages(data || []);
  }, []);

  const fetchFollowUps = useCallback(async () => {
    const cutoff7days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, last_called_at')
      .in('status', ['new', 'screening', 'interview'])
      .or(`last_called_at.is.null,last_called_at.lt.${cutoff7days}`)
      .order('last_called_at', { ascending: true, nullsFirst: true })
      .limit(60);

    if (!data?.length) { setFollowUps([]); return; }

    const ids = data.map(c => c.id);

    // Get latest outbound WhatsApp time and latest inbound message text per candidate
    const [{ data: outboundMsgs }, { data: inboundMsgs }] = await Promise.all([
      supabase
        .from('whatsapp_messages')
        .select('candidate_id, captured_at')
        .in('candidate_id', ids)
        .eq('direction', 'outbound')
        .order('captured_at', { ascending: false }),
      supabase
        .from('whatsapp_messages')
        .select('candidate_id, message_text, captured_at')
        .in('candidate_id', ids)
        .eq('direction', 'inbound')
        .order('captured_at', { ascending: false }),
    ]);

    const lastWA: Record<string, number> = {};
    for (const m of outboundMsgs || []) {
      if (!m.candidate_id) continue;
      const t = new Date(m.captured_at).getTime();
      if (!lastWA[m.candidate_id] || t > lastWA[m.candidate_id]) lastWA[m.candidate_id] = t;
    }

    const lastInbound: Record<string, string> = {};
    for (const m of inboundMsgs || []) {
      if (!m.candidate_id || lastInbound[m.candidate_id]) continue;
      lastInbound[m.candidate_id] = m.message_text;
    }

    const enriched = (data || []).map((c: any) => {
      const callTime = c.last_called_at ? new Date(c.last_called_at).getTime() : 0;
      const waTime = lastWA[c.id] || 0;
      const lastContactTime = Math.max(callTime, waTime);
      const daysSince = lastContactTime
        ? Math.floor((Date.now() - lastContactTime) / (1000 * 60 * 60 * 24))
        : 999;
      return { ...c, days_since_contact: daysSince, last_message_text: lastInbound[c.id] || null };
    }).filter(c => c.days_since_contact >= 7)
      .sort((a, b) => b.days_since_contact - a.days_since_contact)
      .slice(0, 30);

    setFollowUps(enriched);
  }, []);

  const checkOutlookConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/email/status');
      if (res.ok) {
        const data = await res.json();
        setOutlookConnected(data.connected);
      }
    } catch {
      setOutlookConnected(false);
    }
  }, []);

  const fetchPendingBackfill = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-backfill');
      if (res.ok) {
        const data = await res.json();
        setPendingBackfill(data.pending ?? 0);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWhatsAppInbox(),
      fetchEmailInbox(),
      fetchFollowUps(),
      checkOutlookConnection(),
      fetchPendingBackfill(),
    ]).finally(() => setLoading(false));
  }, [fetchWhatsAppInbox, fetchEmailInbox, fetchFollowUps, checkOutlookConnection, fetchPendingBackfill]);

  function logCall(candidateId: string, note?: string) {
    // Optimistic: remove from list immediately
    setFollowUps(prev => prev.filter(c => c.id !== candidateId));
    const now = new Date().toISOString();
    supabase.from('candidates').update({ last_called_at: now }).eq('id', candidateId).then();
    if (note?.trim()) {
      supabase.from('notes').insert({
        candidate_id: candidateId,
        content: note.trim(),
        author_name: 'User',
        created_at: now,
      }).then();
    }
  }

  async function runBackfill() {
    setBackfilling(true);
    setBackfillResult(null);
    let totalAnalysed = 0;
    try {
      // Loop until all pending messages are processed — each batch is 30
      while (true) {
        const res = await fetch('/api/whatsapp-backfill', { method: 'POST' });
        const data = await res.json();
        if (!data.ok) {
          setBackfillResult('Error: ' + (data.error || 'Unknown error'));
          break;
        }
        totalAnalysed += data.analysed || 0;
        // Check how many remain
        const countRes = await fetch('/api/whatsapp-backfill');
        const countData = await countRes.json();
        const remaining = countData.pending ?? 0;
        setPendingBackfill(remaining);
        if (remaining === 0) {
          setBackfillResult(`✅ Done — ${totalAnalysed} messages analysed.`);
          break;
        }
        // Show live progress and continue
        setBackfillResult(`⏳ Analysed ${totalAnalysed} so far… ${remaining} remaining`);
        // Small pause so the UI can breathe between Vercel invocations
        await new Promise(r => setTimeout(r, 1000));
      }
      // Refresh inbox — new AI tags may surface actionable messages
      await fetchWhatsAppInbox();
    } catch (e: any) {
      setBackfillResult('Failed: ' + e.message);
    } finally {
      setBackfilling(false);
    }
  }

  function markDone(messageId: string) {
    // Optimistic: remove from UI immediately, then persist in background
    setWhatsappMessages(prev => prev.filter(m => m.id !== messageId));
    supabase
      .from('whatsapp_messages')
      .update({ ai_suggested_action: 'no_action' })
      .eq('id', messageId)
      .then();
  }

  async function generateReply(message: WhatsAppMessage) {
    setReplyState({
      messageId: message.id,
      type: 'whatsapp',
      candidateName: message.candidates?.name || message.chat_name,
      originalMessage: message.message_text,
      draftReply: '',
      phone: message.phone_e164,
      loading: true,
    });

    try {
      const res = await fetch('/api/assistant/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: message.candidates?.name || message.chat_name,
          message: message.message_text,
          intent: message.ai_intent,
          suggestedAction: message.ai_suggested_action,
          type: 'whatsapp',
        }),
      });
      const data = await res.json();
      setReplyState(prev => prev ? { ...prev, draftReply: data.reply || '', loading: false } : null);
    } catch {
      setReplyState(prev => prev ? { ...prev, draftReply: '', loading: false } : null);
    }
  }

  function sendWhatsAppReply() {
    if (!replyState || !replyState.draftReply.trim()) return;
    // Open WhatsApp Web with the message pre-filled
    const phone = replyState.phone?.replace('+', '');
    const encodedMsg = encodeURIComponent(replyState.draftReply);
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`, '_blank');
    // Mark as handled — reply was sent
    markDone(replyState.messageId);
    setReplyState(null);
  }

  async function syncOutlookEmails() {
    setSyncingEmail(true);
    try {
      await fetch('/api/email/sync', { method: 'POST' });
      await fetchEmailInbox();
    } finally {
      setSyncingEmail(false);
    }
  }

  const pendingCount = whatsappMessages.length + emailMessages.length;
  const urgentCount = whatsappMessages.filter(m => m.ai_suggested_action === 'urgent_response').length;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
        <div>Loading your assistant...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', padding: '24px 32px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36 }}>🤖</div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Recruitment Assistant</h1>
            <p style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
              {pendingCount} items need your attention
              {urgentCount > 0 && <span style={{ background: '#ef4444', borderRadius: 10, padding: '2px 8px', marginLeft: 8, fontSize: 12, fontWeight: 700 }}>🚨 {urgentCount} urgent</span>}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
          {[
            { label: 'WhatsApp replies needed', value: whatsappMessages.length, icon: '💬', color: '#d1fae5' },
            { label: 'Emails to action', value: emailMessages.length, icon: '📧', color: '#dbeafe' },
            { label: 'Overdue follow-ups', value: followUps.length, icon: '📞', color: '#fef3c7' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '14px 16px', backdropFilter: 'blur(4px)' }}>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{stat.value}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{stat.icon} {stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 32px', display: 'flex', gap: 0 }}>
        {[
          { id: 'inbox', label: `💬 WhatsApp Inbox (${whatsappMessages.length})` },
          { id: 'emails', label: `📧 Email Inbox (${emailMessages.length})` },
          { id: 'followups', label: `📞 Follow-ups (${followUps.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '14px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '24px 32px', maxWidth: 900 }}>

        {/* WhatsApp Inbox */}
        {activeTab === 'inbox' && (
          <div>
            {/* Backfill banner — shown when messages need AI analysis or while running */}
            {(pendingBackfill > 0 || backfilling) && (
              <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#92400e', flex: 1 }}>
                  <strong>{pendingBackfill}</strong> recent message{pendingBackfill !== 1 ? 's' : ''} have no AI analysis — saved while API credits were offline.
                </span>
                <button
                  onClick={runBackfill}
                  disabled={backfilling}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 7, background: backfilling ? '#d1d5db' : '#f59e0b', color: backfilling ? '#6b7280' : '#fff', cursor: backfilling ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  {backfilling ? '⏳ Analysing...' : '✨ Analyse now'}
                </button>
              </div>
            )}
            {backfillResult && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
                ✅ {backfillResult}
              </div>
            )}
            {whatsappMessages.length === 0 ? (
              <EmptyState
                icon="💬"
                title="No WhatsApp messages to action"
                subtitle="Messages from the last 7 days that need a response will appear here. Make sure the Chrome extension is installed and running."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {whatsappMessages.map(msg => (
                  <MessageCard
                    key={msg.id}
                    msg={msg}
                    onReply={() => generateReply(msg)}
                    onMarkDone={() => markDone(msg.id)}
                    onViewCandidate={() => msg.candidates && onSelectCandidate?.({ id: msg.candidate_id, ...msg.candidates })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Email Inbox */}
        {activeTab === 'emails' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Email Inbox</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {!outlookConnected ? (
                  <a
                    href="/api/email/auth"
                    style={{
                      padding: '8px 16px',
                      background: 'linear-gradient(135deg, #0078d4, #005a9e)',
                      color: 'white',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    🔗 Connect Outlook
                  </a>
                ) : (
                  <button
                    onClick={syncOutlookEmails}
                    disabled={syncingEmail}
                    style={{
                      padding: '8px 16px',
                      background: syncingEmail ? '#e5e7eb' : '#4f46e5',
                      color: syncingEmail ? '#6b7280' : 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: syncingEmail ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {syncingEmail ? '⏳ Syncing...' : '🔄 Sync Emails'}
                  </button>
                )}
              </div>
            </div>

            {!outlookConnected ? (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>Connect your Outlook inbox</h3>
                <p style={{ fontSize: 14, color: '#3b82f6', marginBottom: 16 }}>
                  Link your Microsoft 365 account to automatically read and analyse recruitment emails.
                </p>
                <a
                  href="/api/email/auth"
                  style={{
                    display: 'inline-block',
                    padding: '10px 24px',
                    background: '#0078d4',
                    color: 'white',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Connect Microsoft 365
                </a>
              </div>
            ) : emailMessages.length === 0 ? (
              <EmptyState
                icon="📧"
                title="No emails to action"
                subtitle="Click 'Sync Emails' to fetch your latest recruitment emails from Outlook."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {emailMessages.map(email => (
                  <EmailCard key={email.id} email={email} onViewCandidate={() => email.candidates && onSelectCandidate?.({ id: email.candidate_id, ...email.candidates })} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-ups */}
        {activeTab === 'followups' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Overdue Follow-ups</h2>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Candidates in active pipeline stages with no contact in 7+ days</p>
            </div>
            {followUps.length === 0 ? (
              <EmptyState icon="✅" title="All caught up!" subtitle="No candidates are overdue for a follow-up. Great work!" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {followUps.map(c => (
                  <FollowUpCard key={c.id} candidate={c} onViewCandidate={() => onSelectCandidate?.(c)} onLogCall={(note) => logCall(c.id, note)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reply Modal */}
      {replyState && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700 }}>Reply to {replyState.candidateName}</h3>
              <button onClick={() => setReplyState(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>

            <div style={{ background: '#f3f4f6', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#4b5563' }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>THEIR MESSAGE</div>
              {replyState.originalMessage}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>SUGGESTED REPLY</div>
              {replyState.loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>✨ Drafting reply with AI...</div>
              ) : (
                <textarea
                  value={replyState.draftReply}
                  onChange={e => setReplyState(prev => prev ? { ...prev, draftReply: e.target.value } : null)}
                  rows={5}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #d1d5db',
                    borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  }}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setReplyState(null)} style={{ flex: 1, padding: '10px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={sendWhatsAppReply}
                disabled={!replyState.draftReply.trim() || replyState.loading}
                style={{
                  flex: 2, padding: '10px', border: 'none', borderRadius: 8,
                  background: replyState.draftReply.trim() ? 'linear-gradient(135deg,#25d366,#128c7e)' : '#e5e7eb',
                  color: replyState.draftReply.trim() ? 'white' : '#9ca3af',
                  fontSize: 13, fontWeight: 600, cursor: replyState.draftReply.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                📱 Open in WhatsApp Web
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MessageCard({ msg, onReply, onMarkDone, onViewCandidate }: { msg: WhatsAppMessage; onReply: () => void; onMarkDone: () => void; onViewCandidate: () => void }) {
  const intent = msg.ai_intent ? INTENT_LABELS[msg.ai_intent] : null;
  const action = msg.ai_suggested_action ? ACTION_LABELS[msg.ai_suggested_action] : null;
  const timeAgo = formatTimeAgo(msg.captured_at);
  const isUrgent = msg.ai_suggested_action === 'urgent_response';
  const [expanded, setExpanded] = useState(false);
  const isLong = msg.message_text.length > 200;

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: 18,
      border: isUrgent ? '2px solid #ef4444' : '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg,#25d366,#128c7e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 18, flexShrink: 0,
        }}>💬</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
              {msg.candidates?.name || msg.chat_name}
            </span>
            {intent && (
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: intent.bg, color: intent.color }}>
                {intent.label}
              </span>
            )}
            {isUrgent && (
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>
                🚨 Urgent
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>{timeAgo}</span>
          </div>

          <div style={{ fontSize: 13, color: '#374151', marginBottom: 10, lineHeight: 1.5 }}>
            {isLong && !expanded ? msg.message_text.slice(0, 200) + '…' : msg.message_text}
            {isLong && (
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ marginLeft: 6, background: 'none', border: 'none', color: '#6366f1', fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 600 }}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {action && action.trim() && (
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>
                {action}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button
                onClick={onMarkDone}
                title="Mark as handled — removes from inbox"
                style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6b7280' }}
              >
                ✓ Done
              </button>
              {msg.candidate_id && (
                <button onClick={onViewCandidate} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151' }}>
                  View candidate
                </button>
              )}
              <button onClick={onReply} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: 'linear-gradient(135deg,#25d366,#128c7e)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                ✏️ Draft reply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmailCard({ email, onViewCandidate }: { email: EmailMessage; onViewCandidate: () => void }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#0078d4,#005a9e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, flexShrink: 0 }}>📧</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{email.candidates?.name || email.from_name}</span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>{formatTimeAgo(email.received_at)}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{email.subject}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>
            {email.ai_summary || email.body_preview?.slice(0, 200)}
          </div>
          {email.ai_suggested_action && email.ai_suggested_action !== 'no_action' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#f0fdf4', padding: '4px 10px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                {ACTION_LABELS[email.ai_suggested_action] || email.ai_suggested_action}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {email.candidate_id && (
                  <button onClick={onViewCandidate} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }}>
                    View candidate
                  </button>
                )}
                <a href="https://outlook.office.com" target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, background: '#0078d4', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                  Open in Outlook
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FollowUpCard({ candidate, onViewCandidate, onLogCall }: { candidate: FollowUpCandidate; onViewCandidate: () => void; onLogCall: (note?: string) => void }) {
  const isOverdue = candidate.days_since_contact >= 14;
  const urgency = isOverdue ? 'red' : 'orange';
  const colors = { red: ['#fee2e2', '#dc2626'], orange: ['#fef3c7', '#d97706'] };
  const [bg, fg] = colors[urgency];
  const [logging, setLogging] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const handleLogCall = async () => {
    setLogging(true);
    await onLogCall(note || undefined);
  };

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 16, border: `1px solid ${isOverdue ? '#fecaca' : '#e5e7eb'}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
          📞
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{candidate.name}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>{candidate.status}</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: bg, color: fg, fontWeight: 600 }}>
              {candidate.days_since_contact >= 999 ? 'Never contacted' : `${candidate.days_since_contact}d no contact`}
            </span>
          </div>
          {candidate.last_message_text && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontStyle: 'italic', background: '#f9fafb', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #d1d5db' }}>
              Last said: "{candidate.last_message_text.slice(0, 120)}{candidate.last_message_text.length > 120 ? '…' : ''}"
            </div>
          )}
          {/* Inline note field — shown when "Log contact" is clicked */}
          {showNote && !logging && (
            <div style={{ marginBottom: 10 }}>
              <textarea
                autoFocus
                placeholder="Call outcome / note (optional)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 8, resize: 'none', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={onViewCandidate} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151' }}>
              Profile
            </button>
            {candidate.phone_e164 && (
              <>
                <a href={`https://web.whatsapp.com/send?phone=${candidate.phone_e164.replace('+', '')}`} target="_blank" rel="noreferrer"
                  style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, background: '#25d366', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                  💬 WhatsApp
                </a>
                <a href={`tel:${candidate.phone_e164}`}
                  style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, background: '#4f46e5', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                  📞 Call
                </a>
              </>
            )}
            {!showNote && !logging && (
              <button
                onClick={() => setShowNote(true)}
                title="Log this contact and optionally add a note"
                style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#059669', fontWeight: 600 }}>
                ✓ Log contact
              </button>
            )}
            {showNote && !logging && (
              <>
                <button onClick={() => { setShowNote(false); setNote(''); }} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                  Cancel
                </button>
                <button
                  onClick={handleLogCall}
                  style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: '#059669', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                  ✓ Done
                </button>
              </>
            )}
            {logging && (
              <span style={{ padding: '6px 12px', fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Logged</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>{subtitle}</p>
    </div>
  );
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
