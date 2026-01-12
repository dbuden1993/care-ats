'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import CandidatesView from './CandidatesView';
import KanbanView from './KanbanView';
import CalendarView from './CalendarView';
import JobsView from './JobsView';
import TemplatesView from './TemplatesView';
import AutomationsView from './AutomationsView';
import ReportsView from './ReportsView';
import TalentPoolView from './TalentPoolView';
import ReferralView from './ReferralView';
import SettingsView from './SettingsView';
import OnboardingView from './OnboardingView';
import CandidateSurveyView from './CandidateSurvey';
import ComplianceView from './ComplianceView';
import DashboardView from './DashboardView';
import WhatsAppCampaign from './WhatsAppCampaign';
import SearchBar from './SearchBar';
import CandidateModal from './CandidateModal';
import JobModal from './JobModal';
import ScheduleModal from './ScheduleModal';
import EmailComposer from './EmailComposer';
import BulkActionsBar from './BulkActionsBar';
import BlindModeToggle, { anonymizeCandidate } from './BlindModeToggle';
import EmptyState from './EmptyStates';
import { CandidateListSkeleton, KanbanSkeleton } from './LoadingSkeleton';
import { ToastProvider, useToast } from './Toast';
import { ConfirmProvider } from './ConfirmDialog';
import { useKeyboardShortcuts, ShortcutsHelp } from './KeyboardShortcuts';
import GlobalSearch from './GlobalSearch';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import CandidateDetailPanel from './CandidateDetailPanel';
import CandidateImport from './CandidateImport';
import ImportedCandidatesView from './ImportedCandidatesView';
import CalledCandidatesView from './CalledCandidatesView';
import FilterPresets from './FilterPresets';
import Tooltip from './Tooltip';
import { getJobs, createJob } from './db';
import { DEFAULT_PIPELINE } from './store';
import type { Job, Pipeline, ViewMode, SidebarSection } from './types';

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type ExtendedSection = SidebarSection | 'whatsapp' | 'imported' | 'call-history';

