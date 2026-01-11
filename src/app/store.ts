// Mock data store - replace with Supabase in production
import type { Job, Pipeline, PipelineStage, EmailTemplate, Automation, Interview, Note, Document } from './types';

// Default pipeline stages
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'new', name: 'New', order: 0, color: '#6366f1', is_terminal: false },
  { id: 'screening', name: 'Screening', order: 1, color: '#8b5cf6', is_terminal: false },
  { id: 'interview', name: 'Interview', order: 2, color: '#f59e0b', is_terminal: false },
  { id: 'offer', name: 'Offer', order: 3, color: '#10b981', is_terminal: false },
  { id: 'hired', name: 'Hired', order: 4, color: '#059669', is_terminal: true },
  { id: 'rejected', name: 'Rejected', order: 5, color: '#ef4444', is_terminal: true },
];

export const DEFAULT_PIPELINE: Pipeline = {
  id: 'default',
  name: 'Standard Hiring',
  stages: DEFAULT_STAGES,
};

// Sample jobs
export const SAMPLE_JOBS: Job[] = [
  {
    id: 'job-1',
    title: 'Care Assistant',
    department: 'Care Services',
    location: 'London',
    type: 'full-time',
    status: 'open',
    description: 'We are looking for a compassionate Care Assistant to join our team...',
    requirements: '- NVQ Level 2 in Health & Social Care\n- Valid DBS check\n- Driving license preferred',
    salary_min: 11,
    salary_max: 13,
    salary_type: 'hourly',
    created_at: '2024-01-15T10:00:00Z',
    published_at: '2024-01-16T09:00:00Z',
    hiring_manager_id: 'user-1',
    candidates_count: 24,
  },
  {
    id: 'job-2',
    title: 'Senior Carer',
    department: 'Care Services',
    location: 'Manchester',
    type: 'full-time',
    status: 'open',
    description: 'Experienced Senior Carer needed to lead our care team...',
    requirements: '- NVQ Level 3 in Health & Social Care\n- 3+ years experience\n- Leadership skills',
    salary_min: 14,
    salary_max: 16,
    salary_type: 'hourly',
    created_at: '2024-01-20T10:00:00Z',
    published_at: '2024-01-21T09:00:00Z',
    hiring_manager_id: 'user-1',
    candidates_count: 12,
  },
  {
    id: 'job-3',
    title: 'Night Support Worker',
    department: 'Residential',
    location: 'Birmingham',
    type: 'part-time',
    status: 'open',
    description: 'Night Support Worker for our residential care home...',
    requirements: '- Experience in residential care\n- Flexible availability\n- DBS required',
    salary_min: 12,
    salary_max: 14,
    salary_type: 'hourly',
    created_at: '2024-01-25T10:00:00Z',
    published_at: '2024-01-26T09:00:00Z',
    hiring_manager_id: 'user-2',
    candidates_count: 8,
  },
];

// Email templates
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Application Received',
    subject: 'Thank you for your application - {{job_title}}',
    body: `Hi {{candidate_name}},

Thank you for applying for the {{job_title}} position at {{company_name}}.

We have received your application and will review it shortly. If your qualifications match our requirements, we will be in touch to discuss next steps.

Best regards,
{{sender_name}}
{{company_name}}`,
    category: 'application',
    variables: ['candidate_name', 'job_title', 'company_name', 'sender_name'],

  },
  {
    id: 'tpl-2',
    name: 'Interview Invitation',
    subject: 'Interview Invitation - {{job_title}}',
    body: `Hi {{candidate_name}},

Great news! We would like to invite you for an interview for the {{job_title}} position.

Date: {{interview_date}}
Time: {{interview_time}}
Location: {{interview_location}}

Please confirm your attendance by replying to this email.

Best regards,
{{sender_name}}`,
    category: 'interview',
    variables: ['candidate_name', 'job_title', 'interview_date', 'interview_time', 'interview_location', 'sender_name'],

  },
  {
    id: 'tpl-3',
    name: 'Rejection - After Screening',
    subject: 'Update on your application - {{job_title}}',
    body: `Hi {{candidate_name}},

Thank you for your interest in the {{job_title}} position at {{company_name}}.

After careful consideration, we have decided not to move forward with your application at this time. We encourage you to apply for future positions that match your skills.

We wish you the best in your job search.

Best regards,
{{sender_name}}`,
    category: 'rejection',
    variables: ['candidate_name', 'job_title', 'company_name', 'sender_name'],

  },
  {
    id: 'tpl-4',
    name: 'Job Offer',
    subject: 'Job Offer - {{job_title}} at {{company_name}}',
    body: `Hi {{candidate_name}},

We are delighted to offer you the position of {{job_title}} at {{company_name}}!

Salary: {{salary}}
Start Date: {{start_date}}
Employment Type: {{employment_type}}

Please review the attached offer letter and let us know your decision within 5 working days.

We look forward to welcoming you to the team!

Best regards,
{{sender_name}}`,
    category: 'offer',
    variables: ['candidate_name', 'job_title', 'company_name', 'salary', 'start_date', 'employment_type', 'sender_name'],

  },
  {
    id: 'tpl-5',
    name: 'Document Request',
    subject: 'Documents Required - {{job_title}}',
    body: `Hi {{candidate_name}},

As part of the application process for {{job_title}}, we need the following documents:

- Proof of ID (passport or driving license)
- Proof of address
- Right to work documentation
- DBS certificate (if available)

Please upload these documents at your earliest convenience.

Best regards,
{{sender_name}}`,
    category: 'general',
    variables: ['candidate_name', 'job_title', 'sender_name'],

  },
  {
    id: 'tpl-6',
    name: 'Interview Reminder',
    subject: 'Reminder: Interview Tomorrow - {{job_title}}',
    body: `Hi {{candidate_name}},

This is a friendly reminder about your interview tomorrow:

Position: {{job_title}}
Date: {{interview_date}}
Time: {{interview_time}}
Location: {{interview_location}}

Please arrive 10 minutes early and bring a valid ID.

See you soon!
{{sender_name}}`,
    category: 'interview',
    variables: ['candidate_name', 'job_title', 'interview_date', 'interview_time', 'interview_location', 'sender_name'],

  },
];

