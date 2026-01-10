'use client';
import { useState } from 'react';

export default function ComplianceView() {
  const [retentionDays, setRetentionDays] = useState(365);
  const [auditLogs] = useState([
    { id: '1', user: 'John Doe', action: 'Viewed candidate profile', target: 'Emma Watson', time: '2024-01-20T14:32:00' },
    { id: '2', user: 'Jane Smith', action: 'Changed status to Interview', target: 'Mike Brown', time: '2024-01-20T14:15:00' },
    { id: '3', user: 'John Doe', action: 'Downloaded CV', target: 'Sarah Lee', time: '2024-01-20T13:45:00' },
    { id: '4', user: 'System', action: 'Sent rejection email', target: 'Tom Wilson', time: '2024-01-20T12:00:00' },
    { id: '5', user: 'Jane Smith', action: 'Deleted candidate data (GDPR request)', target: 'Alex Johnson', time: '2024-01-19T16:30:00' },
  ]);

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .comp-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        .comp-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px}
        .comp-card-header{padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
        .comp-card-title{font-size:14px;font-weight:600;color:#111}
        .comp-card-body{padding:20px}
        .comp-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f3f4f6}
        .comp-row:last-child{border-bottom:none}
        .comp-label{font-size:13px;color:#374151}
        .comp-value{font-size:13px;color:#6b7280}
        .comp-toggle{width:44px;height:24px;background:#10b981;border-radius:12px;position:relative;cursor:pointer}
        .comp-toggle::after{content:'';position:absolute;width:20px;height:20px;background:#fff;border-radius:50%;top:2px;right:2px;box-shadow:0 1px 3px rgba(0,0,0,.2)}
        .comp-input{padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;width:100px}
        .comp-btn{padding:8px 16px;font-size:12px;font-weight:500;border-radius:6px;cursor:pointer;border:none}
        .comp-btn.primary{background:#4f46e5;color:#fff}
        .comp-btn.danger{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
        .audit-item{display:flex;gap:12px;padding:12px;background:#f9fafb;border-radius:8px;margin-bottom:8px}
        .audit-icon{width:32px;height:32px;background:#e5e7eb;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px}
        .audit-info{flex:1}
        .audit-action{font-size:13px;color:#111}
        .audit-meta{font-size:11px;color:#6b7280}
        .gdpr-actions{display:flex;flex-direction:column;gap:12px}
        .gdpr-action{display:flex;align-items:center;gap:12px;padding:16px;background:#f9fafb;border-radius:10px}
        .gdpr-action-icon{font-size:24px}
        .gdpr-action-info{flex:1}
        .gdpr-action-title{font-size:13px;font-weight:600;color:#111}
        .gdpr-action-desc{font-size:12px;color:#6b7280}
      `}</style>
      
      <div className="comp-grid">
        <div className="comp-card">
          <div className="comp-card-header"><span className="comp-card-title">🔒 Data Protection Settings</span></div>
          <div className="comp-card-body">
            <div className="comp-row"><span className="comp-label">GDPR Mode</span><div className="comp-toggle" /></div>
            <div className="comp-row"><span className="comp-label">Data Retention Period</span><div style={{display:'flex',alignItems:'center',gap:8}}><input type="number" className="comp-input" value={retentionDays} onChange={e => setRetentionDays(+e.target.value)} /><span style={{fontSize:12,color:'#6b7280'}}>days</span></div></div>
            <div className="comp-row"><span className="comp-label">Auto-delete rejected candidates</span><div className="comp-toggle" /></div>
            <div className="comp-row"><span className="comp-label">Require consent for data processing</span><div className="comp-toggle" /></div>
            <div className="comp-row"><span className="comp-label">Show privacy notice on application</span><div className="comp-toggle" /></div>
          </div>
        </div>
        
        <div className="comp-card">
          <div className="comp-card-header"><span className="comp-card-title">📋 GDPR Actions</span></div>
          <div className="comp-card-body">
            <div className="gdpr-actions">
              <div className="gdpr-action">
                <span className="gdpr-action-icon">📥</span>
                <div className="gdpr-action-info"><div className="gdpr-action-title">Export Candidate Data</div><div className="gdpr-action-desc">Download all data for a specific candidate (SAR)</div></div>
                <button className="comp-btn primary">Export</button>
              </div>
              <div className="gdpr-action">
                <span className="gdpr-action-icon">🗑️</span>
                <div className="gdpr-action-info"><div className="gdpr-action-title">Right to be Forgotten</div><div className="gdpr-action-desc">Permanently delete candidate and all related data</div></div>
                <button className="comp-btn danger">Delete</button>
              </div>
              <div className="gdpr-action">
                <span className="gdpr-action-icon">📊</span>
                <div className="gdpr-action-info"><div className="gdpr-action-title">Generate Compliance Report</div><div className="gdpr-action-desc">Export GDPR/Article 55 compliance report</div></div>
                <button className="comp-btn primary">Generate</button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="comp-card" style={{gridColumn:'span 2'}}>
          <div className="comp-card-header"><span className="comp-card-title">📜 Audit Log</span><button className="comp-btn primary">Export Log</button></div>
          <div className="comp-card-body">
            {auditLogs.map(log => (
              <div key={log.id} className="audit-item">
                <div className="audit-icon">{log.action.includes('Delete') ? '🗑️' : log.action.includes('Download') ? '📥' : log.action.includes('email') ? '📧' : '👁️'}</div>
                <div className="audit-info">
                  <div className="audit-action"><strong>{log.user}</strong> {log.action}</div>
                  <div className="audit-meta">{log.target} • {new Date(log.time).toLocaleString('en-GB')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