function Dashboard() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualFilter, setQualFilter] = useState('all');
  const [energyFilter, setEnergyFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [section, setSection] = useState<ExtendedSection>('dashboard');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pipeline] = useState<Pipeline>(DEFAULT_PIPELINE);
  const [blindMode, setBlindMode] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [scheduleCandidate, setScheduleCandidate] = useState<any>(null);
  const [emailCandidate, setEmailCandidate] = useState<any>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [callHistoryCount, setCallHistoryCount] = useState(0);
  
  const toast = useToast();

  const shortcuts = [
    { key: 'n', ctrl: true, description: 'Add candidate', action: () => setShowAddCandidate(true) },
    { key: 'j', ctrl: true, description: 'Add job', action: () => setShowAddJob(true) },
    { key: 'k', description: 'Kanban view', action: () => { setSection('candidates'); setViewMode('kanban'); } },
    { key: 'l', description: 'List view', action: () => { setSection('candidates'); setViewMode('list'); } },
    { key: 'w', description: 'WhatsApp campaigns', action: () => setSection('whatsapp') },
    { key: 'c', description: 'Call history', action: () => setSection('call-history') },
    { key: '?', shift: true, description: 'Show shortcuts', action: () => setShowShortcuts(true) },
    { key: 'Escape', description: 'Close / Clear', action: () => { setSelected(new Set()); setSelectedCandidate(null); setShowShortcuts(false); } },
  ];

  useKeyboardShortcuts(shortcuts);

  const fetchCandidates = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      if (query?.trim()) {
        const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: query.trim(), limit: 100 }) });
        const data = await res.json();
        setCandidates((data.candidates || []).filter((c: any) => c.last_called_at !== null));
      } else {
        const { data } = await supabase
          .from('candidates')
          .select('*')
          .not('last_called_at', 'is', null)
          .order('created_at', { ascending: false })
          .limit(200);
        setCandidates(data || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await getJobs();
      setJobs(data || []);
    } catch (e) { setJobs([]); }
  }, []);

  const fetchImportedCount = useCallback(async () => {
    try {
      const { data, count, error } = await supabase
        .from('candidates')
        .select('id', { count: 'exact' })
        .is('last_called_at', null);
      
      console.log('Imported count query result:', { count, error, dataLength: data?.length });
      setImportedCount(count || data?.length || 0);
    } catch (e) { console.error('Failed to count imported:', e); }
  }, []);

  const fetchCallHistoryCount = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('call_history')
        .select('id', { count: 'exact' });
      setCallHistoryCount(count || 0);
    } catch (e) { console.error('Failed to count call history:', e); }
  }, []);

  useEffect(() => { 
    fetchCandidates(); 
    fetchJobs(); 
    fetchImportedCount(); 
    fetchCallHistoryCount(); 
  }, [fetchCandidates, fetchJobs, fetchImportedCount, fetchCallHistoryCount]);

  const handleSearch = (q: string) => { setSearchQuery(q); fetchCandidates(q); };
  
  const handleAddCandidate = async (data: any) => {
    try {
      await supabase.from('candidates').insert([{ 
        name: data.name, 
        phone_e164: data.phone, 
        status: 'new', 
        roles: data.roles, 
        experience_summary: data.experience, 
        driver: data.driver, 
        dbs_update_service: data.dbs, 
        mandatory_training: data.training, 
        earliest_start_date: data.start_date, 
        job_id: data.job_id || null, 
        source: data.source 
      }]);
      toast.success('Candidate added successfully');
      fetchCandidates();
    } catch (err) { toast.error('Failed to add candidate'); }
    setShowAddCandidate(false);
  };

  const handleAddJob = async (data: any) => {
    try {
      await createJob({ 
        title: data.title, 
        department: data.department, 
        location: data.location, 
        type: data.type, 
        status: data.status, 
        description: data.description, 
        requirements: data.requirements, 
        salary_min: data.salary_min ? parseFloat(data.salary_min) : null, 
        salary_max: data.salary_max ? parseFloat(data.salary_max) : null, 
        salary_type: data.salary_type, 
        published_at: data.status === 'open' ? new Date().toISOString() : null 
      });
      toast.success('Job created successfully');
      fetchJobs();
    } catch (err) { toast.error('Failed to create job'); }
    setShowAddJob(false);
  };

  const handleNavigate = (action: string, data?: any) => {
    if (action === 'add-candidate') setShowAddCandidate(true);
    else if (action === 'add-job') setShowAddJob(true);
    else if (action === 'candidate' && data) setSelectedCandidate(data);
    else if (action === 'candidates') { setSection('candidates'); if (data?.status) setStatusFilter(data.status); }
    else if (action === 'whatsapp') setSection('whatsapp');
    else if (action === 'call-history') setSection('call-history');
    else setSection(action as ExtendedSection);
  };

  const handleFilterPreset = (filters: any) => {
    if (filters.status) setStatusFilter(filters.status);
    if (filters.qualification) setQualFilter(filters.qualification);
    if (filters.energy) setEnergyFilter(filters.energy);
    if (filters.job) setJobFilter(filters.job);
  };

  const filtered = candidates.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (qualFilter === 'driver' && c.driver !== 'Yes') return false;
    if (qualFilter === 'dbs' && c.dbs_update_service !== 'Yes') return false;
    if (qualFilter === 'training' && c.mandatory_training !== 'Yes') return false;
    if (energyFilter === 'high' && (c.energy_ratio === null || c.energy_ratio < 4)) return false;
    if (energyFilter === 'low' && (c.energy_ratio === null || c.energy_ratio >= 3)) return false;
    if (jobFilter !== 'all' && c.job_id !== jobFilter) return false;
    return true;
  }).map(c => anonymizeCandidate(c, blindMode));

  const stats = { 
    total: candidates.length, 
    new: candidates.filter(c => c.status === 'new').length, 
    screening: candidates.filter(c => c.status === 'screening').length, 
    interview: candidates.filter(c => c.status === 'interview').length, 
    offer: candidates.filter(c => c.status === 'offer').length, 
    hired: candidates.filter(c => c.status === 'hired').length 
  };

  const clearFilters = () => { 
    setStatusFilter('all'); 
    setQualFilter('all'); 
    setEnergyFilter('all'); 
    setJobFilter('all'); 
    setSearchQuery(''); 
    fetchCandidates(); 
  };

  const navItems = [
    { section: 'RECRUITMENT', items: [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' }, 
      { id: 'call-history', icon: '📞', label: 'Call History', badge: callHistoryCount },
      { id: 'candidates', icon: '👥', label: 'Called Candidates', badge: stats.total }, 
      { id: 'imported', icon: '📥', label: 'Imported Pool', badge: importedCount }, 
      { id: 'jobs', icon: '💼', label: 'Jobs', badge: jobs.filter(j => j.status === 'open').length }, 
      { id: 'interviews', icon: '📅', label: 'Interviews' }
    ] },
    { section: 'OUTREACH', items: [
      { id: 'whatsapp', icon: '💬', label: 'WhatsApp Campaigns' }
    ] },
    { section: 'TALENT', items: [
      { id: 'talent-pools', icon: '🎯', label: 'Talent Pools' }, 
      { id: 'referrals', icon: '🤝', label: 'Referrals' }, 
      { id: 'onboarding', icon: '🚀', label: 'Onboarding' }
    ] },
    { section: 'INSIGHTS', items: [
      { id: 'reports', icon: '📈', label: 'Reports' }, 
      { id: 'surveys', icon: '⭐', label: 'Candidate NPS' }
    ] },
    { section: 'SETTINGS', items: [
      { id: 'templates', icon: '📝', label: 'Templates' }, 
      { id: 'automations', icon: '⚡', label: 'Automations' }, 
      { id: 'compliance', icon: '🔒', label: 'Compliance' }, 
      { id: 'settings', icon: '⚙️', label: 'Settings' }
    ] },
  ];

  const sidebarWidth = sidebarCollapsed ? '72px' : '260px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .sidebar{width:${sidebarWidth};background:linear-gradient(180deg,#fff 0%,#fafbfc 100%);border-right:1px solid #e5e7eb;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;transition:width .2s cubic-bezier(.4,0,.2,1);z-index:100}
        .sidebar-header{padding:20px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:12px}
        .logo{width:36px;height:36px;background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;flex-shrink:0;box-shadow:0 2px 8px rgba(99,102,241,.3)}
        .logo-text{font-size:17px;font-weight:800;background:linear-gradient(135deg,#4f46e5,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
        .nav-section{padding:12px 0}
        .nav-label{padding:8px 20px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px}
        .nav-item{display:flex;align-items:center;gap:12px;padding:10px 20px;font-size:13px;color:#4b5563;cursor:pointer;border-left:3px solid transparent;transition:all .15s;margin:2px 8px;border-radius:8px;border-left:none}
        .nav-item:hover{background:#f3f4f6;color:#111}
        .nav-item.active{background:linear-gradient(135deg,#eef2ff,#e0e7ff);color:#4f46e5;font-weight:600}
        .nav-item.whatsapp.active{background:linear-gradient(135deg,#ecfdf5,#d1fae5);color:#059669}
        .nav-item.call-history.active{background:linear-gradient(135deg,#fef3c7,#fde68a);color:#d97706}
        .nav-icon{width:20px;text-align:center;font-size:15px}
        .nav-badge{background:#e5e7eb;color:#374151;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:auto}
        .nav-item.active .nav-badge{background:#c7d2fe;color:#4f46e5}
        .nav-item.call-history.active .nav-badge{background:#fde68a;color:#d97706}
        .sidebar-footer{margin-top:auto;padding:16px;border-top:1px solid #f3f4f6}
        .collapse-btn{position:absolute;right:-14px;top:24px;width:28px;height:28px;background:#fff;border:1px solid #e5e7eb;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:#6b7280;box-shadow:0 2px 8px rgba(0,0,0,.08);transition:all .15s;z-index:10}
        .collapse-btn:hover{background:#f9fafb;transform:scale(1.05)}
        .main{margin-left:${sidebarWidth};flex:1;transition:margin-left .2s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;min-height:100vh}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;backdrop-filter:blur(8px);background:rgba(255,255,255,.9)}
        .topbar-left{display:flex;align-items:center;gap:20px}
        .page-title{font-size:20px;font-weight:700;color:#111}
        .view-toggle{display:flex;background:#f3f4f6;border-radius:10px;padding:3px}
        .view-btn{padding:8px 14px;font-size:12px;font-weight:600;border:none;background:none;color:#6b7280;cursor:pointer;border-radius:8px;transition:all .15s;display:flex;align-items:center;gap:6px}
        .view-btn.active{background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,.08)}
        .topbar-right{display:flex;align-items:center;gap:12px}
        .topbar-btn{padding:9px 16px;font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .15s}
        .topbar-btn.primary{background:linear-gradient(135deg,#4f46e5,#6366f1);border:none;color:#fff;box-shadow:0 2px 8px rgba(99,102,241,.3)}
        .topbar-btn.primary:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(99,102,241,.4)}
        .stats-bar{display:flex;gap:12px;padding:16px 24px;background:#fff;border-bottom:1px solid #e5e7eb;overflow-x:auto}
        .stat-card{background:#f9fafb;border-radius:12px;padding:14px 20px;cursor:pointer;transition:all .15s;border:2px solid transparent;min-width:100px;text-align:center}
        .stat-card:hover{background:#f3f4f6;transform:translateY(-1px)}
        .stat-card.active{border-color:#4f46e5;background:linear-gradient(135deg,#eef2ff,#e0e7ff)}
        .stat-value{font-size:24px;font-weight:800;color:#111}
        .stat-label{font-size:10px;color:#6b7280;margin-top:2px;text-transform:uppercase;font-weight:600;letter-spacing:.5px}
        .filters-bar{display:flex;align-items:center;gap:12px;padding:12px 24px;background:#fafbfc;border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
        .filter-select{padding:8px 12px;font-size:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-weight:500}
        .filter-select:focus{outline:none;border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1)}
        .filter-clear{padding:8px 14px;font-size:11px;color:#6b7280;background:#fff;border:1px dashed #d1d5db;border-radius:8px;cursor:pointer;font-weight:500;transition:all .15s}
        .filter-clear:hover{border-color:#6366f1;color:#6366f1;background:#eef2ff}
        .content{flex:1;background:#fff}
        .shortcut-hint{font-size:10px;color:#9ca3af;padding:12px 20px}
        .shortcut-hint kbd{padding:3px 6px;background:#f3f4f6;border-radius:4px;font-family:monospace;font-weight:600}
      `}</style>

      {/* Sidebar */}
      <aside className="sidebar">
        <button className="collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {sidebarCollapsed ? '→' : '←'}
        </button>
        <div className="sidebar-header">
          <div className="logo">✦</div>
          {!sidebarCollapsed && <div className="logo-text">CareRecruit</div>}
        </div>
        {navItems.map(group => (
          <nav key={group.section} className="nav-section">
            {!sidebarCollapsed && <div className="nav-label">{group.section}</div>}
            {group.items.map(item => (
              <Tooltip key={item.id} content={sidebarCollapsed ? item.label : ''} position="right">
                <div 
                  className={`nav-item ${item.id === 'whatsapp' ? 'whatsapp' : ''} ${item.id === 'call-history' ? 'call-history' : ''} ${section === item.id ? 'active' : ''}`} 
                  onClick={() => setSection(item.id as ExtendedSection)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <>
                      <span>{item.label}</span>
                      {item.badge !== undefined && <span className="nav-badge">{item.badge}</span>}
                    </>
                  )}
                </div>
              </Tooltip>
            ))}
          </nav>
        ))}
        {!sidebarCollapsed && <div className="shortcut-hint">Press <kbd>?</kbd> for shortcuts</div>}
        <div className="sidebar-footer">
          {sidebarCollapsed ? (
            <div style={{width:40,height:40,background:'linear-gradient(135deg,#10b981,#059669)',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,margin:'0 auto'}}>JD</div>
          ) : (
            <UserMenu onNavigate={handleNavigate} />
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar" style={{ justifyContent: 'flex-end', gap: 12 }}>
          <GlobalSearch candidates={candidates} jobs={jobs} onSelectCandidate={setSelectedCandidate} onSelectJob={() => setSection('jobs')} onNavigate={handleNavigate} />
          <NotificationBell />
        </div>

        {section === 'dashboard' && (
          <DashboardView candidates={candidates} jobs={jobs} onNavigate={handleNavigate} />
        )}
        
        {section === 'whatsapp' && (
          <WhatsAppCampaign candidates={candidates} />
        )}

        {section === 'call-history' && (
          <>
            <div className="topbar">
              <div className="topbar-left">
                <h1 className="page-title">📞 Call History</h1>
                <span style={{ fontSize: 13, color: '#6b7280' }}>AI-analyzed call recordings</span>
              </div>
            </div>
            <div className="content">
              <CalledCandidatesView onSelectCandidate={setSelectedCandidate} />
            </div>
          </>
        )}
        
        {section === 'imported' && (
          <ImportedCandidatesView 
            onSelectCandidate={setSelectedCandidate} 
            onOpenImport={() => setShowImport(true)} 
            onStartCampaign={(selectedCandidates) => {
              (window as any).__importedCampaignCandidates = selectedCandidates;
              setSection('whatsapp');
            }}
          />
        )}
        
        {section === 'candidates' && (
          <>
            <div className="topbar">
              <div className="topbar-left">
                <h1 className="page-title">Candidates</h1>
                <div className="view-toggle">
                  <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰ List</button>
                  <button className={`view-btn ${viewMode === 'kanban' ? 'active' : ''}`} onClick={() => setViewMode('kanban')}>▦ Kanban</button>
                </div>
              </div>
              <div className="topbar-right">
                <BlindModeToggle enabled={blindMode} onToggle={setBlindMode} />
                <SearchBar onSearch={handleSearch} initialValue={searchQuery} />
                <button className="topbar-btn secondary" onClick={() => setShowImport(true)} style={{background:'#f3f4f6',color:'#374151',border:'1px solid #e5e7eb'}}>📥 Import</button>
                <button className="topbar-btn primary" onClick={() => setShowAddCandidate(true)}>+ Add Candidate</button>
              </div>
            </div>
            <div className="stats-bar">
              {[
                { k: 'all', v: stats.total, l: 'Total' }, 
                { k: 'new', v: stats.new, l: 'New' }, 
                { k: 'screening', v: stats.screening, l: 'Screening' }, 
                { k: 'interview', v: stats.interview, l: 'Interview' }, 
                { k: 'offer', v: stats.offer, l: 'Offer' }, 
                { k: 'hired', v: stats.hired, l: 'Hired', c: '#059669' }
              ].map(s => (
                <div key={s.k} className={`stat-card ${statusFilter === s.k ? 'active' : ''}`} onClick={() => setStatusFilter(s.k)}>
                  <div className="stat-value" style={s.c ? {color:s.c} : {}}>{s.v}</div>
                  <div className="stat-label">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="filters-bar">
              <FilterPresets currentFilters={{ status: statusFilter, qualification: qualFilter, energy: energyFilter, job: jobFilter }} onApply={handleFilterPreset} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="filter-select" value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
                  <option value="all">All Jobs</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
                <select className="filter-select" value={qualFilter} onChange={e => setQualFilter(e.target.value)}>
                  <option value="all">All Qualifications</option>
                  <option value="driver">🚗 Drivers Only</option>
                  <option value="dbs">🔒 DBS Checked</option>
                  <option value="training">📚 Training Done</option>
                </select>
                {(statusFilter !== 'all' || qualFilter !== 'all' || energyFilter !== 'all' || jobFilter !== 'all') && (
                  <button className="filter-clear" onClick={clearFilters}>✕ Clear Filters</button>
                )}
              </div>
            </div>
            <div className="content">
              {loading ? (
                viewMode === 'kanban' ? <KanbanSkeleton /> : <CandidateListSkeleton />
              ) : filtered.length === 0 ? (
                <EmptyState type={searchQuery ? 'search' : 'candidates'} searchQuery={searchQuery} onAction={searchQuery ? clearFilters : () => setShowAddCandidate(true)} />
              ) : viewMode === 'kanban' ? (
                <KanbanView candidates={filtered} stages={pipeline.stages} onUpdate={fetchCandidates} onCandidateClick={setSelectedCandidate} />
              ) : (
                <CandidatesView candidates={filtered} searchQuery={searchQuery} selected={selected} onSelect={setSelected} onCandidateClick={setSelectedCandidate} onUpdate={fetchCandidates} />
              )}
            </div>
          </>
        )}

        {section === 'jobs' && (
          <>
            <div className="topbar">
              <div className="topbar-left"><h1 className="page-title">Jobs</h1></div>
              <div className="topbar-right">
                <button className="topbar-btn primary" onClick={() => setShowAddJob(true)}>+ Create Job</button>
              </div>
            </div>
            <div className="content">
              <JobsView jobs={jobs} candidates={candidates} onUpdate={fetchJobs} onCreateJob={() => setShowAddJob(true)} />
            </div>
          </>
        )}

        {section === 'interviews' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Interviews</h1></div></div>
            <div className="content"><CalendarView candidates={candidates} /></div>
          </>
        )}

        {section === 'talent-pools' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Talent Pools</h1></div></div>
            <div className="content"><TalentPoolView candidates={candidates} /></div>
          </>
        )}

        {section === 'referrals' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Employee Referrals</h1></div></div>
            <div className="content"><ReferralView jobs={jobs} /></div>
          </>
        )}

        {section === 'onboarding' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Onboarding</h1></div></div>
            <div className="content"><OnboardingView /></div>
          </>
        )}

        {section === 'reports' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Reports</h1></div></div>
            <div className="content"><ReportsView candidates={candidates} jobs={jobs} /></div>
          </>
        )}

        {section === 'surveys' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Candidate Experience</h1></div></div>
            <div className="content"><CandidateSurveyView /></div>
          </>
        )}

        {section === 'templates' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Email Templates</h1></div></div>
            <div className="content"><TemplatesView /></div>
          </>
        )}

        {section === 'automations' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Automations</h1></div></div>
            <div className="content"><AutomationsView /></div>
          </>
        )}

        {section === 'compliance' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Compliance & GDPR</h1></div></div>
            <div className="content"><ComplianceView /></div>
          </>
        )}

        {section === 'settings' && (
          <>
            <div className="topbar"><div className="topbar-left"><h1 className="page-title">Settings</h1></div></div>
            <div className="content"><SettingsView /></div>
          </>
        )}
      </main>

      {/* Modals */}
      {showAddCandidate && <CandidateModal onClose={() => setShowAddCandidate(false)} onSave={handleAddCandidate} jobs={jobs} />}
      {showAddJob && <JobModal onClose={() => setShowAddJob(false)} onSave={handleAddJob} />}
      {showImport && <CandidateImport onClose={() => setShowImport(false)} onImportComplete={() => { fetchCandidates(); fetchImportedCount(); toast.success('Candidates imported successfully'); }} />}
      {scheduleCandidate && <ScheduleModal candidate={scheduleCandidate} onClose={() => setScheduleCandidate(null)} onSchedule={() => { toast.success('Interview scheduled'); setScheduleCandidate(null); }} />}
      {emailCandidate && <EmailComposer candidate={emailCandidate} onClose={() => setEmailCandidate(null)} onSend={(d: any) => { toast.success(`Email sent to ${d.to}`); setEmailCandidate(null); }} />}
      {selectedCandidate && <CandidateDetailPanel candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} onUpdate={fetchCandidates} onSchedule={() => setScheduleCandidate(selectedCandidate)} onEmail={() => setEmailCandidate(selectedCandidate)} />}
      {showShortcuts && <ShortcutsHelp shortcuts={shortcuts} onClose={() => setShowShortcuts(false)} />}
      <BulkActionsBar selectedIds={selected} candidates={candidates} onClear={() => setSelected(new Set())} onUpdate={fetchCandidates} onEmail={() => {}} />
    </div>
  );
}

export default function RecruitDashboard() {
  return <ToastProvider><ConfirmProvider><Dashboard /></ConfirmProvider></ToastProvider>;
}
