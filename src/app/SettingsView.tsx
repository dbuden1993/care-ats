'use client';
import { useState } from 'react';
import Switch from './Switch';
import Input from './Input';
import Select from './Select';
import Button from './Button';
import Avatar from './Avatar';
import Tabs from './Tabs';
import Card from './Card';
import FileUpload from './FileUpload';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    companyName: 'CareRecruit',
    email: 'admin@carerecruit.com',
    timezone: 'europe_london',
    language: 'en',
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
    candidateUpdates: true,
    interviewReminders: true,
    autoReject: false,
    autoRejectDays: 30,
    gdprEnabled: true,
    dataRetentionDays: 365,
    twoFactor: false,
    sessionTimeout: 60,
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'pipeline', label: 'Pipeline', icon: '📊' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'billing', label: 'Billing', icon: '💳' },
  ];

  return (
    <div style={{ padding: 24, background: '#f8fafc', minHeight: '100%' }}>
      <style>{`
        .settings-grid{display:grid;grid-template-columns:220px 1fr;gap:24px}
        @media(max-width:800px){.settings-grid{grid-template-columns:1fr}}
        .settings-nav{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:8px;height:fit-content;position:sticky;top:100px}
        .settings-nav-item{display:flex;align-items:center;gap:10px;padding:12px 16px;font-size:13px;font-weight:500;color:#6b7280;border-radius:10px;cursor:pointer;transition:all .15s;margin-bottom:4px}
        .settings-nav-item:hover{background:#f3f4f6;color:#111}
        .settings-nav-item.active{background:#eef2ff;color:#4f46e5}
        .settings-content{flex:1}
        .settings-section{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;margin-bottom:20px}
        .settings-section-title{font-size:16px;font-weight:700;color:#111;margin-bottom:4px}
        .settings-section-desc{font-size:13px;color:#6b7280;margin-bottom:20px}
        .settings-row{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 0;border-bottom:1px solid #f3f4f6}
        .settings-row:last-child{border-bottom:none;padding-bottom:0}
        .settings-row-info{flex:1;padding-right:24px}
        .settings-row-label{font-size:14px;font-weight:500;color:#111;margin-bottom:2px}
        .settings-row-desc{font-size:12px;color:#6b7280}
        .settings-integrations{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
        .settings-integration{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;cursor:pointer;transition:all .15s}
        .settings-integration:hover{border-color:#d1d5db;background:#fafbfc}
        .settings-integration.connected{border-color:#10b981;background:#ecfdf510}
        .settings-integration-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;background:#f3f4f6}
        .settings-integration-info{flex:1}
        .settings-integration-name{font-size:13px;font-weight:600;color:#111}
        .settings-integration-status{font-size:11px;color:#6b7280}
        .settings-integration.connected .settings-integration-status{color:#10b981}
        .settings-plan{display:flex;gap:16px;padding:20px;background:linear-gradient(135deg,#4f46e5,#6366f1);border-radius:16px;color:#fff}
        .settings-plan-info{flex:1}
        .settings-plan-name{font-size:20px;font-weight:700;margin-bottom:4px}
        .settings-plan-desc{font-size:13px;opacity:.8}
        .settings-plan-price{text-align:right}
        .settings-plan-amount{font-size:32px;font-weight:800}
        .settings-plan-period{font-size:12px;opacity:.7}
      `}</style>

      <div className="settings-grid">
        <nav className="settings-nav">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </div>
          ))}
        </nav>

        <div className="settings-content">
          {activeTab === 'general' && (
            <>
              <div className="settings-section">
                <h3 className="settings-section-title">Company Profile</h3>
                <p className="settings-section-desc">Manage your company information and branding</p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                  <Avatar name={settings.companyName} size="xl" />
                  <div>
                    <Button variant="secondary" size="sm">Change Logo</Button>
                    <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>JPG, PNG up to 2MB</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Input label="Company Name" value={settings.companyName} onChange={v => updateSetting('companyName', v)} />
                  <Input label="Email" type="email" value={settings.email} onChange={v => updateSetting('email', v)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Select
                    label="Timezone"
                    value={settings.timezone}
                    options={[
                      { value: 'europe_london', label: 'Europe/London (GMT)' },
                      { value: 'europe_paris', label: 'Europe/Paris (CET)' },
                      { value: 'america_new_york', label: 'America/New York (EST)' },
                      { value: 'asia_tokyo', label: 'Asia/Tokyo (JST)' },
                    ]}
                    onChange={v => updateSetting('timezone', v)}
                  />
                  <Select
                    label="Language"
                    value={settings.language}
                    options={[
                      { value: 'en', label: '🇬🇧 English' },
                      { value: 'es', label: '🇪🇸 Spanish' },
                      { value: 'fr', label: '🇫🇷 French' },
                      { value: 'de', label: '🇩🇪 German' },
                    ]}
                    onChange={v => updateSetting('language', v)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <Button variant="secondary">Cancel</Button>
                <Button variant="primary">Save Changes</Button>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Notification Preferences</h3>
              <p className="settings-section-desc">Control how and when you receive notifications</p>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Email Notifications</div>
                  <div className="settings-row-desc">Receive notifications via email</div>
                </div>
                <Switch checked={settings.emailNotifications} onChange={v => updateSetting('emailNotifications', v)} />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Push Notifications</div>
                  <div className="settings-row-desc">Receive browser push notifications</div>
                </div>
                <Switch checked={settings.pushNotifications} onChange={v => updateSetting('pushNotifications', v)} />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Weekly Digest</div>
                  <div className="settings-row-desc">Get a weekly summary of your recruiting activity</div>
                </div>
                <Switch checked={settings.weeklyDigest} onChange={v => updateSetting('weeklyDigest', v)} />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Candidate Updates</div>
                  <div className="settings-row-desc">Notify when candidates apply or update their status</div>
                </div>
                <Switch checked={settings.candidateUpdates} onChange={v => updateSetting('candidateUpdates', v)} />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Interview Reminders</div>
                  <div className="settings-row-desc">Get reminded before scheduled interviews</div>
                </div>
                <Switch checked={settings.interviewReminders} onChange={v => updateSetting('interviewReminders', v)} />
              </div>
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Pipeline Settings</h3>
              <p className="settings-section-desc">Configure your recruitment pipeline behavior</p>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Auto-reject Stale Applications</div>
                  <div className="settings-row-desc">Automatically reject candidates after inactivity</div>
                </div>
                <Switch checked={settings.autoReject} onChange={v => updateSetting('autoReject', v)} />
              </div>

              {settings.autoReject && (
                <div style={{ paddingLeft: 24, paddingTop: 16 }}>
                  <Input 
                    label="Days before auto-reject" 
                    type="number" 
                    value={settings.autoRejectDays.toString()} 
                    onChange={v => updateSetting('autoRejectDays', parseInt(v) || 30)} 
                  />
                </div>
              )}

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">GDPR Compliance</div>
                  <div className="settings-row-desc">Enable GDPR consent collection and data management</div>
                </div>
                <Switch checked={settings.gdprEnabled} onChange={v => updateSetting('gdprEnabled', v)} />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Data Retention Period</div>
                  <div className="settings-row-desc">How long to keep candidate data</div>
                </div>
                <Select
                  value={settings.dataRetentionDays.toString()}
                  options={[
                    { value: '90', label: '90 days' },
                    { value: '180', label: '6 months' },
                    { value: '365', label: '1 year' },
                    { value: '730', label: '2 years' },
                  ]}
                  onChange={v => updateSetting('dataRetentionDays', parseInt(v))}
                />
              </div>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Integrations</h3>
              <p className="settings-section-desc">Connect your favorite tools and services</p>

              <div className="settings-integrations">
                {[
                  { id: 'slack', name: 'Slack', icon: '💬', connected: true },
                  { id: 'google', name: 'Google Calendar', icon: '📅', connected: true },
                  { id: 'linkedin', name: 'LinkedIn', icon: '💼', connected: false },
                  { id: 'indeed', name: 'Indeed', icon: '🔵', connected: false },
                  { id: 'zoom', name: 'Zoom', icon: '📹', connected: true },
                  { id: 'docusign', name: 'DocuSign', icon: '✍️', connected: false },
                ].map(integration => (
                  <div key={integration.id} className={`settings-integration ${integration.connected ? 'connected' : ''}`}>
                    <div className="settings-integration-icon">{integration.icon}</div>
                    <div className="settings-integration-info">
                      <div className="settings-integration-name">{integration.name}</div>
                      <div className="settings-integration-status">
                        {integration.connected ? '✓ Connected' : 'Not connected'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-section">
              <h3 className="settings-section-title">Security Settings</h3>
              <p className="settings-section-desc">Protect your account and data</p>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Two-Factor Authentication</div>
                  <div className="settings-row-desc">Add an extra layer of security to your account</div>
                </div>
                <Switch checked={settings.twoFactor} onChange={v => updateSetting('twoFactor', v)} />
              </div>

              <div className="settings-row">
                <div className="settings-row-info">
                  <div className="settings-row-label">Session Timeout</div>
                  <div className="settings-row-desc">Automatically log out after inactivity</div>
                </div>
                <Select
                  value={settings.sessionTimeout.toString()}
                  options={[
                    { value: '15', label: '15 minutes' },
                    { value: '30', label: '30 minutes' },
                    { value: '60', label: '1 hour' },
                    { value: '120', label: '2 hours' },
                  ]}
                  onChange={v => updateSetting('sessionTimeout', parseInt(v))}
                />
              </div>

              <div style={{ marginTop: 24 }}>
                <Button variant="secondary" icon="🔑">Change Password</Button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <>
              <div className="settings-plan">
                <div className="settings-plan-info">
                  <div className="settings-plan-name">Professional Plan</div>
                  <div className="settings-plan-desc">Unlimited candidates, all features included</div>
                </div>
                <div className="settings-plan-price">
                  <div className="settings-plan-amount">£99</div>
                  <div className="settings-plan-period">per month</div>
                </div>
              </div>

              <div className="settings-section" style={{ marginTop: 20 }}>
                <h3 className="settings-section-title">Billing Details</h3>
                <p className="settings-section-desc">Manage your payment information</p>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <div className="settings-row-label">Payment Method</div>
                    <div className="settings-row-desc">Visa ending in 4242</div>
                  </div>
                  <Button variant="secondary" size="sm">Update</Button>
                </div>

                <div className="settings-row">
                  <div className="settings-row-info">
                    <div className="settings-row-label">Next Billing Date</div>
                    <div className="settings-row-desc">January 1, 2026</div>
                  </div>
                  <Button variant="secondary" size="sm">View Invoices</Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
