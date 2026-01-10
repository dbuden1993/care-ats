'use client';
import { useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

interface Props {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export default function Tabs({ tabs, activeTab, onChange, variant = 'default', size = 'md', fullWidth = false }: Props) {
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, gap: 4 },
    md: { padding: '10px 18px', fontSize: 13, gap: 6 },
    lg: { padding: '14px 24px', fontSize: 14, gap: 8 },
  };

  const s = sizes[size];

  if (variant === 'pills') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: s.gap,
              padding: s.padding,
              fontSize: s.fontSize,
              fontWeight: 600,
              border: 'none',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeTab === tab.id ? '#4f46e5' : '#f3f4f6',
              color: activeTab === tab.id ? '#fff' : '#6b7280',
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                background: activeTab === tab.id ? 'rgba(255,255,255,.2)' : '#e5e7eb',
                color: activeTab === tab.id ? '#fff' : '#374151',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', width: fullWidth ? '100%' : 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: s.gap,
              padding: s.padding,
              fontSize: s.fontSize,
              fontWeight: 600,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
              borderBottom: `2px solid ${activeTab === tab.id ? '#4f46e5' : 'transparent'}`,
              marginBottom: -2,
              flex: fullWidth ? 1 : 'none',
              justifyContent: 'center',
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{
                padding: '1px 6px',
                borderRadius: 10,
                fontSize: 10,
                fontWeight: 700,
                background: activeTab === tab.id ? '#eef2ff' : '#f3f4f6',
                color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Default boxed variant
  return (
    <div style={{ 
      display: 'inline-flex', 
      gap: 4, 
      background: '#f3f4f6', 
      padding: 4, 
      borderRadius: 12,
      width: fullWidth ? '100%' : 'auto'
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: s.gap,
            padding: s.padding,
            fontSize: s.fontSize,
            fontWeight: 600,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: activeTab === tab.id ? '#fff' : 'transparent',
            color: activeTab === tab.id ? '#111' : '#6b7280',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            flex: fullWidth ? 1 : 'none',
            justifyContent: 'center',
          }}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
          {tab.badge !== undefined && (
            <span style={{
              padding: '1px 6px',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              background: activeTab === tab.id ? '#eef2ff' : '#e5e7eb',
              color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
            }}>
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
