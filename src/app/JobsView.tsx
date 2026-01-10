'use client';
import { useState } from 'react';
import { updateJob, deleteJob } from './db';
import StatusBadge from './StatusBadge';
import Avatar, { AvatarGroup } from './Avatar';
import Dropdown from './Dropdown';
import Button from './Button';

interface Props {
  jobs: any[];
  candidates: any[];
  onUpdate: () => void;
  onCreateJob: () => void;
}

export default function JobsView({ jobs, candidates, onUpdate, onCreateJob }: Props) {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed' | 'draft'>('all');

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  const getCandidateCount = (jobId: string) => candidates.filter(c => c.job_id === jobId).length;
  const getJobCandidates = (jobId: string) => candidates.filter(c => c.job_id === jobId).slice(0, 5);

  const handleStatusChange = async (jobId: string, status: string) => {
    try {
      await updateJob(jobId, { status });
      onUpdate();
    } catch (err) {
      console.error('Failed to update job:', err);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;
    try {
      await deleteJob(jobId);
      onUpdate();
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
  const fmtSalary = (min?: number, max?: number, type?: string) => {
    if (!min && !max) return 'Competitive';
    const fmt = (n: number) => n >= 1000 ? `£${(n/1000).toFixed(0)}k` : `£${n}`;
    const suffix = type === 'hourly' ? '/hr' : type === 'daily' ? '/day' : '/yr';
    if (min && max) return `${fmt(min)} - ${fmt(max)}${suffix}`;
    if (min) return `From ${fmt(min)}${suffix}`;
    return `Up to ${fmt(max!)}${suffix}`;
  };

  return (
    <div style={{ padding: 24 }}>
      <style>{`
        .jobs-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
        .jobs-filters{display:flex;gap:8px}
        .jobs-filter{padding:8px 16px;font-size:12px;font-weight:600;border:1px solid #e5e7eb;border-radius:20px;background:#fff;cursor:pointer;transition:all .15s}
        .jobs-filter:hover{border-color:#d1d5db}
        .jobs-filter.active{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .jobs-view-toggle{display:flex;background:#f3f4f6;border-radius:8px;padding:3px}
        .jobs-view-btn{padding:6px 12px;font-size:12px;border:none;background:none;cursor:pointer;border-radius:6px;transition:all .15s}
        .jobs-view-btn.active{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08)}
        .jobs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:20px}
        .job-card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;transition:all .2s}
        .job-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.08);transform:translateY(-2px)}
        .job-card-header{padding:20px;border-bottom:1px solid #f3f4f6}
        .job-card-top{display:flex;justify-content:space-between;align-items:start;margin-bottom:12px}
        .job-card-title{font-size:16px;font-weight:700;color:#111;margin-bottom:4px}
        .job-card-dept{font-size:13px;color:#6b7280}
        .job-card-menu{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:none;border-radius:8px;cursor:pointer;transition:all .15s}
        .job-card-menu:hover{background:#e5e7eb}
        .job-card-meta{display:flex;flex-wrap:wrap;gap:8px}
        .job-card-tag{display:flex;align-items:center;gap:4px;padding:4px 10px;background:#f3f4f6;border-radius:6px;font-size:11px;font-weight:500;color:#6b7280}
        .job-card-body{padding:20px}
        .job-card-stat{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6}
        .job-card-stat:last-child{border-bottom:none}
        .job-card-stat-label{font-size:12px;color:#6b7280}
        .job-card-stat-value{font-size:13px;font-weight:600;color:#111}
        .job-card-candidates{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:16px;border-top:1px solid #f3f4f6}
        .job-card-candidates-label{font-size:12px;color:#6b7280}
        .job-card-footer{padding:16px 20px;background:#fafbfc;border-top:1px solid #f3f4f6;display:flex;gap:8px}
        .job-card-btn{flex:1;padding:10px;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;border:none;transition:all .15s}
        .job-card-btn.primary{background:#4f46e5;color:#fff}
        .job-card-btn.primary:hover{background:#4338ca}
        .job-card-btn.secondary{background:#fff;color:#374151;border:1px solid #e5e7eb}
        .job-card-btn.secondary:hover{background:#f3f4f6}
        .jobs-empty{text-align:center;padding:80px 20px}
        .jobs-empty-icon{font-size:64px;margin-bottom:16px;opacity:.4}
        .jobs-empty-title{font-size:18px;font-weight:600;color:#111;margin-bottom:8px}
        .jobs-empty-text{font-size:14px;color:#6b7280;margin-bottom:24px}
      `}</style>

      <div className="jobs-header">
        <div className="jobs-filters">
          {['all', 'open', 'closed', 'draft'].map(f => (
            <button 
              key={f}
              className={`jobs-filter ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f as any)}
            >
              {f === 'all' ? 'All Jobs' : f.charAt(0).toUpperCase() + f.slice(1)} 
              {f !== 'all' && ` (${jobs.filter(j => j.status === f).length})`}
            </button>
          ))}
        </div>
        <div className="jobs-view-toggle">
          <button className={`jobs-view-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>▦</button>
          <button className={`jobs-view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>☰</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="jobs-empty">
          <div className="jobs-empty-icon">💼</div>
          <div className="jobs-empty-title">No jobs found</div>
          <div className="jobs-empty-text">
            {filter === 'all' ? "Create your first job to start attracting candidates" : `No ${filter} jobs at the moment`}
          </div>
          <Button variant="primary" icon="+" onClick={onCreateJob}>Create Job</Button>
        </div>
      ) : (
        <div className="jobs-grid">
          {filtered.map(job => {
            const candidateCount = getCandidateCount(job.id);
            const jobCandidates = getJobCandidates(job.id);
            return (
              <div key={job.id} className="job-card">
                <div className="job-card-header">
                  <div className="job-card-top">
                    <div>
                      <div className="job-card-title">{job.title}</div>
                      <div className="job-card-dept">{job.department || 'No department'}</div>
                    </div>
                    <Dropdown
                      trigger={<button className="job-card-menu">⋮</button>}
                      align="right"
                      items={[
                        { id: 'edit', label: 'Edit Job', icon: '✏️' },
                        { id: 'duplicate', label: 'Duplicate', icon: '📋' },
                        { id: 'divider', label: '', divider: true },
                        ...(job.status !== 'open' ? [{ id: 'open', label: 'Publish Job', icon: '🚀' }] : []),
                        ...(job.status === 'open' ? [{ id: 'closed', label: 'Close Job', icon: '🔒' }] : []),
                        { id: 'divider2', label: '', divider: true },
                        { id: 'delete', label: 'Delete Job', icon: '🗑️', danger: true },
                      ]}
                      onSelect={id => {
                        if (id === 'open' || id === 'closed') handleStatusChange(job.id, id);
                        else if (id === 'delete') handleDelete(job.id);
                      }}
                    />
                  </div>
                  <div className="job-card-meta">
                    <StatusBadge status={job.status} size="sm" />
                    <span className="job-card-tag">📍 {job.location || 'Remote'}</span>
                    <span className="job-card-tag">⏰ {job.type || 'Full-time'}</span>
                  </div>
                </div>
                <div className="job-card-body">
                  <div className="job-card-stat">
                    <span className="job-card-stat-label">Salary</span>
                    <span className="job-card-stat-value">{fmtSalary(job.salary_min, job.salary_max, job.salary_type)}</span>
                  </div>
                  <div className="job-card-stat">
                    <span className="job-card-stat-label">Posted</span>
                    <span className="job-card-stat-value">{fmtDate(job.published_at || job.created_at)}</span>
                  </div>
                  <div className="job-card-candidates">
                    <span className="job-card-candidates-label">{candidateCount} candidate{candidateCount !== 1 ? 's' : ''}</span>
                    {jobCandidates.length > 0 && (
                      <AvatarGroup max={4}>
                        {jobCandidates.map(c => <Avatar key={c.id} name={c.name} size="sm" />)}
                      </AvatarGroup>
                    )}
                  </div>
                </div>
                <div className="job-card-footer">
                  <button className="job-card-btn secondary">View Details</button>
                  <button className="job-card-btn primary">View Candidates</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
