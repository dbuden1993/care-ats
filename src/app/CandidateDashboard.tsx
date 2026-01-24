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

type GradeFilter = 'all' | 'A' | 'B' | 'C' | 'D';
type AvailabilityFilter = 'all' | 'immediate' | 'week' | 'month';
type RoleFilter = string;

export default function CandidateDashboard({ onSelectCandidate }: CandidateDashboardProps) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'driver' | 'dbs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTranscript, setShowTranscript] = useState<string | null>(null);
  const [showHotCandidates, setShowHotCandidates] = useState(true);

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

  // Get unique roles across all candidates
  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    calls.forEach(c => c.roles?.forEach(r => roles.add(r)));
    return Array.from(roles).sort();
  }, [calls]);

  // Check if candidate is available soon
  const getAvailabilityStatus = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return { label: 'Immediate', color: '#059669', bg: '#d1fae5', days: 0 };
    if (diffDays <= 7) return { label: `${diffDays}d`, color: '#2563eb', bg: '#dbeafe', days: diffDays };
    if (diffDays <= 30) return { label: `${Math.ceil(diffDays / 7)}w`, color: '#d97706', bg: '#fef3c7', days: diffDays };
    return { label: `${Math.ceil(diffDays / 30)}mo`, color: '#6b7280', bg: '#f3f4f6', days: diffDays };
  };

  // Hot candidates = Grade A/B + available within 2 weeks + has compliance
  const hotCandidates = useMemo(() => {
    return calls.filter(c => {
      const grade = c.quality_assessment?.toUpperCase();
      if (!['A', 'HIGH', 'B'].includes(grade || '')) return false;
      
      const avail = getAvailabilityStatus(c.earliest_start_date);
      if (!avail || avail.days > 14) return false;
      
      return true;
    }).slice(0, 5);
  }, [calls]);

  // Filtered calls
  const filteredCalls = useMemo(() => {
    let result = [...calls];

    // Grade filter
    if (gradeFilter !== 'all') {
      result = result.filter(c => {
        const grade = c.quality_assessment?.toUpperCase();
        if (gradeFilter === 'D') return ['D', 'F', 'LOW'].includes(grade || '');
        if (gradeFilter === 'A') return ['A', 'HIGH'].includes(grade || '');
        if (gradeFilter === 'C') return ['C', 'MEDIUM'].includes(grade || '');
        return grade === gradeFilter;
      });
    }

    // Availability filter
    if (availabilityFilter !== 'all') {
      result = result.filter(c => {
        const avail = getAvailabilityStatus(c.earliest_start_date);
        if (!avail) return false;
        if (availabilityFilter === 'immediate') return avail.days <= 0;
        if (availabilityFilter === 'week') return avail.days <= 7;
        if (availabilityFilter === 'month') return avail.days <= 30;
        return true;
      });
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(c => c.roles?.some(r => r.toLowerCase().includes(roleFilter.toLowerCase())));
    }

    // Compliance filter
    if (complianceFilter === 'driver') {
      result = result.filter(c => c.driver === 'Yes');
    } else if (complianceFilter === 'dbs') {
      result = result.filter(c => c.dbs_status && !c.dbs_status.toLowerCase().includes('no'));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.candidate_name?.toLowerCase().includes(q) ||
        c.phone_e164?.includes(q) ||
        c.call_summary?.toLowerCase().includes(q) ||
        c.experience_summary?.toLowerCase().includes(q) ||
        c.roles?.some(r => r.toLowerCase().includes(q))
      );
    }

    return result;
  }, [calls, gradeFilter, availabilityFilter, roleFilter, complianceFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: calls.length,
    gradeA: calls.filter(c => ['A', 'HIGH'].includes(c.quality_assessment?.toUpperCase() || '')).length,
    gradeB: calls.filter(c => c.quality_assessment?.toUpperCase() === 'B').length,
    gradeC: calls.filter(c => ['C', 'MEDIUM'].includes(c.quality_assessment?.toUpperCase() || '')).length,
    gradeD: calls.filter(c => ['D', 'F', 'LOW'].includes(c.quality_assessment?.toUpperCase() || '')).length,
    withDriver: calls.filter(c => c.driver === 'Yes').length,
    withDBS: calls.filter(c => c.dbs_status && !c.dbs_status.toLowerCase().includes('no')).length,
    immediateStart: calls.filter(c => {
      const avail = getAvailabilityStatus(c.earliest_start_date);
      return avail && avail.days <= 7;
    }).length,
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

  const formatFullDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        return { letter: 'A', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff', shadow: 'rgba(16, 185, 129, 0.3)', label: 'Excellent' };
      case 'B':
        return { letter: 'B', bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', shadow: 'rgba(59, 130, 246, 0.3)', label: 'Good' };
      case 'C': case 'MEDIUM':
        return { letter: 'C', bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: '#fff', shadow: 'rgba(245, 158, 11, 0.3)', label: 'Average' };
      case 'D': case 'F': case 'LOW':
        return { letter: 'D', bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', color: '#fff', shadow: 'rgba(239, 68, 68, 0.3)', label: 'Poor' };
      default:
        return { letter: '?', bg: 'var(--gray-200)', color: 'var(--gray-600)', shadow: 'none', label: 'Unknown' };
    }
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
      min-height: 100vh;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    }
    
    .cd-header {
      background: white;
      border-bottom: 1px solid var(--gray-200);
      padding: 24px 32px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .cd-header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .cd-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 800;
      color: var(--gray-900);
    }
    
    .cd-title-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: var(--primary-50);
      color: var(--primary);
      border-radius: var(--radius-full);
      font-size: 13px;
      font-weight: 700;
      margin-left: 12px;
    }
    
    .cd-search {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      background: var(--gray-50);
      border: 2px solid var(--gray-200);
      border-radius: var(--radius-xl);
      width: 400px;
      transition: all var(--transition-fast);
    }
    
    .cd-search:focus-within {
      border-color: var(--primary);
      background: white;
      box-shadow: 0 0 0 4px var(--primary-50);
    }
    
    .cd-search-icon { font-size: 20px; color: var(--gray-400); }
    .cd-search input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 15px;
      background: transparent;
    }
    
    .cd-stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .cd-stat {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      background: var(--gray-50);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all var(--transition-fast);
      border: 2px solid transparent;
    }
    
    .cd-stat:hover { background: var(--gray-100); }
    .cd-stat.active { border-color: var(--primary); background: var(--primary-50); }
    
    .cd-stat-value {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 800;
    }
    
    .cd-stat-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500);
    }
    
    .cd-stat.grade-a .cd-stat-value { color: #059669; }
    .cd-stat.grade-b .cd-stat-value { color: #2563eb; }
    .cd-stat.grade-c .cd-stat-value { color: #d97706; }
    .cd-stat.grade-d .cd-stat-value { color: #dc2626; }
    
    .cd-filters {
      display: flex;
      gap: 10px;
      padding: 16px 32px;
      background: white;
      border-bottom: 1px solid var(--gray-100);
      flex-wrap: wrap;
      align-items: center;
    }
    
    .cd-filter-select {
      padding: 10px 14px;
      border: 1px solid var(--gray-200);
      border-radius: var(--radius-lg);
      font-size: 13px;
      font-weight: 500;
      background: white;
      cursor: pointer;
      min-width: 140px;
    }
    
    .cd-filter-select:focus {
      outline: none;
      border-color: var(--primary);
    }
    
    .cd-filter-pills {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    
    .cd-filter-pill {
      padding: 8px 14px;
      border: none;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
      background: var(--gray-100);
      color: var(--gray-600);
    }
    
    .cd-filter-pill:hover { background: var(--gray-200); }
    .cd-filter-pill.active { background: var(--primary); color: white; }
    
    .cd-body {
      padding: 24px 32px;
    }
    
    /* Hot Candidates Section */
    .cd-hot {
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: var(--radius-2xl);
      padding: 24px;
      margin-bottom: 32px;
      border: 2px solid #fbbf24;
    }
    
    .cd-hot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    
    .cd-hot-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 800;
      color: #92400e;
    }
    
    .cd-hot-toggle {
      padding: 6px 12px;
      background: rgba(255,255,255,0.6);
      border: none;
      border-radius: var(--radius-md);
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
      cursor: pointer;
    }
    
    .cd-hot-grid {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      padding-bottom: 8px;
    }
    
    .cd-hot-card {
      flex: 0 0 280px;
      background: white;
      border-radius: var(--radius-xl);
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      cursor: pointer;
      transition: all var(--transition-normal);
    }
    
    .cd-hot-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    
    .cd-hot-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .cd-hot-avatar {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 16px;
    }
    
    .cd-hot-info { flex: 1; min-width: 0; }
    .cd-hot-name {
      font-weight: 700;
      font-size: 14px;
      color: var(--gray-900);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cd-hot-role {
      font-size: 12px;
      color: var(--gray-500);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .cd-hot-grade {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
    }
    
    .cd-hot-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    
    .cd-hot-tag {
      padding: 4px 8px;
      border-radius: var(--radius-md);
      font-size: 11px;
      font-weight: 600;
    }
    
    /* Main Cards Grid */
    .cd-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 20px;
    }
    
    .cd-card {
      background: white;
      border-radius: var(--radius-2xl);
      box-shadow: var(--shadow-card);
      overflow: hidden;
      transition: all var(--transition-normal);
    }
    
    .cd-card:hover {
      box-shadow: var(--shadow-lg);
    }
    
    .cd-card.expanded {
      grid-column: 1 / -1;
    }
    
    .cd-card-main {
      padding: 24px;
      cursor: pointer;
    }
    
    .cd-card-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .cd-avatar {
      width: 60px;
      height: 60px;
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 22px;
      flex-shrink: 0;
    }
    
    .cd-card-title {
      flex: 1;
      min-width: 0;
    }
    
    .cd-card-name {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .cd-card-phone {
      font-size: 14px;
      color: var(--gray-500);
      font-family: var(--font-mono);
      margin-bottom: 6px;
    }
    
    .cd-card-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 12px;
      color: var(--gray-400);
    }
    
    .cd-card-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .cd-grade-large {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-xl);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .cd-grade-letter {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 800;
      line-height: 1;
    }
    
    .cd-grade-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      opacity: 0.8;
    }
    
    /* Key Info Grid */
    .cd-key-info {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .cd-key-item {
      padding: 12px;
      background: var(--gray-50);
      border-radius: var(--radius-lg);
      text-align: center;
    }
    
    .cd-key-value {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 2px;
    }
    
    .cd-key-label {
      font-size: 11px;
      color: var(--gray-500);
      font-weight: 500;
    }
    
    .cd-key-item.highlight {
      background: #d1fae5;
    }
    .cd-key-item.highlight .cd-key-value { color: #059669; }
    
    .cd-key-item.warning {
      background: #fee2e2;
    }
    .cd-key-item.warning .cd-key-value { color: #dc2626; }
    
    /* Summary Section */
    .cd-summary {
      background: linear-gradient(135deg, var(--gray-50) 0%, var(--gray-100) 100%);
      border-radius: var(--radius-lg);
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .cd-summary-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--gray-500);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .cd-summary-text {
      font-size: 14px;
      color: var(--gray-700);
      line-height: 1.6;
    }
    
    /* Tags */
    .cd-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    
    .cd-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 600;
    }
    
    .cd-tag.role { background: var(--primary-50); color: var(--primary); }
    .cd-tag.driver { background: #d1fae5; color: #059669; }
    .cd-tag.dbs { background: #dbeafe; color: #2563eb; }
    .cd-tag.available { background: #fef3c7; color: #92400e; }
    .cd-tag.no { background: #fee2e2; color: #dc2626; }
    
    /* Energy Bar */
    .cd-energy {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .cd-energy-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--gray-500);
      min-width: 50px;
    }
    
    .cd-energy-bar {
      flex: 1;
      height: 10px;
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
      font-size: 20px;
      font-weight: 800;
      min-width: 40px;
      text-align: right;
    }
    
    /* Expanded Content */
    .cd-expanded {
      border-top: 1px solid var(--gray-100);
      padding: 24px;
      background: var(--gray-50);
    }
    
    .cd-expanded-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    
    .cd-expanded-section {
      background: white;
      border-radius: var(--radius-xl);
      padding: 20px;
    }
    
    .cd-expanded-title {
      font-family: var(--font-display);
      font-size: 14px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .cd-experience-text {
      font-size: 14px;
      color: var(--gray-600);
      line-height: 1.7;
    }
    
    .cd-follow-up-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .cd-follow-up-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid var(--gray-100);
      font-size: 13px;
      color: var(--gray-700);
    }
    
    .cd-follow-up-item:last-child { border-bottom: none; }
    
    .cd-follow-up-icon {
      width: 24px;
      height: 24px;
      background: var(--primary-50);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    
    /* Actions */
    .cd-actions {
      display: flex;
      gap: 10px;
      padding: 16px 24px;
      border-top: 1px solid var(--gray-100);
      background: white;
    }
    
    .cd-action-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border: none;
      border-radius: var(--radius-lg);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition-fast);
    }
    
    .cd-action-btn.call {
      background: #d1fae5;
      color: #059669;
    }
    .cd-action-btn.call:hover { background: #a7f3d0; }
    
    .cd-action-btn.whatsapp {
      background: #dcfce7;
      color: #16a34a;
    }
    .cd-action-btn.whatsapp:hover { background: #bbf7d0; }
    
    .cd-action-btn.transcript {
      background: var(--primary);
      color: white;
    }
    .cd-action-btn.transcript:hover { background: var(--primary-hover); }
    
    .cd-action-btn.expand {
      background: var(--gray-100);
      color: var(--gray-700);
    }
    .cd-action-btn.expand:hover { background: var(--gray-200); }
    
    /* Empty State */
    .cd-empty {
      text-align: center;
      padding: 80px 40px;
      background: white;
      border-radius: var(--radius-2xl);
    }
    
    .cd-empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.4; }
    .cd-empty-title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 8px;
    }
    .cd-empty-text { font-size: 14px; color: var(--gray-500); }
    
    /* Loading */
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
    
    @keyframes cdSpin { to { transform: rotate(360deg); } }
    
    /* Transcript Modal */
    .cd-modal-overlay {
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
    
    .cd-modal {
      background: white;
      border-radius: var(--radius-2xl);
      width: 100%;
      max-width: 800px;
      max-height: 85vh;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    
    .cd-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--gray-100);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .cd-modal-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 700;
    }
    
    .cd-modal-close {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: var(--gray-100);
      border-radius: var(--radius-lg);
      cursor: pointer;
      font-size: 20px;
      color: var(--gray-500);
    }
    
    .cd-modal-body {
      padding: 24px;
      max-height: calc(85vh - 140px);
      overflow-y: auto;
    }
    
    .cd-transcript-text {
      font-size: 15px;
      line-height: 2;
      color: var(--gray-700);
      white-space: pre-wrap;
    }
    
    .cd-results-count {
      font-size: 13px;
      color: var(--gray-500);
      margin-bottom: 16px;
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
        <div className="cd-header-top">
          <div>
            <h1 className="cd-title">
              Candidate Dashboard
              <span className="cd-title-badge">🤖 AI-Powered</span>
            </h1>
          </div>
          <div className="cd-search">
            <span className="cd-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, phone, role, or keywords..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        <div className="cd-stats">
          <div 
            className={`cd-stat ${gradeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setGradeFilter('all')}
          >
            <div className="cd-stat-value">{stats.total}</div>
            <div className="cd-stat-label">Total</div>
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
          <div style={{ width: 1, background: 'var(--gray-200)', margin: '0 8px' }} />
          <div 
            className={`cd-stat ${complianceFilter === 'driver' ? 'active' : ''}`}
            onClick={() => setComplianceFilter(complianceFilter === 'driver' ? 'all' : 'driver')}
          >
            <div className="cd-stat-value">🚗 {stats.withDriver}</div>
            <div className="cd-stat-label">Drivers</div>
          </div>
          <div 
            className={`cd-stat ${availabilityFilter === 'week' ? 'active' : ''}`}
            onClick={() => setAvailabilityFilter(availabilityFilter === 'week' ? 'all' : 'week')}
          >
            <div className="cd-stat-value">⚡ {stats.immediateStart}</div>
            <div className="cd-stat-label">Start Soon</div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="cd-filters">
        <select 
          className="cd-filter-select"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          {allRoles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        
        <select 
          className="cd-filter-select"
          value={availabilityFilter}
          onChange={e => setAvailabilityFilter(e.target.value as AvailabilityFilter)}
        >
          <option value="all">Any Availability</option>
          <option value="immediate">🟢 Immediate</option>
          <option value="week">⚡ Within 1 Week</option>
          <option value="month">📅 Within 1 Month</option>
        </select>
        
        <select 
          className="cd-filter-select"
          value={complianceFilter}
          onChange={e => setComplianceFilter(e.target.value as 'all' | 'driver' | 'dbs')}
        >
          <option value="all">Any Compliance</option>
          <option value="driver">🚗 Drivers Only</option>
          <option value="dbs">🔒 DBS Checked</option>
        </select>
        
        {(gradeFilter !== 'all' || availabilityFilter !== 'all' || roleFilter !== 'all' || complianceFilter !== 'all' || searchQuery) && (
          <button
            className="cd-filter-pill"
            onClick={() => {
              setGradeFilter('all');
              setAvailabilityFilter('all');
              setRoleFilter('all');
              setComplianceFilter('all');
              setSearchQuery('');
            }}
          >
            ✕ Clear Filters
          </button>
        )}
        
        <div className="cd-filter-pills">
          <span style={{ fontSize: 12, color: 'var(--gray-500)', marginRight: 8 }}>
            {filteredCalls.length} of {calls.length} candidates
          </span>
        </div>
      </div>
      
      <div className="cd-body">
        {/* Hot Candidates */}
        {hotCandidates.length > 0 && showHotCandidates && gradeFilter === 'all' && !searchQuery && (
          <div className="cd-hot">
            <div className="cd-hot-header">
              <div className="cd-hot-title">
                <span>🔥</span> Hot Candidates
                <span style={{ fontSize: 13, fontWeight: 500, color: '#b45309' }}>
                  — Grade A/B, available within 2 weeks
                </span>
              </div>
              <button className="cd-hot-toggle" onClick={() => setShowHotCandidates(false)}>
                Hide
              </button>
            </div>
            <div className="cd-hot-grid">
              {hotCandidates.map(call => {
                const gradeConfig = getGradeConfig(call.quality_assessment);
                const avail = getAvailabilityStatus(call.earliest_start_date);
                return (
                  <div 
                    key={call.id} 
                    className="cd-hot-card"
                    onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                  >
                    <div className="cd-hot-card-header">
                      <div className="cd-hot-avatar" style={{ background: getAvatarColor(call.candidate_name || '') }}>
                        {(call.candidate_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="cd-hot-info">
                        <div className="cd-hot-name">{call.candidate_name}</div>
                        <div className="cd-hot-role">{call.roles?.[0] || 'Care Role'}</div>
                      </div>
                      <div 
                        className="cd-hot-grade"
                        style={{ background: gradeConfig.bg, color: gradeConfig.color }}
                      >
                        {gradeConfig.letter}
                      </div>
                    </div>
                    <div className="cd-hot-tags">
                      {avail && (
                        <span className="cd-hot-tag" style={{ background: avail.bg, color: avail.color }}>
                          📅 {avail.label}
                        </span>
                      )}
                      {call.driver === 'Yes' && (
                        <span className="cd-hot-tag" style={{ background: '#d1fae5', color: '#059669' }}>
                          🚗 Driver
                        </span>
                      )}
                      {call.energy_score && call.energy_score >= 7 && (
                        <span className="cd-hot-tag" style={{ background: '#dbeafe', color: '#2563eb' }}>
                          ⚡ {call.energy_score}/10
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Results */}
        {filteredCalls.length === 0 ? (
          <div className="cd-empty">
            <div className="cd-empty-icon">📞</div>
            <div className="cd-empty-title">No candidates found</div>
            <div className="cd-empty-text">
              {searchQuery 
                ? `No results for "${searchQuery}". Try a different search.`
                : 'Try adjusting your filters or make some calls to populate this dashboard.'
              }
            </div>
          </div>
        ) : (
          <div className="cd-grid">
            {filteredCalls.map(call => {
              const gradeConfig = getGradeConfig(call.quality_assessment);
              const avail = getAvailabilityStatus(call.earliest_start_date);
              const energyPct = call.energy_score ? (call.energy_score / 10) * 100 : 0;
              const energyColor = call.energy_score 
                ? call.energy_score >= 7 ? '#059669' : call.energy_score >= 5 ? '#2563eb' : call.energy_score >= 3 ? '#d97706' : '#dc2626'
                : '#9ca3af';
              const isExpanded = expandedId === call.id;
              
              return (
                <div key={call.id} className={`cd-card ${isExpanded ? 'expanded' : ''}`}>
                  <div className="cd-card-main" onClick={() => setExpandedId(isExpanded ? null : call.id)}>
                    <div className="cd-card-header">
                      <div className="cd-avatar" style={{ background: getAvatarColor(call.candidate_name || '') }}>
                        {(call.candidate_name || '?')[0].toUpperCase()}
                      </div>
                      <div className="cd-card-title">
                        <div className="cd-card-name">
                          {call.candidate_name}
                          {avail && avail.days <= 7 && (
                            <span style={{ 
                              fontSize: 11, 
                              padding: '2px 8px', 
                              background: avail.bg, 
                              color: avail.color,
                              borderRadius: 'var(--radius-full)',
                              fontWeight: 600
                            }}>
                              ⚡ {avail.label}
                            </span>
                          )}
                        </div>
                        <div className="cd-card-phone">{formatPhone(call.phone_e164)}</div>
                        <div className="cd-card-meta">
                          <span className="cd-card-meta-item">📞 {formatDate(call.call_time)}</span>
                          <span className="cd-card-meta-item">⏱️ {formatDuration(call.duration_ms)}</span>
                          {call.direction && (
                            <span className="cd-card-meta-item">
                              {call.direction === 'inbound' ? '📥' : '📤'} {call.direction}
                            </span>
                          )}
                        </div>
                      </div>
                      <div 
                        className="cd-grade-large"
                        style={{ 
                          background: gradeConfig.bg, 
                          color: gradeConfig.color,
                          boxShadow: `0 4px 12px ${gradeConfig.shadow}`
                        }}
                      >
                        <span className="cd-grade-letter">{gradeConfig.letter}</span>
                        <span className="cd-grade-label">{gradeConfig.label}</span>
                      </div>
                    </div>
                    
                    {/* Key Info */}
                    <div className="cd-key-info">
                      <div className={`cd-key-item ${call.driver === 'Yes' ? 'highlight' : call.driver === 'No' ? 'warning' : ''}`}>
                        <div className="cd-key-value">{call.driver === 'Yes' ? '✓' : call.driver === 'No' ? '✗' : '?'}</div>
                        <div className="cd-key-label">🚗 Driver</div>
                      </div>
                      <div className={`cd-key-item ${call.dbs_status && !call.dbs_status.toLowerCase().includes('no') ? 'highlight' : ''}`}>
                        <div className="cd-key-value">{call.dbs_status ? (call.dbs_status.toLowerCase().includes('no') ? '✗' : '✓') : '?'}</div>
                        <div className="cd-key-label">🔒 DBS</div>
                      </div>
                      <div className="cd-key-item">
                        <div className="cd-key-value">{avail ? avail.label : '?'}</div>
                        <div className="cd-key-label">📅 Start</div>
                      </div>
                    </div>
                    
                    {/* Summary */}
                    {call.call_summary && (
                      <div className="cd-summary">
                        <div className="cd-summary-title">
                          <span>💬</span> Call Summary
                        </div>
                        <div className="cd-summary-text">{call.call_summary}</div>
                      </div>
                    )}
                    
                    {/* Tags */}
                    <div className="cd-tags">
                      {call.roles?.slice(0, 3).map((role, i) => (
                        <span key={i} className="cd-tag role">{role}</span>
                      ))}
                      {call.weekly_rota && (
                        <span className="cd-tag available">🕐 {call.weekly_rota}</span>
                      )}
                    </div>
                    
                    {/* Energy */}
                    <div className="cd-energy">
                      <span className="cd-energy-label">Energy</span>
                      <div className="cd-energy-bar">
                        <div 
                          className="cd-energy-fill"
                          style={{ 
                            width: `${energyPct}%`,
                            background: `linear-gradient(90deg, ${energyColor} 0%, ${energyColor}88 100%)`
                          }}
                        />
                      </div>
                      <span className="cd-energy-score" style={{ color: energyColor }}>
                        {call.energy_score || '—'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="cd-expanded">
                      <div className="cd-expanded-grid">
                        {/* Experience */}
                        <div className="cd-expanded-section">
                          <div className="cd-expanded-title">
                            <span>📋</span> Experience & Background
                          </div>
                          <div className="cd-experience-text">
                            {call.experience_summary || 'No experience summary extracted from this call.'}
                          </div>
                        </div>
                        
                        {/* Follow-up Actions */}
                        <div className="cd-expanded-section">
                          <div className="cd-expanded-title">
                            <span>✅</span> Follow-up Actions
                          </div>
                          {call.follow_up_questions && call.follow_up_questions.length > 0 ? (
                            <ul className="cd-follow-up-list">
                              {call.follow_up_questions.map((item, i) => (
                                <li key={i} className="cd-follow-up-item">
                                  <span className="cd-follow-up-icon">📌</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                              No specific follow-up actions identified.
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Full Details */}
                      <div className="cd-expanded-section" style={{ marginTop: 16 }}>
                        <div className="cd-expanded-title">
                          <span>📊</span> Full Details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Call Type</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{call.call_type || 'Screening'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Full Call Time</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{formatFullDate(call.call_time)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Hours/Rota</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{call.weekly_rota || 'Not discussed'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Start Date</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              {call.earliest_start_date 
                                ? new Date(call.earliest_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Not discussed'
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="cd-actions">
                    <button 
                      className="cd-action-btn call"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        window.location.href = `tel:${call.phone_e164}`; 
                      }}
                    >
                      📞 Call
                    </button>
                    <button 
                      className="cd-action-btn whatsapp"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        window.open(`https://wa.me/${call.phone_e164?.replace(/\D/g, '')}`, '_blank'); 
                      }}
                    >
                      💬 WhatsApp
                    </button>
                    {call.transcript && (
                      <button 
                        className="cd-action-btn transcript"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setShowTranscript(call.id); 
                        }}
                      >
                        📝 Transcript
                      </button>
                    )}
                    <button 
                      className="cd-action-btn expand"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setExpandedId(isExpanded ? null : call.id); 
                      }}
                    >
                      {isExpanded ? '▲ Less' : '▼ More'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Transcript Modal */}
      {showTranscript && (
        <div className="cd-modal-overlay" onClick={() => setShowTranscript(null)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <span className="cd-modal-title">
                📝 Full Transcript — {calls.find(c => c.id === showTranscript)?.candidate_name}
              </span>
              <button className="cd-modal-close" onClick={() => setShowTranscript(null)}>×</button>
            </div>
            <div className="cd-modal-body">
              <div className="cd-transcript-text">
                {calls.find(c => c.id === showTranscript)?.transcript || 'No transcript available.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
