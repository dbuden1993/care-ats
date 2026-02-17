import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY || '',
});

// ─── Tool definitions ────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'search_candidates',
    description: 'Search and filter candidates in the database. Use this to find candidates by name, status, source, or recency of contact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Partial name to search for (case-insensitive)' },
        status: {
          type: 'array',
          items: { type: 'string', enum: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
          description: 'Filter by one or more statuses'
        },
        source: { type: 'string', description: 'Source: whatsapp, dialpad, import, etc.' },
        days_no_contact: { type: 'number', description: 'Candidates not contacted in this many days' },
        has_messages: { type: 'boolean', description: 'Only candidates who have WhatsApp messages' },
        limit: { type: 'number', description: 'Max results to return (default 20, max 50)' },
      },
      required: [],
    },
  },
  {
    name: 'get_candidate_detail',
    description: 'Get full profile of a specific candidate including their recent WhatsApp messages, calls, and AI intelligence summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        candidate_id: { type: 'string', description: 'UUID of the candidate' },
      },
      required: ['candidate_id'],
    },
  },
  {
    name: 'get_whatsapp_inbox',
    description: 'Get the current WhatsApp inbox — messages from candidates in the last 48 hours grouped by urgency.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_pipeline_stats',
    description: 'Get overall recruitment pipeline statistics — candidate counts by status, recent activity, and unactioned messages.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'match_candidates_for_role',
    description: 'Find and rank candidates who match a specific job or care package requirement. Use this when the recruiter describes a role or package and wants to know who to contact. Returns ranked matches based on qualifications, availability, and engagement.',
    input_schema: {
      type: 'object' as const,
      properties: {
        role_description: { type: 'string', description: 'Free-text description of the role or package, e.g. "home carer in Birmingham, weekends, needs driver licence and DBS"' },
        requires_driver: { type: 'boolean', description: 'Must have driver licence' },
        requires_dbs: { type: 'boolean', description: 'Must have DBS check' },
        requires_training: { type: 'boolean', description: 'Must have mandatory training' },
        preferred_status: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred pipeline statuses to look in, e.g. ["new", "screening"]'
        },
        limit: { type: 'number', description: 'Max candidates to return (default 15)' },
      },
      required: ['role_description'],
    },
  },
];

// ─── Tool implementations ────────────────────────────────────────────────────

async function searchCandidates(filters: {
  name?: string;
  status?: string[];
  source?: string;
  days_no_contact?: number;
  has_messages?: boolean;
  limit?: number;
}) {
  let query = supabase
    .from('candidates')
    .select('id, name, phone_e164, status, source, last_called_at, created_at, roles, driver, dbs_update_service')
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit || 20, 50));

  if (filters.name) {
    query = query.ilike('name', `%${filters.name}%`);
  }
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  if (filters.source) {
    query = query.eq('source', filters.source);
  }
  if (filters.days_no_contact) {
    const cutoff = new Date(Date.now() - filters.days_no_contact * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`last_called_at.lt.${cutoff},last_called_at.is.null`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };

  let candidates = data || [];

  if (filters.has_messages) {
    const { data: withMsgs } = await supabase
      .from('whatsapp_messages')
      .select('candidate_id')
      .not('candidate_id', 'is', null);
    const ids = new Set((withMsgs || []).map((m: { candidate_id: string }) => m.candidate_id));
    candidates = candidates.filter(c => ids.has(c.id));
  }

  return {
    count: candidates.length,
    candidates: candidates.map(c => ({
      id: c.id,
      name: c.name || 'Unknown',
      phone: c.phone_e164,
      status: c.status,
      source: c.source,
      last_contacted: c.last_called_at || null,
      days_since_contact: c.last_called_at
        ? Math.floor((Date.now() - new Date(c.last_called_at).getTime()) / 86400000)
        : null,
      roles: c.roles,
      driver: c.driver,
      dbs: c.dbs_update_service,
    })),
  };
}

