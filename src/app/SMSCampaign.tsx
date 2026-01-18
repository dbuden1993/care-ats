'use client';
import React, { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Candidate {
  id: string;
  name: string;
  phone_e164: string;
  status: string;
  source: string;
  roles: string[];
  created_at: string;
  last_called_at: string | null;
}

interface SMSLog {
  phone: string;
  name: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
}

export default function SMSCampaign() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(
    `Hi {name}, this is Dario from Curevita Care. We have care worker positions available in your area with competitive pay. If you're interested, please reply YES or call me back on this number. Thanks!`
  );
  const [filter, setFilter] = useState({
    status: 'all',
    source: 'all',
    hasBeenCalled: 'not_called', // 'all', 'called', 'not_called'
    search: ''
  });
  
  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [smsLog, setSmsLog] = useState<SMSLog[]>([]);
  const [sendInterval, setSendInterval] = useState(30); // seconds between messages
  const sendingRef = useRef(false);
  const pausedRef = useRef(false);

  // SMS Gateway settings
  const [gatewayType, setGatewayType] = useState<'csv' | 'android' | 'manual'>('manual');
  const [androidGatewayUrl, setAndroidGatewayUrl] = useState('http://192.168.1.100:8080'); // Local IP of Android phone

  useEffect(() => {
    loadCandidates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [candidates, filter]);

  async function loadCandidates() {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('candidates')
      .select('id, name, phone_e164, status, source, roles, created_at, last_called_at')
      .not('phone_e164', 'is', null)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCandidates(data);
    }
    setLoading(false);
  }

  function applyFilters() {
    let filtered = [...candidates];

    // Status filter
    if (filter.status !== 'all') {
      filtered = filtered.filter(c => c.status === filter.status);
    }

    // Source filter  
    if (filter.source !== 'all') {
      filtered = filtered.filter(c => c.source === filter.source);
    }

    // Called filter
    if (filter.hasBeenCalled === 'called') {
      filtered = filtered.filter(c => c.last_called_at !== null);
    } else if (filter.hasBeenCalled === 'not_called') {
      filtered = filtered.filter(c => c.last_called_at === null);
    }

    // Search filter
    if (filter.search) {
      const query = filter.search.toLowerCase();
      filtered = filtered.filter(c => 
        c.name?.toLowerCase().includes(query) ||
        c.phone_e164?.includes(query)
      );
    }

    setFilteredCandidates(filtered);
  }

  function personalizeMessage(template: string, candidate: Candidate): string {
    const firstName = candidate.name?.split(' ')[0] || 'there';
    return template
      .replace(/{name}/g, firstName)
      .replace(/{full_name}/g, candidate.name || 'there')
      .replace(/{phone}/g, candidate.phone_e164 || '');
  }

  function exportCSV() {
    const rows = filteredCandidates.map(c => ({
      name: c.name,
      phone: c.phone_e164,
      message: personalizeMessage(message, c)
    }));

    const csv = [
      'Name,Phone,Message',
      ...rows.map(r => `"${r.name}","${r.phone}","${r.message.replace(/"/g, '""')}"`)
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sms_campaign_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendViaAndroidGateway(phone: string, text: string): Promise<boolean> {
    try {
      const response = await fetch(`${androidGatewayUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: text })
      });
      return response.ok;
    } catch (e) {
      console.error('Android gateway error:', e);
      return false;
    }
  }

  async function startSending() {
    if (filteredCandidates.length === 0) return;
    
    setIsSending(true);
    sendingRef.current = true;
    pausedRef.current = false;
    setSendingProgress(0);
    
    // Initialize log
    const initialLog: SMSLog[] = filteredCandidates.map(c => ({
      phone: c.phone_e164,
      name: c.name,
      status: 'pending'
    }));
    setSmsLog(initialLog);

    for (let i = 0; i < filteredCandidates.length; i++) {
      // Check if stopped or paused
      if (!sendingRef.current) break;
      
      while (pausedRef.current && sendingRef.current) {
        await sleep(1000);
      }
      
      if (!sendingRef.current) break;

      const candidate = filteredCandidates[i];
      const personalizedMsg = personalizeMessage(message, candidate);

      // Update log to show sending
      setSmsLog(prev => prev.map((log, idx) => 
        idx === i ? { ...log, status: 'pending' } : log
      ));

      let success = false;

      if (gatewayType === 'android') {
        success = await sendViaAndroidGateway(candidate.phone_e164, personalizedMsg);
      } else if (gatewayType === 'manual') {
        // For manual mode, just mark as "ready" and user copies
        success = true;
      }

      // Update log
      setSmsLog(prev => prev.map((log, idx) => 
        idx === i ? { 
          ...log, 
          status: success ? 'sent' : 'failed',
          sentAt: new Date().toISOString()
        } : log
      ));

      setSendingProgress(i + 1);

      // Wait before next message (rate limiting)
      if (i < filteredCandidates.length - 1 && sendingRef.current) {
        await sleep(sendInterval * 1000);
      }
    }

    setIsSending(false);
    sendingRef.current = false;
  }

  function pauseSending() {
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
  }

  function stopSending() {
    sendingRef.current = false;
    pausedRef.current = false;
    setIsSending(false);
    setIsPaused(false);
  }

  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get unique values for filters
  const uniqueStatuses = [...new Set(candidates.map(c => c.status).filter(Boolean))];
  const uniqueSources = [...new Set(candidates.map(c => c.source).filter(Boolean))];

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>📱</div>
        <div style={{ color: '#6b7280' }}>Loading candidates...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>
          📱 SMS Campaign
        </h1>
        <p style={{ color: '#6b7280' }}>
          Send bulk SMS to candidates using your business phone. Rate-limited to avoid blocking.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left Column - Message & Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Message Template */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
              ✉️ Message Template
            </h2>
            
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{
                width: '100%',
                height: '150px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              placeholder="Type your message here..."
            />
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginTop: '8px',
              fontSize: '13px',
              color: '#6b7280'
            }}>
              <span>Variables: {'{name}'}, {'{full_name}'}</span>
              <span style={{ color: charCount > 160 ? '#f59e0b' : '#6b7280' }}>
                {charCount} chars ({smsCount} SMS)
              </span>
            </div>

            {/* Preview */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #86efac'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>
                Preview (first candidate):
              </div>
              <div style={{ fontSize: '14px', color: '#166534' }}>
                {filteredCandidates[0] 
                  ? personalizeMessage(message, filteredCandidates[0])
                  : 'No candidates selected'}
              </div>
            </div>
          </div>

          {/* Send Settings */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
              ⚙️ Send Settings
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                Delay between messages (seconds)
              </label>
              <input
                type="number"
                value={sendInterval}
                onChange={(e) => setSendInterval(Math.max(5, parseInt(e.target.value) || 30))}
                min="5"
                max="300"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  width: '100px'
                }}
              />
              <span style={{ marginLeft: '8px', fontSize: '13px', color: '#6b7280' }}>
                (min 5 sec, recommended 30 sec)
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                Send Method
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'manual', label: '📋 Copy & Send', desc: 'Copy each message manually' },
                  { id: 'csv', label: '📄 Export CSV', desc: 'Download list for bulk send app' },
                  { id: 'android', label: '📱 Android Gateway', desc: 'Auto-send via phone app' },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setGatewayType(method.id as any)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: gatewayType === method.id ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      background: gatewayType === method.id ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{method.label}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{method.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {gatewayType === 'android' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  Android Gateway URL
                </label>
                <input
                  type="text"
                  value={androidGatewayUrl}
                  onChange={(e) => setAndroidGatewayUrl(e.target.value)}
                  placeholder="http://192.168.1.100:8080"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Install "SMS Gateway API" app on your Android phone and enter its URL here
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {gatewayType === 'csv' ? (
                <button
                  onClick={exportCSV}
                  disabled={filteredCandidates.length === 0}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#3b82f6',
                    color: 'white',
                    fontWeight: '600',
                    cursor: filteredCandidates.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: filteredCandidates.length === 0 ? 0.5 : 1
                  }}
                >
                  📄 Export CSV ({filteredCandidates.length} contacts)
                </button>
              ) : (
                <>
                  {!isSending ? (
                    <button
                      onClick={startSending}
                      disabled={filteredCandidates.length === 0}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#22c55e',
                        color: 'white',
                        fontWeight: '600',
                        cursor: filteredCandidates.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: filteredCandidates.length === 0 ? 0.5 : 1
                      }}
                    >
                      🚀 Start Sending ({filteredCandidates.length} messages)
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={pauseSending}
                        style={{
                          flex: 1,
                          padding: '12px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: isPaused ? '#22c55e' : '#f59e0b',
                          color: 'white',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {isPaused ? '▶️ Resume' : '⏸️ Pause'}
                      </button>
                      <button
                        onClick={stopSending}
                        style={{
                          padding: '12px 20px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#ef4444',
                          color: 'white',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ⏹️ Stop
                      </button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Progress */}
            {isSending && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    {isPaused ? 'Paused' : 'Sending...'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1f2937' }}>
                    {sendingProgress} / {filteredCandidates.length}
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: '#e5e7eb',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(sendingProgress / filteredCandidates.length) * 100}%`,
                    background: isPaused ? '#f59e0b' : '#22c55e',
                    transition: 'width 0.3s'
                  }} />
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  Est. time remaining: {Math.ceil((filteredCandidates.length - sendingProgress) * sendInterval / 60)} min
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Filters & Recipients */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Filters */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
              🔍 Filter Recipients
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  Status
                </label>
                <select
                  value={filter.status}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db'
                  }}
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  Source
                </label>
                <select
                  value={filter.source}
                  onChange={(e) => setFilter({ ...filter, source: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db'
                  }}
                >
                  <option value="all">All Sources</option>
                  {uniqueSources.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  Called Status
                </label>
                <select
                  value={filter.hasBeenCalled}
                  onChange={(e) => setFilter({ ...filter, hasBeenCalled: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db'
                  }}
                >
                  <option value="all">All</option>
                  <option value="not_called">Never Called</option>
                  <option value="called">Already Called</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                  Search
                </label>
                <input
                  type="text"
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  placeholder="Name or phone..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db'
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                  {filteredCandidates.length}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Recipients</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                  {candidates.length}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Candidates</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                  {Math.ceil(filteredCandidates.length * sendInterval / 60)}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Est. Minutes</div>
              </div>
            </div>
          </div>

          {/* Recipients Preview */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '12px' }}>
              👥 Recipients ({filteredCandidates.length})
            </h2>

            <div style={{ 
              flex: 1, 
              overflowY: 'auto',
              maxHeight: '400px'
            }}>
              {filteredCandidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  No candidates match your filters
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredCandidates.slice(0, 100).map((candidate, index) => {
                    const logEntry = smsLog.find(l => l.phone === candidate.phone_e164);
                    return (
                      <div
                        key={candidate.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          background: logEntry?.status === 'sent' ? '#f0fdf4' : 
                                     logEntry?.status === 'failed' ? '#fef2f2' : '#f9fafb',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '13px'
                        }}
                      >
                        <span style={{ color: '#9ca3af', width: '24px' }}>{index + 1}</span>
                        <span style={{ flex: 1, fontWeight: '500', color: '#1f2937' }}>
                          {candidate.name}
                        </span>
                        <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>
                          {candidate.phone_e164}
                        </span>
                        {logEntry && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            background: logEntry.status === 'sent' ? '#dcfce7' : 
                                       logEntry.status === 'failed' ? '#fee2e2' : '#e5e7eb',
                            color: logEntry.status === 'sent' ? '#166534' : 
                                  logEntry.status === 'failed' ? '#991b1b' : '#6b7280'
                          }}>
                            {logEntry.status === 'sent' ? '✓ Sent' : 
                             logEntry.status === 'failed' ? '✗ Failed' : '⏳'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {filteredCandidates.length > 100 && (
                    <div style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontSize: '13px' }}>
                      ... and {filteredCandidates.length - 100} more
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Send Modal - Shows one message at a time for copy/paste */}
      {isSending && gatewayType === 'manual' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              📱 Send Message {sendingProgress + 1} of {filteredCandidates.length}
            </h3>
            
            {filteredCandidates[sendingProgress] && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>To:</div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    fontFamily: 'monospace'
                  }}>
                    {filteredCandidates[sendingProgress].phone_e164}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    {filteredCandidates[sendingProgress].name}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Message:</div>
                  <div style={{
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}>
                    {personalizeMessage(message, filteredCandidates[sendingProgress])}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        personalizeMessage(message, filteredCandidates[sendingProgress])
                      );
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    📋 Copy Message
                  </button>
                  <a
                    href={`sms:${filteredCandidates[sendingProgress].phone_e164}`}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#22c55e',
                      color: 'white',
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontWeight: '500'
                    }}
                  >
                    📱 Open SMS App
                  </a>
                </div>

                <div style={{ 
                  marginTop: '16px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <button
                    onClick={stopSending}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    ✗ Stop Campaign
                  </button>
                  <button
                    onClick={() => setSendingProgress(prev => prev + 1)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#3b82f6',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Next → ({filteredCandidates.length - sendingProgress - 1} left)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
