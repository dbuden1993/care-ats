'use client';
import { useState } from 'react';

interface Props { enabled: boolean; onToggle: (enabled: boolean) => void; }

export default function BlindModeToggle({ enabled, onToggle }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: enabled ? '#fef3c7' : '#f3f4f6', borderRadius: 8 }}>
      <style>{`
        .blind-toggle{width:44px;height:24px;background:#e5e7eb;border-radius:12px;position:relative;cursor:pointer;transition:background .2s}
        .blind-toggle.on{background:#f59e0b}
        .blind-toggle::after{content:'';position:absolute;width:20px;height:20px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .blind-toggle.on::after{transform:translateX(20px)}
      `}</style>
      <span style={{ fontSize: 16 }}>🙈</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? '#92400e' : '#374151' }}>Blind Mode {enabled ? 'ON' : 'OFF'}</div>
        <div style={{ fontSize: 11, color: '#6b7280' }}>Hide names & photos during screening</div>
      </div>
      <div className={`blind-toggle ${enabled ? 'on' : ''}`} onClick={() => onToggle(!enabled)} />
    </div>
  );
}

// Utility to anonymize candidate data
export function anonymizeCandidate(candidate: any, enabled: boolean) {
  if (!enabled) return candidate;
  return {
    ...candidate,
    name: `Candidate #${candidate.id.slice(-4).toUpperCase()}`,
    phone_e164: '••••••••••••',
    email: '••••@••••.com',
    _isAnonymized: true,
  };
}
