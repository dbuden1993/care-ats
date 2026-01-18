'use client';
import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CandidateQuickCardProps {
  candidate: {
    id: string;
    name: string;
    phone_e164: string;
    status: string;
    roles?: string[];
    experience_summary?: string;
    driver?: string;
    dbs_update_service?: string;
    earliest_start_date?: string;
    weekly_rota?: string;
    source?: string;
    created_at?: string;
  };
  callHistory?: {
    energy_score?: number;
    quality_assessment?: string;
    call_summary?: string;
    transcript?: string;
    follow_up_questions?: string[];
    call_time?: string;
  };
  onStatusChange?: (newStatus: string) => void;
  onViewFull?: () => void;
  compact?: boolean;
}

export default function CandidateQuickCard({ 
  candidate, 
  callHistory, 
  onStatusChange,
  onViewFull,
  compact = false 
}: CandidateQuickCardProps) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new': return { bg: '#dbeafe', text: '#1e40af', label: 'New' };
      case 'callback': return { bg: '#fef3c7', text: '#92400e', label: 'Callback' };
      case 'screening': return { bg: '#f3e8ff', text: '#7c3aed', label: 'Screening' };
      case 'interview': return { bg: '#fce7f3', text: '#be185d', label: 'Interview' };
      case 'offer': return { bg: '#d1fae5', text: '#065f46', label: 'Offer' };
      case 'placed': return { bg: '#dcfce7', text: '#166534', label: 'Placed' };
      case 'not_interested': return { bg: '#fee2e2', text: '#991b1b', label: 'Not Interested' };
      case 'no_answer': return { bg: '#fef3c7', text: '#92400e', label: 'No Answer' };
      default: return { bg: '#f3f4f6', text: '#374151', label: status || 'Unknown' };
    }
  };

  const getQualityColor = (quality: string | undefined) => {
    switch (quality?.toUpperCase()) {
      case 'A': case 'HIGH': return { bg: '#dcfce7', text: '#166534' };
      case 'B': return { bg: '#dbeafe', text: '#1e40af' };
      case 'C': case 'MEDIUM': return { bg: '#fef9c3', text: '#854d0e' };
      case 'D': case 'F': case 'LOW': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const getEnergyColor = (score: number | undefined) => {
    if (!score) return '#9ca3af';
    if (score >= 8) return '#22c55e';
    if (score >= 6) return '#3b82f6';
    if (score >= 4) return '#eab308';
    return '#ef4444';
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '';
    if (phone.startsWith('+44')) {
      const local = phone.replace('+44', '0');
      return local.replace(/(\d{5})(\d{6})/, '$1 $2');
    }
    return phone;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  async function addNote() {
    if (!notes.trim()) return;
    setSaving(true);
    
    // Add note to candidate (you might want to create a notes table)
    // For now, we'll append to experience_summary
    const { error } = await supabase
      .from('candidates')
      .update({ 
        experience_summary: `${candidate.experience_summary || ''}\n\n[${new Date().toLocaleDateString()}] ${notes}`
      })
      .eq('id', candidate.id);

    if (!error) {
      setNotes('');
      setShowNotes(false);
    }
    setSaving(false);
  }

  const statusColors = getStatusColor(candidate.status);
  const qualityColors = getQualityColor(callHistory?.quality_assessment);

  if (compact) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* Quality/Energy Badge */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: qualityColors.bg,
          color: qualityColors.text,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '12px'
        }}>
          {callHistory?.quality_assessment?.charAt(0) || '?'}
          <span style={{ fontSize: '10px', color: getEnergyColor(callHistory?.energy_score) }}>
            {callHistory?.energy_score || '-'}
          </span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>
            {candidate.name}
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {(candidate.roles || []).slice(0, 2).join(', ')}
          </div>
        </div>

        {/* Status */}
        <span style={{
          padding: '4px 8px',
          borderRadius: '12px',
          background: statusColors.bg,
          color: statusColors.text,
          fontSize: '11px',
          fontWeight: '500'
        }}>
          {statusColors.label}
        </span>

        {/* Quick Actions */}
        <a
          href={`tel:${candidate.phone_e164}`}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            background: '#22c55e',
            color: 'white',
            textDecoration: 'none',
            fontSize: '12px'
          }}
        >
          📞
        </a>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden'
    }}>
      {/* Header with quality indicator */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px'
      }}>
        {/* Quality Badge */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '12px',
          background: qualityColors.bg,
          color: qualityColors.text,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '20px', fontWeight: '700' }}>
            {callHistory?.quality_assessment?.charAt(0) || '?'}
          </span>
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: getEnergyColor(callHistory?.energy_score)
          }}>
            {callHistory?.energy_score || '-'}
          </span>
        </div>

        {/* Main Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
              {candidate.name}
            </h3>
            <span style={{
              padding: '4px 10px',
              borderRadius: '12px',
              background: statusColors.bg,
              color: statusColors.text,
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {statusColors.label}
            </span>
          </div>
          
          <div 
            style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onClick={() => copyToClipboard(candidate.phone_e164)}
            title="Click to copy"
          >
            📱 {formatPhone(candidate.phone_e164)}
            <span style={{ fontSize: '10px' }}>📋</span>
          </div>

          {/* Roles */}
          {candidate.roles && candidate.roles.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {candidate.roles.slice(0, 4).map((role, i) => (
                <span key={i} style={{
                  padding: '4px 8px',
                  background: '#f3f4f6',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#4b5563'
                }}>
                  {role}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={`tel:${candidate.phone_e164}`}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#22c55e',
              color: 'white',
              textDecoration: 'none',
              fontWeight: '500',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📞 Call
          </a>
          <a
            href={`https://wa.me/${candidate.phone_e164?.replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#25d366',
              color: 'white',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            💬
          </a>
        </div>
      </div>

      {/* Call Summary */}
      {callHistory?.call_summary && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
            📝 Last Call Summary
          </div>
          <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>
            {callHistory.call_summary}
          </div>
        </div>
      )}

      {/* Key Info Grid */}
      <div style={{ 
        padding: '16px 20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '16px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <InfoItem 
          icon="🚗" 
          label="Driver" 
          value={candidate.driver || 'Unknown'} 
          good={candidate.driver === 'Yes'}
        />
        <InfoItem 
          icon="🔒" 
          label="DBS" 
          value={candidate.dbs_update_service || 'Unknown'}
          good={candidate.dbs_update_service?.toLowerCase().includes('yes')}
        />
        <InfoItem 
          icon="📅" 
          label="Can Start" 
          value={candidate.earliest_start_date || 'Not specified'}
        />
        <InfoItem 
          icon="⏰" 
          label="Hours" 
          value={candidate.weekly_rota || 'Not specified'}
        />
      </div>

      {/* Follow-up Actions */}
      {callHistory?.follow_up_questions && callHistory.follow_up_questions.length > 0 && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
            🎯 Follow-up Actions
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#374151', fontSize: '14px' }}>
            {callHistory.follow_up_questions.slice(0, 3).map((action, i) => (
              <li key={i} style={{ marginBottom: '4px' }}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Status Change & Notes */}
      <div style={{ padding: '16px 20px', background: '#f9fafb' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={candidate.status}
            onChange={(e) => onStatusChange?.(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              flex: 1
            }}
          >
            <option value="new">New</option>
            <option value="callback">Callback Requested</option>
            <option value="screening">Screening</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="placed">Placed</option>
            <option value="not_interested">Not Interested</option>
            <option value="no_answer">No Answer</option>
          </select>

          <button
            onClick={() => setShowNotes(!showNotes)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✏️ Add Note
          </button>

          {onViewFull && (
            <button
              onClick={onViewFull}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#3b82f6',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              View Full Profile →
            </button>
          )}
        </div>

        {/* Notes Input */}
        {showNotes && (
          <div style={{ marginTop: '12px' }}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a quick note..."
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                resize: 'vertical',
                minHeight: '80px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={addNote}
                disabled={saving || !notes.trim()}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#22c55e',
                  color: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? 'Saving...' : 'Save Note'}
              </button>
              <button
                onClick={() => { setShowNotes(false); setNotes(''); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, good }: { 
  icon: string; 
  label: string; 
  value: string;
  good?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
        {icon} {label}
      </div>
      <div style={{ 
        fontSize: '14px', 
        fontWeight: '500',
        color: good === true ? '#22c55e' : good === false ? '#ef4444' : '#374151'
      }}>
        {value}
      </div>
    </div>
  );
}
