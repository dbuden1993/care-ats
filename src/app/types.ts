// Core types for the ATS

export interface Candidate {
  id: string;
  name: string | null;
  phone_e164: string;
  status: string;
  roles?: string;
  experience_summary?: string;
  driver?: string;
  dbs_update_service?: string;
  mandatory_training?: string;
  earliest_start_date?: string;
  energy_ratio?: number | null;
  last_called_at?: string;
  created_at?: string;
  updated_at?: string;
  job_id?: string;
  source?: string;
  tags?: string[];
}

export interface Call {
  id: string;
  candidate_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  direction: 'inbound' | 'outbound';
  outcome?: string;
  transcript?: string;
  call_summary?: string;
  energy_score?: number;
  follow_up_needed?: boolean;
}

export interface Job {
  id: string;
  title: string;
  department?: string;
  location?: string;
  type: 'full-time' | 'part-time' | 'contract' | 'zero-hours';
  status: 'draft' | 'open' | 'paused' | 'closed' | 'filled';
  description?: string;
  requirements?: string;
  salary_min?: number;
  salary_max?: number;
  salary_type?: 'hourly' | 'annual';
  hiring_manager_id?: string;
  created_at: string;
  published_at?: string;
  closed_at?: string;
  candidates_count?: number;
}

export interface Interview {
  id: string;
  candidate_id: string;
  job_id?: string;
  scheduled_at: string;
  duration_minutes: number;
  type: 'phone' | 'video' | 'in-person';
  location?: string;
  video_link?: string;
  interviewers: string[];
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at: string;
}

export interface Note {
  id: string;
  candidate_id: string;
  author_name: string;
  content: string;
  is_private: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  candidate_id: string;
  name: string;
  type: 'cv' | 'cover_letter' | 'id' | 'certificate' | 'reference' | 'other';
  url: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface Scorecard {
  id: string;
  candidate_id: string;
  interview_id?: string;
  reviewer_name: string;
  scores: { criteria: string; score: number; weight: number }[];
  recommendation: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no';
  overall_notes?: string;
  submitted_at: string;
}

export interface Activity {
  id: string;
  candidate_id: string;
  type: string;
  description: string;
  metadata?: Record<string, any>;
  created_by?: string;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  is_terminal?: boolean;
  auto_actions?: { type: string; config: any }[];
}

export interface Pipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'application' | 'interview' | 'rejection' | 'offer' | 'general';
  variables: string[];
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger_type: 'new_application' | 'stage_change' | 'time_in_stage' | 'interview_scheduled' | 'interview_completed' | 'offer_accepted';
  trigger_config: Record<string, any>;
  actions: { type: string; config: any }[];
  runs: number;
  last_run?: string;
}

export type ViewMode = 'list' | 'kanban' | 'calendar';
export type SidebarSection = 'dashboard' | 'candidates' | 'jobs' | 'interviews' | 'talent-pools' | 'referrals' | 'onboarding' | 'reports' | 'surveys' | 'templates' | 'automations' | 'compliance' | 'settings';