async function getCandidateDetail(candidateId: string) {
  const [candidateRes, messagesRes, callsRes, intelligenceRes] = await Promise.all([
    supabase.from('candidates').select('*').eq('id', candidateId).single(),
    supabase
      .from('whatsapp_messages')
      .select('direction, message_text, captured_at, ai_intent, ai_sentiment, ai_suggested_action')
      .eq('candidate_id', candidateId)
      .order('captured_at', { ascending: false })
      .limit(20),
    supabase
      .from('call_history')
      .select('called_at, duration_seconds, transcript_summary, ai_intent, disposition')
      .eq('candidate_id', candidateId)
      .order('called_at', { ascending: false })
      .limit(5),
    supabase
      .from('candidate_intelligence')
      .select('ai_summary, skills, red_flags, reliability_score')
      .eq('candidate_id', candidateId)
      .single(),
  ]);

  const candidate = candidateRes.data;
  if (!candidate) return { error: 'Candidate not found' };

  return {
    candidate: {
      id: candidate.id,
      name: candidate.name || 'Unknown',
      phone: candidate.phone_e164,
      status: candidate.status,
      source: candidate.source,
      last_contacted: candidate.last_called_at || null,
      roles: candidate.roles,
      driver: candidate.driver,
      dbs: candidate.dbs_update_service,
      mandatory_training: candidate.mandatory_training,
      earliest_start_date: candidate.earliest_start_date,
      email: candidate.email || null,
    },
    recent_messages: (messagesRes.data || []).map(m => ({
      direction: m.direction,
      text: m.message_text,
      when: m.captured_at,
      intent: m.ai_intent,
      sentiment: m.ai_sentiment,
      suggested_action: m.ai_suggested_action,
    })),
    recent_calls: (callsRes.data || []).map(c => ({
      when: c.called_at,
      duration_mins: c.duration_seconds ? Math.round(c.duration_seconds / 60) : null,
      summary: c.transcript_summary,
      intent: c.ai_intent,
      disposition: c.disposition,
    })),
    intelligence: intelligenceRes.data || null,
  };
}

async function getWhatsappInbox() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('id, chat_name, message_text, captured_at, ai_intent, ai_suggested_action, candidates(id, name, status)')
    .eq('direction', 'inbound')
    .gte('captured_at', cutoff)
    .order('captured_at', { ascending: false })
    .limit(100);

  const msgs = data || [];
  const format = (m: {
    chat_name: string;
    candidates: { id: string; name: string | null; status: string } | null;
    message_text: string;
    captured_at: string;
    ai_intent: string | null;
    ai_suggested_action: string | null;
  }) => ({
    candidate: (m.candidates as { id: string; name: string | null; status: string } | null)?.name || m.chat_name,
    candidate_id: (m.candidates as { id: string; name: string | null; status: string } | null)?.id || null,
    message: m.message_text,
    when: m.captured_at,
    intent: m.ai_intent,
    action: m.ai_suggested_action,
  });

  return {
    urgent: msgs.filter(m => m.ai_suggested_action === 'urgent_response').map(format),
    needs_reply: msgs.filter(m =>
      ['callback_request', 'question', 'interested', 'call_back'].includes(m.ai_suggested_action || '')
    ).map(format),
    follow_up: msgs.filter(m =>
      ['add_to_pool', 'send_info', 'schedule_interview'].includes(m.ai_suggested_action || '')
    ).map(format),
    no_action_needed: msgs.filter(m =>
      m.ai_suggested_action === 'no_action' || !m.ai_suggested_action
    ).length,
    total: msgs.length,
  };
}

async function getPipelineStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [statusRes, newThisWeekRes, contactedTodayRes, messagesRes, unactionedRes] = await Promise.all([
    supabase.from('candidates').select('status'),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).gte('last_called_at', todayStart.toISOString()),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).gte('captured_at', cutoff48h),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .neq('ai_suggested_action', 'no_action')
      .gte('captured_at', cutoff48h),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRes.data || []) {
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  }

  return {
    by_status: byStatus,
    total_candidates: Object.values(byStatus).reduce((a, b) => a + b, 0),
    new_this_week: newThisWeekRes.count || 0,
    contacted_today: contactedTodayRes.count || 0,
    messages_last_48h: messagesRes.count || 0,
    unactioned_messages: unactionedRes.count || 0,
  };
}

