'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { updateCandidate, updateCandidateStatus } from './db';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import Tooltip from './Tooltip';
import Badge from './Badge';
import CandidateAIInsights from './CandidateAIInsights';

interface Props {
  candidate: any;
  onClose: () => void;
  onUpdate: () => void;
  onSchedule: () => void;
  onEmail: () => void;
  onAskAboutCandidate?: (candidate: any) => void;
}

interface CallRecord {
  id: string;
  call_id?: string;
  candidate_id?: string;
  candidate_phone_e164?: string;
  phone_e164?: string;
  call_time?: string;
  direction?: string;
  duration_ms?: number;
  transcript?: string;
  recording_url?: string;
  ai_recap?: string;
  
  // AI Analysis Fields (from Zapier)
  candidate_name?: string;
  experience_summary?: string;
  call_summary?: string;
  roles?: string[];
  driver?: string;
  dbs_status?: string;
  mandatory_training?: string;
  earliest_start_date?: string;
  weekly_rota?: string;
  energy_score?: number;
  quality_assessment?: string;
  follow_up_questions?: string[];
  call_type?: string;
  extraction_confidence?: number;
  transcript_word_count?: number;
  
  // Legacy fields
  extracted_json?: any;
  created_at: string;
}

type Tab = 'overview' | 'calls' | 'messages' | 'emails' | 'notes' | 'activity';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CandidateDetailPanel({ candidate, onClose, onUpdate, onSchedule, onEmail, onAskAboutCandidate }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Call records
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  
  // Notes
  const [notes, setNotes] = useState<any[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // WhatsApp Messages
  const [whatsappMessages, setWhatsappMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);

  // Email Messages
  const [emailMessages, setEmailMessages] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Activity
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: candidate.name || '',
    phone_e164: candidate.phone_e164 || '',
    roles: Array.isArray(candidate.roles) ? candidate.roles.join(', ') : (candidate.roles || ''),
    driver: candidate.driver || 'Unknown',
    dbs_update_service: candidate.dbs_update_service || 'Unknown',
    mandatory_training: candidate.mandatory_training || 'Unknown',
    earliest_start_date: candidate.earliest_start_date || '',
    weekly_rota: candidate.weekly_rota || '',
    experience_summary: candidate.experience_summary || '',
    source: candidate.source || '',
  });

  // Fetch calls from the calls table
  useEffect(() => {
    const fetchCalls = async () => {
      setLoadingCalls(true);
      try {
        const phone = candidate.phone_e164;
        console.log('Fetching calls for phone:', phone);
        
        if (phone) {
          // Fetch from 'calls' table
          const { data: callsData, error: callsError } = await supabase
            .from('calls')
            .select('*')
            .eq('candidate_phone_e164', phone)
            .order('created_at', { ascending: false });
          
          if (callsError) {
            console.error('Error fetching from calls table:', callsError);
          }
          console.log('Calls table results:', callsData?.length || 0);
          
          // Fetch from 'call_history' table
          let historyData: any[] = [];
          try {
            const { data, error } = await supabase
              .from('call_history')
              .select('*')
              .eq('phone_e164', phone)
              .order('call_time', { ascending: false });
            
            if (!error && data) {
              historyData = data;
            }
            console.log('Call history table results:', historyData.length);
          } catch (e) {
            console.log('Call history table might not exist:', e);
          }
          
          // Combine results
          const allCalls = [...(callsData || []), ...historyData];
          console.log('Total calls found:', allCalls.length);
          
          // Deduplicate by call_id
          const seen = new Set<string>();
          const uniqueCalls = allCalls.filter(call => {
            const key = call.call_id || call.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          
          // Sort by most recent first
          uniqueCalls.sort((a, b) => {
            const dateA = new Date(a.call_time || a.created_at).getTime();
            const dateB = new Date(b.call_time || b.created_at).getTime();
            return dateB - dateA;
          });
          
          console.log('Unique calls after dedup:', uniqueCalls.length);
          setCallRecords(uniqueCalls);
          if (uniqueCalls.length > 0) {
            setExpandedCall(uniqueCalls[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching calls:', err);
      }
      setLoadingCalls(false);
    };
    fetchCalls();
  }, [candidate.phone_e164]);

  // Fetch notes
  useEffect(() => {
    const fetchNotes = async () => {
      setLoadingNotes(true);
      try {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('candidate_id', candidate.id)
          .order('created_at', { ascending: false });
        if (!error) setNotes(data || []);
      } catch (err) {
        console.error('Error fetching notes:', err);
      }
      setLoadingNotes(false);
    };
    fetchNotes();
  }, [candidate.id]);

  // Fetch WhatsApp messages
  useEffect(() => {
    const fetchWhatsAppMessages = async () => {
      setLoadingMessages(true);
      try {
        const phone = candidate.phone_e164;
        if (phone) {
          // Try both by candidate_id and by phone
          const { data: byId } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('candidate_id', candidate.id)
            .order('message_timestamp', { ascending: false });
          
          const { data: byPhone } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone_e164', phone)
            .order('message_timestamp', { ascending: false });
          
          // Combine and dedupe
          const all = [...(byId || []), ...(byPhone || [])];
          const seen = new Set<string>();
          const unique = all.filter(m => {
            if (seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });
          
          // Sort by timestamp
          unique.sort((a, b) => {
            const dateA = new Date(a.message_timestamp || a.created_at).getTime();
            const dateB = new Date(b.message_timestamp || b.created_at).getTime();
            return dateB - dateA;
          });
          
          setWhatsappMessages(unique);
        }
      } catch (err) {
        console.error('Error fetching WhatsApp messages:', err);
      }
      setLoadingMessages(false);
    };
    fetchWhatsAppMessages();
  }, [candidate.id, candidate.phone_e164]);

  // Fetch emails
  useEffect(() => {
    const fetchEmails = async () => {
      if (activeTab !== 'emails') return;
      setLoadingEmails(true);
      try {
        const { data, error } = await supabase
          .from('email_messages')
          .select('*')
          .eq('candidate_id', candidate.id)
          .order('received_at', { ascending: false })
          .limit(50);
        if (!error) setEmailMessages(data || []);
      } catch {
        // email_messages table may not exist yet
      }
      setLoadingEmails(false);
    };
    fetchEmails();
  }, [candidate.id, activeTab]);

  // Fetch activity
  useEffect(() => {
    const fetchActivity = async () => {
      if (activeTab !== 'activity') return;
      setLoadingActivity(true);
      try {
        const { data, error } = await supabase
          .from('activity_log')
          .select('*')
          .eq('candidate_id', candidate.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (!error) setActivities(data || []);
      } catch (err) {
        console.error('Error fetching activity:', err);
      }
      setLoadingActivity(false);
    };
    fetchActivity();
  }, [candidate.id, activeTab]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updateData: any = {
        name: form.name,
        phone_e164: form.phone_e164,
        driver: form.driver,
        dbs_update_service: form.dbs_update_service,
        mandatory_training: form.mandatory_training,
        weekly_rota: form.weekly_rota,
        experience_summary: form.experience_summary,
        source: form.source,
      };
      
      if (form.roles) {
        updateData.roles = form.roles.split(',').map((r: string) => r.trim()).filter(Boolean);
      }
      if (form.earliest_start_date) {
        updateData.earliest_start_date = form.earliest_start_date;
      }

      await updateCandidate(candidate.id, updateData);
      setEditing(false);
      onUpdate();
    } catch (err: any) {
      console.error('Failed to save:', err);
      setSaveError(err?.message || 'Failed to save changes');
    }
    setSaving(false);
  };

  const handleStatusChange = async (status: string) => {
    setShowStatusMenu(false);
    try {
      await updateCandidateStatus(candidate.id, status);
      onUpdate();
    } catch (err) {
      console.error('Failed to change status:', err);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const { error } = await supabase.from('notes').insert([{
        candidate_id: candidate.id,
        content: newNote,
        author_name: 'User',
        created_at: new Date().toISOString(),
      }]);
      if (!error) {
        setNewNote('');
        // Refresh notes
        const { data } = await supabase
          .from('notes')
          .select('*')
          .eq('candidate_id', candidate.id)
          .order('created_at', { ascending: false });
        setNotes(data || []);
      }
    } catch (err) {
      console.error('Error adding note:', err);
    }
    setSavingNote(false);
  };

  // Format helpers
  const fmtPhone = (p: string) => {
    if (!p) return '';
    if (p.startsWith('+44')) return `0${p.slice(3, 7)} ${p.slice(7, 10)} ${p.slice(10)}`;
    return p;
  };
  
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
  const fmtDateTime = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  
  const fmtDuration = (ms: number) => {
    if (!ms) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getRoles = (roles: any): string => {
    if (!roles) return 'No role specified';
    if (Array.isArray(roles)) return roles.join(', ');
    try {
      const parsed = JSON.parse(roles);
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch {}
    return String(roles);
  };

  // Parse extracted_json safely
  const parseExtractedJson = (json: any) => {
    if (!json) return null;
    if (typeof json === 'object') return json;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // Parse AI recap bullet points
  const parseAiRecap = (recap: string) => {
    if (!recap) return [];
    return recap.split('\n').filter(line => line.trim().startsWith('-')).map(line => line.trim().substring(1).trim());
  };

  const totalCalls = callRecords.length || candidate.total_calls_scored || 0;

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: '👤' },
    { id: 'calls', label: 'Calls', icon: '📞', badge: totalCalls },
    { id: 'messages', label: 'WhatsApp', icon: '💬', badge: whatsappMessages.length },
    { id: 'emails', label: 'Emails', icon: '📧', badge: emailMessages.length || undefined },
    { id: 'notes', label: 'Notes', icon: '📝', badge: notes.length },
    { id: 'activity', label: 'Activity', icon: '📊' },
  ];

  const quickActions = [
    { icon: '📞', label: 'Call', action: () => candidate.phone_e164 && (window.location.href = `tel:${candidate.phone_e164}`), color: '#10b981' },
    { icon: '💬', label: 'WhatsApp', action: () => candidate.phone_e164 && window.open(`https://wa.me/${candidate.phone_e164.replace(/\D/g, '')}`, '_blank'), color: '#25d366' },
    { icon: '✉️', label: 'Email', action: onEmail, color: '#6366f1' },
    { icon: '📅', label: 'Schedule', action: onSchedule, color: '#f59e0b' },
    { icon: '🤖', label: 'Ask AI', action: () => onAskAboutCandidate?.(candidate), color: '#8b5cf6' },
  ];

  const qualifications = [
    { key: 'driver', icon: '🚗', label: 'Driver', value: candidate.driver },
    { key: 'dbs_update_service', icon: '🔒', label: 'DBS Check', value: candidate.dbs_update_service },
    { key: 'mandatory_training', icon: '📚', label: 'Training', value: candidate.mandatory_training },
  ];

  const statuses = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

  // Close status menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowStatusMenu(false);
    if (showStatusMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStatusMenu]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'flex-end', zIndex: 1000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{`
        .cdp{width:100%;max-width:720px;background:#fff;height:100%;display:flex;flex-direction:column;animation:cdpSlide .25s cubic-bezier(.4,0,.2,1);box-shadow:-8px 0 30px rgba(0,0,0,.15)}
        @keyframes cdpSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
        .cdp-header{padding:24px;background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-bottom:1px solid #e5e7eb}
        .cdp-header-top{display:flex;align-items:start;justify-content:space-between;margin-bottom:16px}
        .cdp-close{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;font-size:16px;transition:all .15s;color:#6b7280}
        .cdp-close:hover{background:#f3f4f6;color:#111}
        .cdp-profile{display:flex;align-items:center;gap:16px}
        .cdp-info h2{font-size:20px;font-weight:700;color:#111;margin:0 0 4px}
        .cdp-info p{font-size:13px;color:#6b7280;margin:0}
        .cdp-status-wrap{position:relative;margin-top:12px}
        .cdp-status-btn{display:flex;align-items:center;gap:8px;padding:0;background:none;border:none;cursor:pointer}
        .cdp-status-menu{position:absolute;top:100%;left:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:6px;box-shadow:0 10px 40px rgba(0,0,0,.15);z-index:10;min-width:160px;margin-top:8px}
        .cdp-status-opt{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:8px;cursor:pointer;font-size:13px;color:#374151;transition:background .1s}
        .cdp-status-opt:hover{background:#f3f4f6}
        .cdp-status-opt.active{background:#eef2ff;color:#4f46e5;font-weight:500}
        .cdp-actions{display:flex;gap:8px;margin-top:20px}
        .cdp-action{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;cursor:pointer;transition:all .15s}
        .cdp-action:hover{border-color:#d1d5db;box-shadow:0 2px 8px rgba(0,0,0,.06)}
        .cdp-action-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px}
        .cdp-action-label{font-size:11px;font-weight:500;color:#374151}
        .cdp-tabs{display:flex;gap:4px;padding:0 20px;background:#fff;border-bottom:1px solid #e5e7eb}
        .cdp-tab{padding:14px 16px;font-size:13px;font-weight:500;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;display:flex;align-items:center;gap:6px;transition:all .15s}
        .cdp-tab:hover{color:#111}
        .cdp-tab.active{color:#4f46e5;border-bottom-color:#4f46e5}
        .cdp-tab-badge{background:#e5e7eb;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:700}
        .cdp-tab.active .cdp-tab-badge{background:#c7d2fe;color:#4f46e5}
        .cdp-content{flex:1;overflow-y:auto;background:#f8fafc}
        .cdp-section{padding:20px;background:#fff;margin:16px;border-radius:12px;border:1px solid #e5e7eb}
        .cdp-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .cdp-section-title{font-size:14px;font-weight:600;color:#111;display:flex;align-items:center;gap:8px}
        .cdp-edit-btn{font-size:12px;color:#6366f1;cursor:pointer;background:none;border:none;font-weight:500}
        .cdp-edit-btn:hover{text-decoration:underline}
        .cdp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cdp-field{background:#f9fafb;border-radius:10px;padding:14px}
        .cdp-field.full{grid-column:span 2}
        .cdp-field-label{font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:500;text-transform:uppercase;letter-spacing:.3px}
        .cdp-field-value{font-size:14px;color:#111;font-weight:500;line-height:1.5}
        .cdp-field-value.muted{color:#9ca3af;font-weight:400;font-style:italic}
        .cdp-input{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px}
        .cdp-input:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .cdp-textarea{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;min-height:100px;resize:vertical;font-family:inherit;line-height:1.6}
        .cdp-textarea:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .cdp-select{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;background:#fff}
        .cdp-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
        .cdp-btn{padding:10px 20px;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;border:none;transition:all .15s}
        .cdp-btn.cancel{background:#f3f4f6;color:#374151}
        .cdp-btn.cancel:hover{background:#e5e7eb}
        .cdp-btn.save{background:#4f46e5;color:#fff}
        .cdp-btn.save:hover{background:#4338ca}
        .cdp-btn.save:disabled{opacity:.5;cursor:not-allowed}
        .cdp-error{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:16px;font-size:13px}
        .cdp-qual-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .cdp-qual{background:#f9fafb;border-radius:12px;padding:16px;text-align:center;border:2px solid transparent}
        .cdp-qual.yes{background:#ecfdf5;border-color:#a7f3d0}
        .cdp-qual.no{background:#fef2f2;border-color:#fecaca}
        .cdp-qual.pending{background:#fef3c7;border-color:#fcd34d}
        .cdp-qual-icon{font-size:24px;margin-bottom:8px}
        .cdp-qual-label{font-size:11px;color:#6b7280;margin-bottom:4px}
        .cdp-qual-value{font-size:14px;font-weight:600;color:#111}
        .cdp-qual.yes .cdp-qual-value{color:#059669}
        .cdp-qual.no .cdp-qual-value{color:#dc2626}
        .cdp-qual.pending .cdp-qual-value{color:#d97706}
        .cdp-energy{background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:1px solid #bbf7d0;border-radius:12px;padding:20px}
        .cdp-energy.low{background:linear-gradient(135deg,#fef2f2,#fee2e2);border-color:#fecaca}
        .cdp-energy.medium{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fcd34d}
        .cdp-energy-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .cdp-energy-title{font-size:14px;font-weight:600;color:#111}
        .cdp-energy-score{font-size:32px;font-weight:800}
        .cdp-energy-bar{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden}
        .cdp-energy-fill{height:100%;border-radius:5px;transition:width .5s ease}
        .cdp-energy-stats{display:flex;gap:20px;margin-top:12px;font-size:12px;color:#6b7280}
        .cdp-ai-box{background:linear-gradient(135deg,#eef2ff,#e0e7ff);border:1px solid #c7d2fe;border-radius:12px;padding:20px}
        .cdp-ai-title{font-size:12px;font-weight:600;color:#4f46e5;margin-bottom:12px;display:flex;align-items:center;gap:8px}
        .cdp-ai-text{font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap}
        .cdp-call{background:#fff;border:1px solid #e5e7eb;border-radius:16px;margin:16px;overflow:hidden;transition:all .2s}
        .cdp-call:hover{border-color:#d1d5db}
        .cdp-call.expanded{border-color:#6366f1;box-shadow:0 4px 20px rgba(99,102,241,.12)}
        .cdp-call-head{padding:18px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:background .15s}
        .cdp-call-head:hover{background:#f9fafb}
        .cdp-call-info{display:flex;align-items:center;gap:14px}
        .cdp-call-icon{width:48px;height:48px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px}
        .cdp-call-details h4{font-size:15px;font-weight:600;color:#111;margin:0 0 4px}
        .cdp-call-meta{font-size:12px;color:#6b7280}
        .cdp-call-badges{display:flex;gap:8px;align-items:center}
        .cdp-call-expand{width:28px;height:28px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#6b7280;transition:all .2s}
        .cdp-call.expanded .cdp-call-expand{background:#eef2ff;color:#4f46e5;transform:rotate(180deg)}
        .cdp-call-body{border-top:1px solid #f3f4f6;display:none}
        .cdp-call.expanded .cdp-call-body{display:block}
        .cdp-call-section{padding:20px;border-bottom:1px solid #f3f4f6}
        .cdp-call-section:last-child{border-bottom:none}
        .cdp-call-section-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#374151;margin-bottom:14px}
        .cdp-bullets{display:flex;flex-direction:column;gap:10px}
        .cdp-bullet{display:flex;gap:10px;padding:12px 14px;background:#f0fdf4;border-radius:10px;font-size:13px;color:#166534;line-height:1.6}
        .cdp-bullet-icon{flex-shrink:0;width:20px;height:20px;background:#bbf7d0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;margin-top:2px}
        .cdp-quality{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600}
        .cdp-quality.high{background:#ecfdf5;color:#059669}
        .cdp-quality.medium{background:#fef3c7;color:#d97706}
        .cdp-quality.low{background:#fef2f2;color:#dc2626}
        .cdp-followup{background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;font-size:13px;color:#92400e;line-height:1.6}
        .cdp-transcript{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;max-height:350px;overflow-y:auto}
        .cdp-transcript-text{font-size:13px;color:#374151;line-height:2;white-space:pre-wrap}
        .cdp-recording{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;transition:all .15s;border:none;cursor:pointer}
        .cdp-recording:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.3)}
        .cdp-note-input{display:flex;gap:12px;padding:16px;background:#fff;border-bottom:1px solid #e5e7eb}
        .cdp-note-textarea{flex:1;padding:14px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px;resize:none;font-family:inherit;min-height:60px}
        .cdp-note-textarea:focus{outline:none;border-color:#6366f1}
        .cdp-note{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:12px 16px}
        .cdp-note-head{display:flex;justify-content:space-between;margin-bottom:10px}
        .cdp-note-author{font-size:13px;font-weight:600;color:#111}
        .cdp-note-date{font-size:11px;color:#9ca3af}
        .cdp-note-text{font-size:14px;color:#374151;line-height:1.6}
        .cdp-activity{display:flex;gap:14px;padding:16px;margin:8px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .cdp-activity-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .cdp-activity-content{flex:1}
        .cdp-activity-title{font-size:14px;font-weight:500;color:#111}
        .cdp-activity-time{font-size:12px;color:#9ca3af;margin-top:4px}
        .cdp-empty{text-align:center;padding:60px 20px;color:#9ca3af}
        .cdp-empty-icon{font-size:56px;margin-bottom:16px;opacity:.4}
        .cdp-empty-text{font-size:15px;font-weight:500}
        .cdp-empty-hint{font-size:13px;margin-top:8px;color:#6b7280}
      `}</style>

      <div className="cdp" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cdp-header">
          <div className="cdp-header-top">
            <div className="cdp-profile">
              <Avatar name={candidate.name} size="lg" />
              <div className="cdp-info">
                <h2>{candidate.name}</h2>
                <p>{getRoles(candidate.roles)}</p>
                <div className="cdp-status-wrap">
                  <button className="cdp-status-btn" onClick={e => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}>
                    <StatusBadge status={candidate.status} showDot />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>▼</span>
                  </button>
                  {showStatusMenu && (
                    <div className="cdp-status-menu" onClick={e => e.stopPropagation()}>
                      {statuses.map(s => (
                        <div key={s} className={`cdp-status-opt ${candidate.status === s ? 'active' : ''}`} onClick={() => handleStatusChange(s)}>
                          <StatusBadge status={s} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button className="cdp-close" onClick={onClose}>✕</button>
          </div>
          
          <div className="cdp-actions">
            {quickActions.map(action => (
              <Tooltip key={action.label} content={action.label}>
                <div className="cdp-action" onClick={action.action}>
                  <div className="cdp-action-icon" style={{ background: `${action.color}15`, color: action.color }}>{action.icon}</div>
                  <span className="cdp-action-label">{action.label}</span>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="cdp-tabs">
          {tabs.map(tab => (
            <div key={tab.id} className={`cdp-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.icon} {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="cdp-tab-badge">{tab.badge}</span>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="cdp-content">
          {/* ============ OVERVIEW TAB ============ */}
          {activeTab === 'overview' && (
            <>
              {/* AI Campaign Insights */}
              <div style={{ margin: '16px 16px 0' }}>
                <CandidateAIInsights candidateId={candidate.id} candidateName={candidate.name} />
              </div>

              {/* Recent Communications Summary */}
              {(callRecords.length > 0 || whatsappMessages.length > 0) && (
                <div className="cdp-section" style={{ margin: '16px 16px 0' }}>
                  <div className="cdp-section-head">
                    <span className="cdp-section-title">📱 Recent Communications</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* Last Call */}
                    {callRecords.length > 0 && (
                      <div 
                        onClick={() => setActiveTab('calls')}
                        style={{ 
                          flex: 1, 
                          minWidth: 200,
                          padding: 12, 
                          background: '#fef3c7', 
                          borderRadius: 8, 
                          cursor: 'pointer',
                          border: '1px solid #fcd34d',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span>📞</span>
                          <span style={{ fontWeight: 600, color: '#92400e' }}>Last Call</span>
                          {callRecords[0].energy_score && (
                            <span style={{ 
                              marginLeft: 'auto', 
                              background: callRecords[0].energy_score >= 7 ? '#dcfce7' : callRecords[0].energy_score >= 4 ? '#fef9c3' : '#fee2e2',
                              color: callRecords[0].energy_score >= 7 ? '#166534' : callRecords[0].energy_score >= 4 ? '#854d0e' : '#991b1b',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              ⚡ {callRecords[0].energy_score}/10
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#78716c' }}>
                          {new Date(callRecords[0].call_time || callRecords[0].created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                          {callRecords[0].duration_ms && ` • ${Math.round(callRecords[0].duration_ms / 60000)} min`}
                        </div>
                        {callRecords[0].call_summary && (
                          <div style={{ fontSize: 12, color: '#57534e', marginTop: 6, lineHeight: 1.4 }}>
                            {callRecords[0].call_summary.substring(0, 100)}...
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Last WhatsApp */}
                    {whatsappMessages.length > 0 && (
                      <div 
                        onClick={() => setActiveTab('messages')}
                        style={{ 
                          flex: 1, 
                          minWidth: 200,
                          padding: 12, 
                          background: '#dcfce7', 
                          borderRadius: 8, 
                          cursor: 'pointer',
                          border: '1px solid #86efac',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span>💬</span>
                          <span style={{ fontWeight: 600, color: '#166534' }}>Last WhatsApp</span>
                          <span style={{ 
                            marginLeft: 'auto', 
                            background: '#bbf7d0',
                            color: '#166534',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 12
                          }}>
                            {whatsappMessages.length} msgs
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#4ade80' }}>
                          {new Date(whatsappMessages[0].message_timestamp || whatsappMessages[0].created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                          {whatsappMessages[0].direction === 'outbound' ? ' • Sent' : ' • Received'}
                        </div>
                        <div style={{ fontSize: 12, color: '#15803d', marginTop: 6, lineHeight: 1.4 }}>
                          {whatsappMessages[0].message_text?.substring(0, 80)}...
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {candidate.experience_summary && (
                <div className="cdp-section" style={{ margin: '16px 16px 0' }}>
                  <div className="cdp-ai-box">
                    <div className="cdp-ai-title">
                      <span style={{ fontSize: 18 }}>🤖</span> AI Summary
                    </div>
                    <div className="cdp-ai-text">{candidate.experience_summary}</div>
                  </div>
                </div>
              )}

              {/* Energy Score */}
              {candidate.energy_ratio !== null && candidate.energy_ratio !== undefined && (
                <div className="cdp-section" style={{ marginTop: candidate.experience_summary ? 12 : 16 }}>
                  <div className={`cdp-energy ${candidate.energy_ratio >= 4 ? '' : candidate.energy_ratio >= 2.5 ? 'medium' : 'low'}`}>
                    <div className="cdp-energy-head">
                      <span className="cdp-energy-title">⚡ Energy Score</span>
                      <span className="cdp-energy-score" style={{ 
                        color: candidate.energy_ratio >= 4 ? '#059669' : candidate.energy_ratio >= 2.5 ? '#d97706' : '#dc2626' 
                      }}>
                        {candidate.energy_ratio.toFixed(1)}
                      </span>
                    </div>
                    <div className="cdp-energy-bar">
                      <div 
                        className="cdp-energy-fill" 
                        style={{ 
                          width: `${Math.min(candidate.energy_ratio / 5 * 100, 100)}%`,
                          background: candidate.energy_ratio >= 4 ? '#10b981' : candidate.energy_ratio >= 2.5 ? '#f59e0b' : '#ef4444'
                        }} 
                      />
                    </div>
                    <div className="cdp-energy-stats">
                      {candidate.total_calls_scored && <span>📞 {candidate.total_calls_scored} calls scored</span>}
                      {candidate.last_called_at && <span>🕐 Last call: {fmtDate(candidate.last_called_at)}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Contact & Details */}
              <div className="cdp-section">
                <div className="cdp-section-head">
                  <span className="cdp-section-title">📇 Contact & Details</span>
                  <button className="cdp-edit-btn" onClick={() => setEditing(!editing)}>
                    {editing ? '✕ Cancel' : '✏️ Edit'}
                  </button>
                </div>
                
                {saveError && <div className="cdp-error">⚠️ {saveError}</div>}
                
                {editing ? (
                  <>
                    <div className="cdp-grid">
                      <div className="cdp-field">
                        <div className="cdp-field-label">Full Name</div>
                        <input className="cdp-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                      </div>
                      <div className="cdp-field">
                        <div className="cdp-field-label">Phone</div>
                        <input className="cdp-input" value={form.phone_e164} onChange={e => setForm({...form, phone_e164: e.target.value})} />
                      </div>
                      <div className="cdp-field full">
                        <div className="cdp-field-label">Roles</div>
                        <input className="cdp-input" value={form.roles} onChange={e => setForm({...form, roles: e.target.value})} />
                      </div>
                      <div className="cdp-field full">
                        <div className="cdp-field-label">Weekly Availability</div>
                        <input className="cdp-input" value={form.weekly_rota} onChange={e => setForm({...form, weekly_rota: e.target.value})} />
                      </div>
                    </div>
                    <div className="cdp-btns">
                      <button className="cdp-btn cancel" onClick={() => { setEditing(false); setSaveError(null); }}>Cancel</button>
                      <button className="cdp-btn save" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                  </>
                ) : (
                  <div className="cdp-grid">
                    <div className="cdp-field">
                      <div className="cdp-field-label">Phone</div>
                      <div className="cdp-field-value">{fmtPhone(candidate.phone_e164) || <span className="muted">Not provided</span>}</div>
                    </div>
                    <div className="cdp-field">
                      <div className="cdp-field-label">Source</div>
                      <div className="cdp-field-value" style={{textTransform:'capitalize'}}>{candidate.source || 'Direct'}</div>
                    </div>
                    <div className="cdp-field">
                      <div className="cdp-field-label">Available From</div>
                      <div className="cdp-field-value">{fmtDate(candidate.earliest_start_date)}</div>
                    </div>
                    <div className="cdp-field">
                      <div className="cdp-field-label">Added</div>
                      <div className="cdp-field-value">{fmtDate(candidate.created_at)}</div>
                    </div>
                    {candidate.weekly_rota && (
                      <div className="cdp-field full">
                        <div className="cdp-field-label">Weekly Availability</div>
                        <div className="cdp-field-value">{candidate.weekly_rota}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Qualifications */}
              <div className="cdp-section">
                <div className="cdp-section-head">
                  <span className="cdp-section-title">✅ Qualifications</span>
                </div>
                {editing ? (
                  <div className="cdp-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {qualifications.map(q => (
                      <div key={q.key} className="cdp-field">
                        <div className="cdp-field-label">{q.icon} {q.label}</div>
                        <select 
                          className="cdp-select" 
                          value={form[q.key as keyof typeof form] as string} 
                          onChange={e => setForm({...form, [q.key]: e.target.value})}
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Pending">Pending</option>
                          <option value="Unknown">Unknown</option>
                        </select>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cdp-qual-grid">
                    {qualifications.map(q => {
                      const status = q.value === 'Yes' ? 'yes' : q.value === 'No' ? 'no' : q.value === 'Pending' ? 'pending' : '';
                      return (
                        <div key={q.key} className={`cdp-qual ${status}`}>
                          <div className="cdp-qual-icon">{q.icon}</div>
                          <div className="cdp-qual-label">{q.label}</div>
                          <div className="cdp-qual-value">{q.value || 'Unknown'}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
          
          {/* ============ CALLS TAB ============ */}
          {activeTab === 'calls' && (
            <>
              {loadingCalls ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">⏳</div>
                  <div className="cdp-empty-text">Loading calls...</div>
                </div>
              ) : callRecords.length === 0 ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">📞</div>
                  <div className="cdp-empty-text">No call records found</div>
                  <div className="cdp-empty-hint">Call records will appear here once logged</div>
                </div>
              ) : (
                callRecords.map((call, index) => {
                  const isExpanded = expandedCall === call.id;
                  const bulletPoints = parseAiRecap(call.ai_recap || call.call_summary || '');
                  const extractedData = parseExtractedJson(call.extracted_json);
                  const qualityAssessment = call.quality_assessment || extractedData?.quality_assessment;
                  const followUpQuestions = call.follow_up_questions || extractedData?.follow_up_questions;
                  const experienceSummary = call.experience_summary;
                  const callType = call.call_type;
                  const confidence = call.extraction_confidence;
                  
                  return (
                    <div key={call.id} className={`cdp-call ${isExpanded ? 'expanded' : ''}`}>
                      <div className="cdp-call-head" onClick={() => setExpandedCall(isExpanded ? null : call.id)}>
                        <div className="cdp-call-info">
                          <div className="cdp-call-icon">📞</div>
                          <div className="cdp-call-details">
                            <h4>Call #{callRecords.length - index}</h4>
                            <div className="cdp-call-meta">
                              {fmtDateTime(call.call_time || call.created_at)}
                              {callType && callType !== 'RECRUITMENT_CALL' && (
                                <span style={{ marginLeft: 8, padding: '2px 6px', background: callType === 'SPAM_CALL' ? '#fee2e2' : '#fef3c7', borderRadius: 4, fontSize: 10 }}>
                                  {callType.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="cdp-call-badges">
                          {call.duration_ms && (
                            <Badge variant="default" size="sm">⏱️ {fmtDuration(call.duration_ms)}</Badge>
                          )}
                          {(call.energy_score !== null && call.energy_score !== undefined) && (
                            <Badge variant={call.energy_score >= 4 ? 'success' : call.energy_score >= 2.5 ? 'warning' : 'danger'} size="sm">
                              ⚡ {typeof call.energy_score === 'number' ? call.energy_score.toFixed(1) : call.energy_score}
                            </Badge>
                          )}
                          {qualityAssessment && (
                            <Badge variant={qualityAssessment === 'HIGH' ? 'success' : qualityAssessment === 'MEDIUM' ? 'warning' : 'danger'} size="sm">
                              {qualityAssessment === 'HIGH' ? '🌟' : qualityAssessment === 'MEDIUM' ? '👍' : '⚠️'}
                            </Badge>
                          )}
                          {confidence && (
                            <span style={{ fontSize: 10, color: '#6b7280' }}>{confidence}%</span>
                          )}
                          <div className="cdp-call-expand">▼</div>
                        </div>
                      </div>
                      
                      <div className="cdp-call-body">
                        {/* Recording Button */}
                        {call.recording_url && (
                          <div className="cdp-call-section">
                            <a href={call.recording_url} target="_blank" rel="noopener noreferrer" className="cdp-recording">
                              🔊 Listen to Recording
                            </a>
                          </div>
                        )}

                        {/* Experience Summary (from call_history) */}
                        {experienceSummary && (
                          <div className="cdp-call-section">
                            <div className="cdp-call-section-title">
                              <span style={{ fontSize: 16 }}>📋</span> Experience Summary (This Call)
                            </div>
                            <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: '#166534' }}>
                              {experienceSummary}
                            </div>
                          </div>
                        )}

                        {/* AI Bullet Points / Call Summary */}
                        {bulletPoints.length > 0 && (
                          <div className="cdp-call-section">
                            <div className="cdp-call-section-title">
                              <span style={{ fontSize: 16 }}>🤖</span> AI Analysis
                            </div>
                            <div className="cdp-bullets">
                              {bulletPoints.map((point, i) => (
                                <div key={i} className="cdp-bullet">
                                  <div className="cdp-bullet-icon">✓</div>
                                  <div>{point}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Follow-up Questions */}
                        {followUpQuestions && (
                          <div className="cdp-call-section">
                            <div className="cdp-call-section-title">
                              <span style={{ fontSize: 16 }}>❓</span> Suggested Follow-up
                            </div>
                            <div className="cdp-followup">
                              {Array.isArray(followUpQuestions) ? (
                                <ul style={{ margin: 0, paddingLeft: 20 }}>
                                  {followUpQuestions.map((q, i) => (
                                    <li key={i} style={{ marginBottom: 4 }}>{q}</li>
                                  ))}
                                </ul>
                              ) : (
                                followUpQuestions
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Transcript */}
                        {call.transcript && (
                          <div className="cdp-call-section">
                            <div className="cdp-call-section-title">
                              <span style={{ fontSize: 16 }}>📝</span> Transcript
                            </div>
                            <div className="cdp-transcript">
                              <div className="cdp-transcript-text">{call.transcript}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
          
          {/* ============ MESSAGES TAB ============ */}
          {activeTab === 'messages' && (
            <>
              {loadingMessages ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  Loading messages...
                </div>
              ) : whatsappMessages.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
                  <div style={{ color: '#6b7280', marginBottom: 8 }}>No WhatsApp messages</div>
                  <div style={{ color: '#9ca3af', fontSize: 13 }}>
                    Messages will appear here when captured from WhatsApp Web
                  </div>
                </div>
              ) : (
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Group messages by date */}
                  {(() => {
                    const grouped: { [date: string]: any[] } = {};
                    whatsappMessages.forEach(msg => {
                      const date = new Date(msg.message_timestamp || msg.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      });
                      if (!grouped[date]) grouped[date] = [];
                      grouped[date].push(msg);
                    });
                    
                    return Object.entries(grouped).map(([date, msgs]) => (
                      <div key={date}>
                        <div style={{ 
                          textAlign: 'center', 
                          color: '#9ca3af', 
                          fontSize: 12, 
                          margin: '16px 0 8px',
                          position: 'sticky',
                          top: 0,
                          background: '#fff',
                          padding: '4px 0'
                        }}>
                          {date}
                        </div>
                        {msgs.map(msg => (
                          <div 
                            key={msg.id}
                            style={{
                              display: 'flex',
                              justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start',
                              marginBottom: 4
                            }}
                          >
                            <div style={{
                              maxWidth: '75%',
                              padding: '8px 12px',
                              borderRadius: 12,
                              background: msg.direction === 'outbound' ? '#dcfce7' : '#f3f4f6',
                              borderTopLeftRadius: msg.direction === 'inbound' ? 4 : 12,
                              borderTopRightRadius: msg.direction === 'outbound' ? 4 : 12,
                            }}>
                              <div style={{ fontSize: 14, color: '#1f2937', whiteSpace: 'pre-wrap' }}>
                                {msg.message_text}
                              </div>
                              <div style={{ 
                                fontSize: 11, 
                                color: '#9ca3af', 
                                marginTop: 4,
                                textAlign: msg.direction === 'outbound' ? 'right' : 'left'
                              }}>
                                {new Date(msg.message_timestamp || msg.created_at).toLocaleTimeString('en-GB', {
                                  hour: '2-digit', minute: '2-digit'
                                })}
                                {msg.ai_intent && (
                                  <span style={{ 
                                    marginLeft: 8, 
                                    background: '#e0e7ff', 
                                    padding: '1px 6px', 
                                    borderRadius: 8,
                                    color: '#4f46e5',
                                    fontSize: 10
                                  }}>
                                    {msg.ai_intent}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </>
          )}
          
          {/* ============ NOTES TAB ============ */}
          {activeTab === 'notes' && (
            <>
              <div className="cdp-note-input">
                <textarea
                  className="cdp-note-textarea"
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
                <button 
                  className="cdp-btn save" 
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || savingNote}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {savingNote ? '...' : 'Add'}
                </button>
              </div>
              
              {loadingNotes ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">⏳</div>
                  <div className="cdp-empty-text">Loading notes...</div>
                </div>
              ) : notes.length === 0 ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">📝</div>
                  <div className="cdp-empty-text">No notes yet</div>
                  <div className="cdp-empty-hint">Add notes to keep track of important info</div>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="cdp-note">
                    <div className="cdp-note-head">
                      <span className="cdp-note-author">{note.author_name || 'User'}</span>
                      <span className="cdp-note-date">{fmtDateTime(note.created_at)}</span>
                    </div>
                    <div className="cdp-note-text">{note.content}</div>
                  </div>
                ))
              )}
            </>
          )}
          
          {/* ============ ACTIVITY TAB ============ */}
          {activeTab === 'emails' && (
            <>
              {loadingEmails ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">⏳</div>
                  <div className="cdp-empty-text">Loading emails...</div>
                </div>
              ) : emailMessages.length === 0 ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">📧</div>
                  <div className="cdp-empty-text">No emails yet</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
                    Connect Outlook in the Assistant tab to start syncing emails
                  </div>
                </div>
              ) : (
                emailMessages.map((email: any) => (
                  <div key={email.id} style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: email.direction === 'outbound' ? '#eff6ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                        {email.direction === 'outbound' ? '📤' : '📥'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{email.subject || '(no subject)'}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>
                            {email.received_at ? new Date(email.received_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          {email.direction === 'outbound' ? `To: ${email.from_email}` : `From: ${email.from_name || email.from_email}`}
                        </div>
                        {email.ai_summary && (
                          <div style={{ fontSize: 12, color: '#4b5563', background: '#f9fafb', borderRadius: 6, padding: '6px 10px', marginBottom: 4, lineHeight: 1.5 }}>
                            {email.ai_summary}
                          </div>
                        )}
                        {!email.ai_summary && email.body_preview && (
                          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                            {email.body_preview.slice(0, 150)}{email.body_preview.length > 150 ? '...' : ''}
                          </div>
                        )}
                        {email.ai_suggested_action && email.ai_suggested_action !== 'no_action' && (
                          <div style={{ marginTop: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}>
                              {email.ai_suggested_action.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'activity' && (
            <>
              {loadingActivity ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">⏳</div>
                  <div className="cdp-empty-text">Loading...</div>
                </div>
              ) : activities.length === 0 ? (
                <div className="cdp-empty">
                  <div className="cdp-empty-icon">📊</div>
                  <div className="cdp-empty-text">No activity recorded</div>
                </div>
              ) : (
                activities.map(activity => (
                  <div key={activity.id} className="cdp-activity">
                    <div className="cdp-activity-icon" style={{ background: '#f3f4f6' }}>
                      {activity.type === 'status_change' ? '↗️' : activity.type === 'note_added' ? '📝' : '📋'}
                    </div>
                    <div className="cdp-activity-content">
                      <div className="cdp-activity-title">{activity.description}</div>
                      <div className="cdp-activity-time">{fmtDateTime(activity.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