// Sample automation rules
export const AUTOMATION_RULES: Automation[] = [
  {
    id: 'auto-1',
    name: 'Send confirmation on application',
    is_active: true,
    trigger: { type: 'new_application', config: {} },
    conditions: [],
    actions: [{ type: 'send_email', config: { template_id: 'tpl-1' } }],

  },
  {
    id: 'auto-2',
    name: 'Notify team on interview stage',
    is_active: true,
    trigger: { type: 'stage_change', config: { to_stage: 'interview' } },
    conditions: [],
    actions: [{ type: 'notify_team', config: { message: 'Candidate moved to interview stage' } }],

  },
  {
    id: 'auto-3',
    name: 'Auto-reject after 14 days in screening',
    is_active: false,
    trigger: { type: 'time_in_stage', config: { stage: 'screening', days: 14 } },
    conditions: [],
    actions: [
      { type: 'send_email', config: { template_id: 'tpl-3' } },
      { type: 'move_stage', config: { to_stage: 'rejected' } },
    ],

  },
];

// Sample interviews
export const SAMPLE_INTERVIEWS: Interview[] = [
  {
    id: 'int-1',
    candidate_id: 'cand-1',
    job_id: 'job-1',
    stage_id: 'interview',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    duration_minutes: 30,
    type: 'video',
    location: null,
    video_link: 'https://meet.google.com/abc-defg-hij',
    interviewers: ['John Doe'],
    status: 'scheduled',
    notes: null,
    scorecard_id: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'int-2',
    candidate_id: 'cand-2',
    job_id: 'job-1',
    stage_id: 'interview',
    scheduled_at: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
    duration_minutes: 45,
    type: 'in-person',
    location: 'Office - Meeting Room 2',
    video_link: null,
    interviewers: ['John Doe', 'Jane Smith'],
    status: 'scheduled',
    notes: null,
    scorecard_id: null,
    created_at: new Date().toISOString(),
  },
];

// Report metrics calculator
export function calculateMetrics(candidates: any[]): any {
  const total = candidates.length;
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  
  candidates.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    const source = c.source || 'Direct';
    bySource[source] = (bySource[source] || 0) + 1;
  });
  
  const hired = candidates.filter(c => c.status === 'hired');
  const avgTimeToHire = hired.length > 0 
    ? hired.reduce((sum, c) => {
        const created = new Date(c.created_at).getTime();
        const hiredAt = c.hired_at ? new Date(c.hired_at).getTime() : Date.now();
        return sum + (hiredAt - created);
      }, 0) / hired.length / 86400000 // Convert to days
    : 0;
  
  return {
    total_candidates: total,
    candidates_by_status: byStatus,
    candidates_by_source: bySource,
    avg_time_to_hire: Math.round(avgTimeToHire),
    pipeline_conversion: [
      { stage: 'New', count: byStatus['new'] || 0, rate: 100 },
      { stage: 'Screening', count: byStatus['screening'] || 0, rate: Math.round(((byStatus['screening'] || 0) / total) * 100) },
      { stage: 'Interview', count: byStatus['interview'] || 0, rate: Math.round(((byStatus['interview'] || 0) / total) * 100) },
      { stage: 'Offer', count: byStatus['offer'] || 0, rate: Math.round(((byStatus['offer'] || 0) / total) * 100) },
      { stage: 'Hired', count: byStatus['hired'] || 0, rate: Math.round(((byStatus['hired'] || 0) / total) * 100) },
    ],
    interviews_scheduled: SAMPLE_INTERVIEWS.filter(i => i.status === 'scheduled').length,
    offers_sent: byStatus['offer'] || 0,
    offers_accepted: byStatus['hired'] || 0,
  };
}