async function matchCandidatesForRole(params: {
  role_description: string;
  requires_driver?: boolean;
  requires_dbs?: boolean;
  requires_training?: boolean;
  preferred_status?: string[];
  limit?: number;
}) {
  let query = supabase
    .from('candidates')
    .select('id, name, phone_e164, status, source, last_called_at, driver, dbs_update_service, mandatory_training, roles, earliest_start_date')
    .not('status', 'eq', 'hired')
    .not('status', 'eq', 'rejected')
    .order('last_called_at', { ascending: false, nullsFirst: false })
    .limit(params.limit || 15);

  if (params.requires_driver) query = query.eq('driver', 'Yes');
  if (params.requires_dbs) query = query.eq('dbs_update_service', 'Yes');
  if (params.requires_training) query = query.eq('mandatory_training', 'Yes');
  if (params.preferred_status && params.preferred_status.length > 0) {
    query = query.in('status', params.preferred_status);
  }

  const { data: candidates } = await query;

  // Also get latest WhatsApp engagement for these candidates
  const ids = (candidates || []).map(c => c.id);
  let msgActivity: Record<string, { last_msg: string; intent: string | null }> = {};

  if (ids.length > 0) {
    const { data: msgs } = await supabase
      .from('whatsapp_messages')
      .select('candidate_id, captured_at, ai_intent')
      .in('candidate_id', ids)
      .eq('direction', 'inbound')
      .order('captured_at', { ascending: false });

    for (const m of msgs || []) {
      if (m.candidate_id && !msgActivity[m.candidate_id]) {
        msgActivity[m.candidate_id] = { last_msg: m.captured_at, intent: m.ai_intent };
      }
    }
  }

  const results = (candidates || []).map(c => {
    const msg = msgActivity[c.id];
    const lastActivity = msg?.last_msg || c.last_called_at || null;
    const daysSinceContact = lastActivity
      ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000)
      : null;
    return {
      id: c.id,
      name: c.name || 'Unknown',
      phone: c.phone_e164,
      status: c.status,
      qualifications: {
        driver: c.driver,
        dbs: c.dbs_update_service,
        training: c.mandatory_training,
      },
      roles: c.roles,
      earliest_start: c.earliest_start_date,
      last_activity: lastActivity,
      days_since_contact: daysSinceContact,
      last_whatsapp_intent: msg?.intent || null,
    };
  });

  return {
    role_searched: params.role_description,
    total_matches: results.length,
    candidates: results,
    note: results.length === 0
      ? 'No candidates match all requirements. Try relaxing some filters.'
      : `Found ${results.length} candidates. Those with recent contact are listed first.`,
  };
}

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_candidates':
      return searchCandidates(input as Parameters<typeof searchCandidates>[0]);
    case 'get_candidate_detail':
      return getCandidateDetail(input.candidate_id as string);
    case 'get_whatsapp_inbox':
      return getWhatsappInbox();
    case 'get_pipeline_stats':
      return getPipelineStats();
    case 'match_candidates_for_role':
      return matchCandidatesForRole(input as Parameters<typeof matchCandidatesForRole>[0]);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { messages, contextCandidateId } = await request.json() as {
      messages: Anthropic.MessageParam[];
      contextCandidateId?: string;
    };

    // Fetch context candidate name if provided
    let contextNote = '';
    if (contextCandidateId) {
      const { data } = await supabase
        .from('candidates')
        .select('name')
        .eq('id', contextCandidateId)
        .single();
      if (data?.name) {
        contextNote = `[Context: The recruiter currently has "${data.name}" open in the main panel. If they ask about "this candidate" or "them", they mean ${data.name} (ID: ${contextCandidateId}).]`;
      }
    }

    const systemPrompt = `You are a sharp, experienced personal recruitment assistant for a UK care staffing agency. You have real-time access to the recruiter's entire candidate database, WhatsApp conversations, and call history via tools. Think like a senior recruiter who has been working this desk for years and knows every candidate personally.

Your job is to make the recruiter's life easier by thinking FOR them:
- When asked what needs attention: fetch the inbox + pipeline, then prioritise and tell them EXACTLY who to contact first and why
- When asked about a candidate: get their full detail and give a crisp brief — recent messages, call history, what they said, what action to take
- When given a new package or job requirement: use match_candidates_for_role to find the best fits, then rank them by readiness (qualifications + recency of contact + expressed interest)
- Be proactive: if you notice something important while fetching data (e.g. someone said they're available this weekend, or hasn't been contacted in 2 weeks despite showing interest), flag it unprompted
- Always name specific candidates, never speak in vague generalities
- Format with clear structure: bullet points, bold names, short sentences. No waffle.
- UK context: DBS = criminal background check, mandatory training = care certificates, drivers needed for community care roles${contextNote ? '\n\n' + contextNote : ''}`;

    // Agentic loop: max 5 rounds of tool calls
    let currentMessages = [...messages];
    const MAX_ROUNDS = 5;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1500,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      // If no tool use, return the text response
      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');
        return NextResponse.json({ reply: text });
      }

      // Process tool calls
      if (response.stop_reason === 'tool_use') {
        // Add assistant's response to messages
        currentMessages = [...currentMessages, { role: 'assistant', content: response.content }];

        // Execute all tool calls in parallel
        const toolBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
        const toolResults = await Promise.all(
          toolBlocks.map(async block => {
            const result = await executeTool(block.name, block.input as Record<string, unknown>);
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify(result),
            };
          })
        );

        currentMessages = [...currentMessages, { role: 'user', content: toolResults }];
        continue;
      }

      // Unexpected stop reason
      break;
    }

    return NextResponse.json({ reply: 'I reached my response limit. Please try a more specific question.' });
  } catch (error: unknown) {
    console.error('[Assistant Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
