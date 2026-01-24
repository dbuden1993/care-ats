'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CallRecord {
  id: string;
  call_id: string;
  phone_e164: string;
  call_time: string;
  direction: string;
  duration_ms: number | null;
  candidate_name: string | null;
  experience_summary: string | null;
  call_summary: string | null;
  roles: string[];
  driver: string | null;
  dbs_status: string | null;
  mandatory_training: string | null;
  earliest_start_date: string | null;
  weekly_rota: string | null;
  energy_score: number | null;
  quality_assessment: string | null;
  follow_up_questions: string[];
  call_type: string | null;
  transcript: string | null;
  recording_url: string | null;
}

interface CandidateDashboardProps {
  onSelectCandidate?: (candidate: any) => void;
}

type SortField = 'call_time' | 'candidate_name' | 'energy_score' | 'quality_assessment';
type GradeFilter = 'all' | 'A' | 'B' | 'C' | 'D';
type ViewMode = 'cards' | 'table';

export default function CandidateDashboard({ onSelectCandidate }: CandidateDashboardProps) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('call_time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [showTranscript, setShowTranscript] = useState<string | null>(null);

  useEffect(() => {
    fetchCalls();
  }, []);

  async function fetchCalls() {
    setLoading(true);
    const { data, error } = await supabase
      .from('call_history')
      .select('*')
      .order('call_time', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching calls:', error);
    } else {
      // Only keep graded calls (with valid candidate names)
      const graded = (data || []).filter(c => 
        c.candidate_name && 
        c.candidate_name !== 'Unknown' && 
        c.candidate_name !== 'Unknown Candidate' &&
        !c.candidate_name.toLowerCase().includes('unknown')
      );
      setCalls(graded);
    }
    setLoading(false);
  }

  // Memoized filtered and sorted calls
  const filteredCalls = useMemo(() => {
    let result = [...calls];

    // Grade filter
    if (gradeFilter !== 'all') {
      result = result.filter(c => {
        const grade = c.quality_assessment?.toUpperCase();
        if (gradeFilter === 'D') return grade === 'D' || grade === 'F' || grade === 'LOW';
        if (gradeFilter === 'A') return grade === 'A' || grade === 'HIGH';
        if (gradeFilter === 'C') return grade === 'C' || grade === 'MEDIUM';
        return grade === gradeFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.candidate_name?.toLowerCase().includes(q) ||
        c.phone_e164?.includes(q) ||
        c.call_summary?.toLowerCase().includes(q) ||
        c.roles?.some(r => r.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      // Handle nulls
      if (aVal === null) aVal = sortDir === 'asc' ? Infinity : -Infinity;
      if (bVal === null) bVal = sortDir === 'asc' ? Infinity : -Infinity;
      
      // Handle dates
      if (sortField === 'call_time') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      // Handle grades
      if (sortField === 'quality_assessment') {
        const gradeOrder: Record<string, number> = { 'A': 1, 'HIGH': 1, 'B': 2, 'C': 3, 'MEDIUM': 3, 'D': 4, 'F': 5, 'LOW': 5 };
        aVal = gradeOrder[String(aVal).toUpperCase()] || 99;
        bVal = gradeOrder[String(bVal).toUpperCase()] || 99;
      }

      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [calls, gradeFilter, searchQuery, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => ({
    total: calls.length,
    gradeA: calls.filter(c => ['A', 'HIGH'].includes(c.quality_assessment?.toUpperCase() || '')).length,
    gradeB: calls.filter(c => c.quality_assessment?.toUpperCase() === 'B').length,
    gradeC: calls.filter(c => ['C', 'MEDIUM'].includes(c.quality_assessment?.toUpperCase() || '')).length,
    gradeD: calls.filter(c => ['D', 'F', 'LOW'].includes(c.quality_assessment?.toUpperCase() || '')).length,
    avgEnergy: calls.length > 0 
      ? (calls.reduce((sum, c) => sum + (c.energy_score || 0), 0) / calls.filter(c => c.energy_score).length).toFixed(1)
      : '0',
  }), [calls]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatPhone = (phone: string) => {
    if (!phone) return '—';
    if (phone.startsWith('+44')) {
      return '0' + phone.slice(3, 7) + ' ' + phone.slice(7, 10) + ' ' + phone.slice(10);
    }
    return phone;
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGradeConfig = (grade: string | null) => {
    const g = grade?.toUpperCase();
    switch (g) {
      case 'A': case 'HIGH':
        return { letter: 'A', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', shadow: 'rgba(16, 185, 129, 0.3)' };
      case 'B':
        return { letter: 'B', bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', shadow: 'rgba(59, 130, 246, 0.3)' };
      case 'C': case 'MEDIUM':
        return { letter: 'C', bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', shadow: 'rgba(245, 158, 11, 0.3)' };
      case 'D': case 'F': case 'LOW':
        return { letter: 'D', bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', shadow: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { letter: '?', bg: 'var(--gray-200)', color: 'var(--gray-600)', shadow: 'none' };
    }
  };

  const getEnergyConfig = (score: number | null) => {
    if (!score) return { color: 'var(--gray-400)', bg: 'var(--gray-100)' };
    if (score >= 8) return { color: '#059669', bg: '#d1fae5' };
    if (score >= 6) return { color: '#2563eb', bg: '#dbeafe' };
    if (score >= 4) return { color: '#d97706', bg: '#fef3c7' };
    return { color: '#dc2626', bg: '#fee2e2' };
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
      'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
      'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
      'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    ];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  };

  const styles = `
    .cd-container {
      padding: 24px;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      min-height: 100vh;
    }
    
    .cd-header {
      margin-bottom: 24px;
    }
    
    .cd-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 800;
      color: var(--gray-900);
      margin-bottom: 8px;
    }
    
    .cd-subtitle {
      font-size: 14px;
      color: var(--gray-500);
    }
    
    .cd-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .cd-stat {
      background: white;
      border-radius: var(--radius-xl);
      padding: 20px 24px;
      min-width: 120px;
      box-shadow: var(--shadow-card);
      cursor: pointer;
      transition: all var(--transition-normal);
      border: 2px solid transparent;
    }
    
    .cd-stat:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }
    
    .cd-stat.active {
      border-color: var(--primary);
    }
    
    .cd-stat-value {
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 800;
      color: var(--gray-900);
      line-height: 1;
    }
    
    .cd-stat-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500);
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .cd-stat.grade-a .cd-stat-value { color: #059669; }
    .cd-stat.grade-b .cd-stat-value { color: #2563eb; }
    .cd-stat.grade-c .cd-stat-value { color: #d97706; }
    .cd-stat.grade-d .cd-stat-value { color: #dc2626; }
    
    .cd-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .cd-search {
      flex: 1;
      min-width: 280px;
      max-width: 400px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: white;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-lg);
      transition: all var(--transition-fast);
    }
    
    .cd-search:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px var(--primary-50);
    }
    
    .cd-search-icon {
      font-size: 18px;
      color: var(--gray-400);
    }
    
    .cd-search input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 14px;
      background: transparent;
    }
    
    .cd-view-toggle {
      display: flex;
      background: white;
      border-radius: var(--radius-lg);
      padding: 4px;
      box-shadow: var(--shadow-sm);
    }
    
    .cd-view-btn {
      padding: 10px 16px;
      border: none;
      background: transparent;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      color: var(--gray-500);
      transition: all var(--transition-fast);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .cd-view-btn:hover {
      color: var(--gray-700);
    }
    
    .cd-view-btn.active {
      background: var(--primary);
      color: white;
    }
    
    .cd-sort {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .cd-sort-select {
      padding: 10px 14px;
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-lg);
      font-size: 13px;
      font-weight: 500;
      background: white;
      cursor: pointer;
    }
    
    .cd-sort-select:focus {
      outline: none;
      border-color: var(--primary);
    }
    
    .cd-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 20px;
    }
    
    .cd-card {
      background: white;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-card);
      overflow: hidden;
      transition: all var(--transition-normal);
      cursor: pointer;
    }
    
    .cd-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }
    
    .cd-card-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px;
      border-bottom: 1px solid var(--gray-100);
    }
    
    .cd-avatar {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 20px;
      flex-shrink: 0;
    }
    
    .cd-card-info {
      flex: 1;
      min-width: 0;
    }
    
    .cd-card-name {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 4px;
    }
    
    .cd-card-phone {
      font-size: 13px;
      color: var(--gray-500);
      font-family: var(--font-mono);
    }
    
    .cd-card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    
    .cd-card-time {
      font-size: 12px;
      color: var(--gray-400);
    }
    
    .cd-card-duration {
      font-size: 12px;
      color: var(--gray-500);
      background: var(--gray-100);
      padding: 2px 8px;
      border-radius: var(--radius-full);
    }
    
    .cd-grade {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
      flex-shrink: 0;
    }
    
    .cd-card-body {
      padding: 20px;
    }
    
    .cd-card-summary {
      font-size: 14px;
      color: var(--gray-600);
      line-height: 1.6;
      margin-bottom: 16px;
    }
    
    .cd-card-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .cd-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
    }
    
    .cd-badge.role {
      background: var(--primary-50);
      color: var(--primary);
    }
    
    .cd-badge.qual-yes {
      background: #d1fae5;
      color: #059669;
    }
    
    .cd-badge.qual-no {
      background: #fee2e2;
      color: #dc2626;
    }
    
    .cd-energy {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: var(--radius-lg);
      background: var(--gray-50);
    }
    
    .cd-energy-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500);
    }
    
    .cd-energy-bar {
      flex: 1;
      height: 8px;
      background: var(--gray-200);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    
    .cd-energy-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width 0.5s ease;
    }
    
    .cd-energy-score {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 800;
      min-width: 36px;
      text-align: right;
    }
    
    .cd-card-actions {
      display: flex;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid var(--gray-100);
      background: var(--gray-50);
    }
    
    .cd-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 16px;
      border: none;
      border-radius: var(--radius-lg);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .cd-action-btn.primary {
      background: var(--primary);
      color: white;
    }
    
    .cd-action-btn.primary:hover {
      background: var(--primary-hover);
    }
    
    .cd-action-btn.secondary {
      background: white;
      color: var(--gray-700);
      border: 1px solid var(--gray-200);
    }
    
    .cd-action-btn.secondary:hover {
      background: var(--gray-100);
    }
    
    .cd-empty {
      text-align: center;
      padding: 80px 40px;
      background: white;
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-card);
    }
    
    .cd-empty-icon {
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.4;
    }
    
    .cd-empty-title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 8px;
    }
    
    .cd-empty-text {
      font-size: 14px;
      color: var(--gray-500);
    }
    
    .cd-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
    }
    
    .cd-loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid var(--gray-200);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: cdSpin 0.8s linear infinite;
    }
    
    @keyframes cdSpin {
      to { transform: rotate(360deg); }
    }
    
    .cd-transcript-modal {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    
    .cd-transcript-content {
      background: white;
      border-radius: var(--radius-2xl);
      width: 100%;
      max-width: 700px;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .cd-transcript-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .cd-transcript-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
    }
    
    .cd-transcript-close {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: var(--gray-100);
      border-radius: var(--radius-md);
      cursor: pointer;
      font-size: 18px;
      color: var(--gray-500);
    }
    
    .cd-transcript-body {
      padding: 24px;
      max-height: calc(80vh - 140px);
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.8;
      color: var(--gray-700);
      white-space: pre-wrap;
    }
  `;

  if (loading) {
    return (
      <div className="cd-container">
        <style>{styles}</style>
        <div className="cd-loading">
          <div className="cd-loading-spinner" />
          <p style={{ marginTop: 16, color: 'var(--gray-500)' }}>Loading candidates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cd-container">
      <style>{styles}</style>
      
      {/* Header */}
      <div className="cd-header">
        <h1 className="cd-title">👥 Candidate Dashboard</h1>
        <p className="cd-subtitle">
          {stats.total} graded candidates from AI-analyzed call recordings
        </p>
      </div>
      
      {/* Stats */}
      <div className="cd-stats">
        <div 
          className={`cd-stat ${gradeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setGradeFilter('all')}
        >
          <div className="cd-stat-value">{stats.total}</div>
          <div className="cd-stat-label">Total Candidates</div>
        </div>
        <div 
          className={`cd-stat grade-a ${gradeFilter === 'A' ? 'active' : ''}`}
          onClick={() => setGradeFilter('A')}
        >
          <div className="cd-stat-value">{stats.gradeA}</div>
          <div className="cd-stat-label">Grade A</div>
        </div>
        <div 
          className={`cd-stat grade-b ${gradeFilter === 'B' ? 'active' : ''}`}
          onClick={() => setGradeFilter('B')}
        >
          <div className="cd-stat-value">{stats.gradeB}</div>
          <div className="cd-stat-label">Grade B</div>
        </div>
        <div 
          className={`cd-stat grade-c ${gradeFilter === 'C' ? 'active' : ''}`}
          onClick={() => setGradeFilter('C')}
        >
          <div className="cd-stat-value">{stats.gradeC}</div>
          <div className="cd-stat-label">Grade C</div>
        </div>
        <div 
          className={`cd-stat grade-d ${gradeFilter === 'D' ? 'active' : ''}`}
          onClick={() => setGradeFilter('D')}
        >
          <div className="cd-stat-value">{stats.gradeD}</div>
          <div className="cd-stat-label">Grade D</div>
        </div>
        <div className="cd-stat">
          <div className="cd-stat-value">{stats.avgEnergy}</div>
          <div className="cd-stat-label">Avg Energy</div>
        </div>
      </div>
      
      {/* Toolbar */}
      <div className="cd-toolbar">
        <div className="cd-search">
          <span className="cd-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by name, phone, role, or summary..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="cd-sort">
          <select 
            className="cd-sort-select"
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
          >
            <option value="call_time">Sort by Date</option>
            <option value="candidate_name">Sort by Name</option>
            <option value="energy_score">Sort by Energy</option>
            <option value="quality_assessment">Sort by Grade</option>
          </select>
          <button
            className="cd-sort-select"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            style={{ padding: '10px 12px' }}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        
        <div className="cd-view-toggle">
          <button
            className={`cd-view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
          >
            <span>▦</span> Cards
          </button>
          <button
            className={`cd-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            <span>☰</span> Table
          </button>
        </div>
      </div>
      
      {/* Results */}
      {filteredCalls.length === 0 ? (
        <div className="cd-empty">
          <div className="cd-empty-icon">📞</div>
          <div className="cd-empty-title">No candidates found</div>
          <div className="cd-empty-text">
            {searchQuery 
              ? `No results for "${searchQuery}". Try a different search.`
              : gradeFilter !== 'all'
                ? `No Grade ${gradeFilter} candidates yet.`
                : 'Candidates will appear here after graded calls are processed via Dialpad.'
            }
          </div>
        </div>
      ) : (
        <div className="cd-grid">
          {filteredCalls.map(call => {
            const gradeConfig = getGradeConfig(call.quality_assessment);
            const energyConfig = getEnergyConfig(call.energy_score);
            const energyPct = call.energy_score ? (call.energy_score / 10) * 100 : 0;
            
            return (
              <div key={call.id} className="cd-card">
                <div className="cd-card-header">
                  <div 
                    className="cd-avatar"
                    style={{ background: getAvatarColor(call.candidate_name || '') }}
                  >
                    {(call.candidate_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="cd-card-info">
                    <div className="cd-card-name">{call.candidate_name}</div>
                    <div className="cd-card-phone">{formatPhone(call.phone_e164)}</div>
                    <div className="cd-card-meta">
                      <span className="cd-card-time">{formatDate(call.call_time)}</span>
                      <span className="cd-card-duration">⏱️ {formatDuration(call.duration_ms)}</span>
                    </div>
                  </div>
                  <div 
                    className="cd-grade"
                    style={{ 
                      background: gradeConfig.bg, 
                      color: gradeConfig.color,
                      boxShadow: `0 4px 12px ${gradeConfig.shadow}`
                    }}
                  >
                    {gradeConfig.letter}
                  </div>
                </div>
                
                <div className="cd-card-body">
                  {call.call_summary && (
                    <p className="cd-card-summary">{call.call_summary}</p>
                  )}
                  
                  <div className="cd-card-badges">
                    {call.roles?.slice(0, 2).map((role, i) => (
                      <span key={i} className="cd-badge role">{role}</span>
                    ))}
                    {call.driver === 'Yes' && (
                      <span className="cd-badge qual-yes">🚗 Driver</span>
                    )}
                    {call.dbs_status && call.dbs_status !== 'Unknown' && (
                      <span className={`cd-badge ${call.dbs_status.toLowerCase().includes('yes') ? 'qual-yes' : 'qual-no'}`}>
                        🔒 DBS
                      </span>
                    )}
                    {call.earliest_start_date && (
                      <span className="cd-badge role">
                        📅 Start: {new Date(call.earliest_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  
                  <div className="cd-energy">
                    <span className="cd-energy-label">Energy</span>
                    <div className="cd-energy-bar">
                      <div 
                        className="cd-energy-fill"
                        style={{ 
                          width: `${energyPct}%`,
                          background: `linear-gradient(90deg, ${energyConfig.color} 0%, ${energyConfig.color}88 100%)`
                        }}
                      />
                    </div>
                    <span 
                      className="cd-energy-score"
                      style={{ color: energyConfig.color }}
                    >
                      {call.energy_score || '—'}
                    </span>
                  </div>
                </div>
                
                <div className="cd-card-actions">
                  <button 
                    className="cd-action-btn secondary"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      window.location.href = `tel:${call.phone_e164}`; 
                    }}
                  >
                    📞 Call
                  </button>
                  <button 
                    className="cd-action-btn secondary"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      window.open(`https://wa.me/${call.phone_e164?.replace(/\D/g, '')}`, '_blank'); 
                    }}
                  >
                    💬 WhatsApp
                  </button>
                  {call.transcript && (
                    <button 
                      className="cd-action-btn primary"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setShowTranscript(call.id); 
                      }}
                    >
                      📝 Transcript
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Transcript Modal */}
      {showTranscript && (
        <div className="cd-transcript-modal" onClick={() => setShowTranscript(null)}>
          <div className="cd-transcript-content" onClick={e => e.stopPropagation()}>
            <div className="cd-transcript-header">
              <span className="cd-transcript-title">
                📝 Call Transcript - {calls.find(c => c.id === showTranscript)?.candidate_name}
              </span>
              <button 
                className="cd-transcript-close"
                onClick={() => setShowTranscript(null)}
              >
                ×
              </button>
            </div>
            <div className="cd-transcript-body">
              {calls.find(c => c.id === showTranscript)?.transcript || 'No transcript available.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
