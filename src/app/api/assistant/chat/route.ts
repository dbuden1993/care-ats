import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY || '' });

// ─── Tool definitions ────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'search_candidates',
    description: 'Search and filter candidates. Use this to find candidates by name, status, or how long since they were contacted.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Partial name match' },
        status: { type: 'array', items: { type: 'string', enum: ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'] } },
        source: { type: 'string', description: 'whatsapp, dialpad, import, etc.' },
        days_no_contact: { type: 'number', description: 'Candidates not contacted in this many days' },
        has_messages: { type: 'boolean', description: 'Only candidates with WhatsApp messages' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_candidate_detail',
    description: 'Get the full profile of a specific candidate — their WhatsApp conversation history, call records, qualifications and AI notes. Always call this before giving advice about a specific person.',
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
    description: 'Get the current WhatsApp inbox — unreplied inbound messages from the last 7 days, grouped by urgency. Use this for daily brief or when asked who needs a reply.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_pipeline_stats',
    description: 'Get pipeline counts by stage and recent activity stats.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_follow_ups_needed',
    description: 'Get candidates in active pipeline stages who have not been contacted in 7+ days. Returns them sorted by most overdue first.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'match_candidates_for_role',
    description: 'Find and rank candidates for a specific job or care package. Use when the recruiter describes a requirement and wants to know who to contact.',
    input_schema: {
      type: 'object' as const,
      properties: {
        role_description: { type: 'string' },
        requires_driver: { type: 'boolean' },
        requires_dbs: { type: 'boolean' },
        requires_training: { type: 'boolean' },
        preferred_status: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number' },
      },
      required: ['role_description'],
    },
  },
  {
    name: 'search_content',
    description: 'Full-text keyword search across call summaries, WhatsApp messages, and candidate notes. Use this when looking for a specific language, skill, characteristic, or anything mentioned in conversations (e.g. "Tamil", "live-in", "spinal injury", "night shifts"). Returns matching candidates with context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: { type: 'string', description: 'Word or phrase to search for (case-insensitive)' },
      },
      required: ['keyword'],
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
    .select('id, name, phone_e164, status, source, last_called_at, created_at, roles, driver, dbs_update_service, mandatory_training')
    .order('last_called_at', { ascending: false, nullsFirst: false })
    .limit(Math.min(filters.limit || 20, 50));

  if (filters.name) query = query.ilike('name', `%${filters.name}%`);
  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.days_no_contact) {
    const cutoff = new Date(Date.now() - filters.days_no_contact * 86400000).toISOString();
    query = query.or(`last_called_at.lt.${cutoff},last_called_at.is.null`);
  }

  const { data, error } = await query;
  if (error) return { error: error.message };
  let candidates = data || [];

  if (filters.has_messages) {
    const { data: withMsgs } = await supabase
      .from('whatsapp_messages').select('candidate_id').not('candidate_id', 'is', null);
    const ids = new Set((withMsgs || []).map((m: any) => m.candidate_id));
    candidates = candidates.filter(c => ids.has(c.id));
  }

  // Enrich with latest WhatsApp message time
  const ids = candidates.map(c => c.id);
  let lastWA: Record<string, string> = {};
  if (ids.length) {
    const { data: msgs } = await supabase
      .from('whatsapp_messages').select('candidate_id, captured_at')
      .in('candidate_id', ids).order('captured_at', { ascending: false });
    for (const m of msgs || []) {
      if (m.candidate_id && !lastWA[m.candidate_id]) lastWA[m.candidate_id] = m.captured_at;
    }
  }

  return {
    count: candidates.length,
    candidates: candidates.map(c => {
      const lastContact = [c.last_called_at, lastWA[c.id]].filter(Boolean).sort().pop() || null;
      const daysSince = lastContact ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000) : null;
      return {
        id: c.id,
        name: c.name || 'Unknown',
        status: c.status,
        source: c.source,
        last_called: c.last_called_at ? Math.floor((Date.now() - new Date(c.last_called_at).getTime()) / 86400000) + 'd ago' : 'never called',
        last_whatsapp: lastWA[c.id] ? Math.floor((Date.now() - new Date(lastWA[c.id]).getTime()) / 86400000) + 'd ago' : 'no WA',
        days_since_any_contact: daysSince,
        driver: c.driver,
        dbs: c.dbs_update_service,
        training: c.mandatory_training,
        roles: c.roles,
      };
    }),
  };
}

async function getCandidateDetail(candidateId: string) {
  const { data: candidate } = await supabase
    .from('candidates').select('*').eq('id', candidateId).single();
  if (!candidate) return { error: 'Candidate not found' };

  // WhatsApp messages — get last 30, both directions, newest first
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('direction, message_text, captured_at, ai_intent, ai_sentiment, ai_suggested_action')
    .eq('candidate_id', candidateId)
    .order('captured_at', { ascending: false })
    .limit(30);

  // Call history — match by phone (no candidate_id on that table)
  const phone = candidate.phone_e164;
  const [callsRes, historyRes] = await Promise.all([
    phone ? supabase.from('calls')
      .select('candidate_phone_e164, call_summary, energy_score, quality_assessment, roles, driver, dbs_status, mandatory_training, earliest_start_date, weekly_rota, created_at, duration_ms')
      .eq('candidate_phone_e164', phone).order('created_at', { ascending: false }).limit(5)
      : { data: [] },
    phone ? supabase.from('call_history')
      .select('phone_e164, call_summary, energy_score, quality_assessment, call_time, duration_ms, direction')
      .eq('phone_e164', phone).order('call_time', { ascending: false }).limit(5)
      : { data: [] },
  ]);

  const { data: intelligence } = await supabase
    .from('candidate_intelligence')
    .select('ai_summary, skills, red_flags, reliability_score')
    .eq('candidate_id', candidateId).single();

  const daysSinceCall = candidate.last_called_at
    ? Math.floor((Date.now() - new Date(candidate.last_called_at).getTime()) / 86400000)
    : null;

  // Format conversation as readable thread (reverse to show oldest first)
  const conversation = [...(messages || [])].reverse().map(m => ({
    from: m.direction === 'inbound' ? 'CANDIDATE' : 'YOU',
    text: m.message_text,
    when: m.captured_at ? new Date(m.captured_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
    intent: m.direction === 'inbound' ? m.ai_intent : null,
  }));

  const calls = [
    ...(callsRes.data || []).map((c: any) => ({
      when: c.created_at,
      duration: c.duration_ms ? Math.round(c.duration_ms / 60000) + ' min' : null,
      summary: c.call_summary,
      grade: c.quality_assessment,
      energy: c.energy_score,
    })),
    ...(historyRes.data || []).map((c: any) => ({
      when: c.call_time,
      duration: c.duration_ms ? Math.round(c.duration_ms / 60000) + ' min' : null,
      summary: c.call_summary,
      grade: c.quality_assessment,
      energy: c.energy_score,
    })),
  ].sort((a, b) => new Date(b.when || 0).getTime() - new Date(a.when || 0).getTime()).slice(0, 5);

  return {
    candidate: {
      name: candidate.name,
      phone: candidate.phone_e164,
      status: candidate.status,
      source: candidate.source,
      driver: candidate.driver,
      dbs: candidate.dbs_update_service,
      training: candidate.mandatory_training,
      roles: candidate.roles,
      earliest_start: candidate.earliest_start_date,
      last_called: daysSinceCall !== null ? `${daysSinceCall} days ago` : 'never called',
      notes: candidate.notes || null,
    },
    whatsapp_conversation: conversation,
    call_records: calls,
    ai_intelligence: intelligence || null,
  };
}

async function getWhatsappInbox() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: inbound } = await supabase
    .from('whatsapp_messages')
    .select('id, candidate_id, chat_name, message_text, captured_at, ai_intent, ai_suggested_action, candidates(id, name, status)')
    .eq('direction', 'inbound')
    .neq('ai_suggested_action', 'no_action')
    .gte('captured_at', cutoff)
    .order('captured_at', { ascending: false })
    .limit(100);

  if (!inbound?.length) return { urgent: [], needs_reply: [], total: 0, note: 'Inbox is clear' };

  // Filter out already-replied messages
  const candidateIds = [...new Set((inbound || []).map(m => m.candidate_id).filter(Boolean))];
  const { data: outbound } = await supabase
    .from('whatsapp_messages')
    .select('candidate_id, chat_name, captured_at')
    .eq('direction', 'outbound')
    .in('candidate_id', candidateIds);

  const lastReply: Record<string, number> = {};
  for (const m of outbound || []) {
    const key = m.candidate_id;
    if (!key) continue;
    const t = new Date(m.captured_at).getTime();
    if (!lastReply[key] || t > lastReply[key]) lastReply[key] = t;
  }

  const unreplied = (inbound || []).filter(m => {
    const key = m.candidate_id;
    if (!key) return true;
    const inboundTime = new Date(m.captured_at).getTime();
    return !lastReply[key] || lastReply[key] < inboundTime;
  });

  // Deduplicate by candidate — keep most urgent/recent per person
  const seen = new Map<string, any>();
  for (const m of unreplied) {
    const key = m.candidate_id || m.chat_name;
    if (!key) continue;
    const ex = seen.get(key);
    if (!ex || (m.ai_suggested_action === 'urgent_response' && ex.ai_suggested_action !== 'urgent_response')) {
      seen.set(key, m);
    }
  }

  const msgs = [...seen.values()];
  const format = (m: any) => {
    const cand = Array.isArray(m.candidates) ? m.candidates[0] : m.candidates;
    const daysAgo = Math.floor((Date.now() - new Date(m.captured_at).getTime()) / 86400000);
    return {
      candidate: cand?.name || m.chat_name,
      candidate_id: cand?.id || m.candidate_id || null,
      status: cand?.status || null,
      message: m.message_text,
      when: daysAgo === 0 ? 'today' : `${daysAgo}d ago`,
      intent: m.ai_intent,
      action_needed: m.ai_suggested_action,
    };
  };

  return {
    urgent: msgs.filter(m => m.ai_suggested_action === 'urgent_response').map(format),
    needs_reply: msgs.filter(m => ['callback_request', 'question', 'interested', 'call_back'].includes(m.ai_suggested_action || '')).map(format),
    follow_up: msgs.filter(m => ['add_to_pool', 'send_info', 'schedule_interview'].includes(m.ai_suggested_action || '')).map(format),
    total: msgs.length,
  };
}

async function getPipelineStats() {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [statusRes, newThisWeekRes, contactedTodayRes, unactionedRes] = await Promise.all([
    supabase.from('candidates').select('status'),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    supabase.from('candidates').select('id', { count: 'exact', head: true }).gte('last_called_at', todayStart.toISOString()),
    supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true })
      .eq('direction', 'inbound').neq('ai_suggested_action', 'no_action')
      .gte('captured_at', new Date(Date.now() - 48 * 3600000).toISOString()),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRes.data || []) byStatus[row.status] = (byStatus[row.status] || 0) + 1;

  return {
    pipeline: byStatus,
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    new_this_week: newThisWeekRes.count || 0,
    contacted_today: contactedTodayRes.count || 0,
    unactioned_whatsapp_48h: unactionedRes.count || 0,
  };
}

async function getFollowUpsNeeded() {
  const cutoff7d = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data } = await supabase
    .from('candidates')
    .select('id, name, phone_e164, status, last_called_at')
    .in('status', ['new', 'screening', 'interview'])
    .or(`last_called_at.is.null,last_called_at.lt.${cutoff7d}`)
    .limit(50);

  if (!data?.length) return { count: 0, candidates: [], note: 'No overdue follow-ups!' };

  const ids = data.map(c => c.id);
  const [{ data: outboundWA }, { data: lastInbound }] = await Promise.all([
    supabase.from('whatsapp_messages').select('candidate_id, captured_at').in('candidate_id', ids).eq('direction', 'outbound'),
    supabase.from('whatsapp_messages').select('candidate_id, message_text, captured_at').in('candidate_id', ids).eq('direction', 'inbound').order('captured_at', { ascending: false }),
  ]);

  const lastWA: Record<string, number> = {};
  for (const m of outboundWA || []) {
    if (!m.candidate_id) continue;
    const t = new Date(m.captured_at).getTime();
    if (!lastWA[m.candidate_id] || t > lastWA[m.candidate_id]) lastWA[m.candidate_id] = t;
  }
  const lastMsg: Record<string, string> = {};
  for (const m of lastInbound || []) {
    if (m.candidate_id && !lastMsg[m.candidate_id]) lastMsg[m.candidate_id] = m.message_text;
  }

  const enriched = data.map(c => {
    const callT = c.last_called_at ? new Date(c.last_called_at).getTime() : 0;
    const waT = lastWA[c.id] || 0;
    const lastContact = Math.max(callT, waT);
    const daysOverdue = lastContact
      ? Math.floor((Date.now() - lastContact) / 86400000)
      : 999;
    return { ...c, daysOverdue, last_said: lastMsg[c.id] || null };
  })
    .filter(c => c.daysOverdue >= 7)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 20);

  return {
    count: enriched.length,
    candidates: enriched.map(c => ({
      id: c.id,
      name: c.name,
      status: c.status,
      days_no_contact: c.daysOverdue >= 999 ? 'never contacted' : `${c.daysOverdue} days`,
      last_said: c.last_said,
    })),
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
    .not('status', 'in', '("hired","rejected")')
    .order('last_called_at', { ascending: false, nullsFirst: false })
    .limit(params.limit || 20);

  if (params.requires_driver) query = query.eq('driver', 'Yes');
  if (params.requires_dbs) query = query.eq('dbs_update_service', 'Yes');
  if (params.requires_training) query = query.eq('mandatory_training', 'Yes');
  if (params.preferred_status?.length) query = query.in('status', params.preferred_status);

  const { data: candidates } = await query;
  const ids = (candidates || []).map(c => c.id);
  let msgActivity: Record<string, { last_msg: string; intent: string | null; text: string }> = {};

  if (ids.length) {
    const { data: msgs } = await supabase
      .from('whatsapp_messages')
      .select('candidate_id, captured_at, ai_intent, message_text')
      .in('candidate_id', ids).eq('direction', 'inbound')
      .order('captured_at', { ascending: false });
    for (const m of msgs || []) {
      if (m.candidate_id && !msgActivity[m.candidate_id]) {
        msgActivity[m.candidate_id] = { last_msg: m.captured_at, intent: m.ai_intent, text: m.message_text };
      }
    }
  }

  const results = (candidates || []).map(c => {
    const msg = msgActivity[c.id];
    const lastActivity = msg?.last_msg || c.last_called_at || null;
    const daysSince = lastActivity ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000) : null;
    return {
      id: c.id,
      name: c.name || 'Unknown',
      status: c.status,
      qualifications: { driver: c.driver, dbs: c.dbs_update_service, training: c.mandatory_training },
      roles: c.roles,
      earliest_start: c.earliest_start_date,
      days_since_contact: daysSince !== null ? `${daysSince}d ago` : 'never contacted',
      last_whatsapp_intent: msg?.intent || null,
      last_whatsapp_said: msg?.text?.slice(0, 100) || null,
    };
  });

  return {
    role: params.role_description,
    matches: results.length,
    candidates: results,
    tip: results.length === 0 ? 'No exact matches — try relaxing driver/DBS requirements' : null,
  };
}

async function searchContent(keyword: string) {
  const kw = `%${keyword}%`;

  // Search call summaries
  const { data: calls } = await supabase
    .from('call_history')
    .select('phone_e164, call_summary, call_time, quality_assessment')
    .ilike('call_summary', kw)
    .order('call_time', { ascending: false })
    .limit(30);

  // Search WhatsApp messages
  const { data: msgs } = await supabase
    .from('whatsapp_messages')
    .select('candidate_id, chat_name, message_text, captured_at, direction')
    .ilike('message_text', kw)
    .order('captured_at', { ascending: false })
    .limit(30);

  // Search candidate notes field
  const { data: notesCands } = await supabase
    .from('candidates')
    .select('id, name, phone_e164, status, notes')
    .ilike('notes', kw)
    .limit(20);

  // Resolve phone_e164 → candidate for call results
  const phones = [...new Set((calls || []).map(c => c.phone_e164).filter(Boolean))];
  const candIds = [...new Set((msgs || []).map(m => m.candidate_id).filter(Boolean))];
  const allIds = [...new Set([...candIds])];

  const [{ data: byPhone }, { data: byId }] = await Promise.all([
    phones.length
      ? supabase.from('candidates').select('id, name, status, phone_e164').in('phone_e164', phones)
      : Promise.resolve({ data: [] }),
    allIds.length
      ? supabase.from('candidates').select('id, name, status, phone_e164').in('id', allIds)
      : Promise.resolve({ data: [] }),
  ]);

  const phoneMap: Record<string, any> = {};
  for (const c of byPhone || []) if (c.phone_e164) phoneMap[c.phone_e164] = c;
  const idMap: Record<string, any> = {};
  for (const c of byId || []) idMap[c.id] = c;

  // Deduplicate — collect all matching candidates with context snippets
  const found = new Map<string, { name: string; status: string; id: string; matches: string[] }>();

  for (const c of calls || []) {
    const cand = phoneMap[c.phone_e164];
    if (!cand) continue;
    if (!found.has(cand.id)) found.set(cand.id, { name: cand.name, status: cand.status, id: cand.id, matches: [] });
    found.get(cand.id)!.matches.push(`Call summary: "${c.call_summary?.slice(0, 150)}"`);
  }
  for (const m of msgs || []) {
    const cand = m.candidate_id ? idMap[m.candidate_id] : null;
    const key = cand?.id || m.chat_name;
    if (!key) continue;
    if (!found.has(key)) found.set(key, { name: cand?.name || m.chat_name, status: cand?.status || 'unknown', id: cand?.id || key, matches: [] });
    found.get(key)!.matches.push(`${m.direction === 'inbound' ? 'They said' : 'You said'}: "${m.message_text?.slice(0, 150)}"`);
  }
  for (const c of notesCands || []) {
    if (!found.has(c.id)) found.set(c.id, { name: c.name, status: c.status, id: c.id, matches: [] });
    found.get(c.id)!.matches.push(`Notes: "${c.notes?.slice(0, 150)}"`);
  }

  const results = [...found.values()].map(r => ({ ...r, matches: r.matches.slice(0, 3) }));
  return {
    keyword,
    total_matches: results.length,
    candidates: results,
    note: results.length === 0 ? `No mentions of "${keyword}" found in call summaries, messages, or notes.` : null,
  };
}

// ─── Tool executor ─────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_candidates': return searchCandidates(input as any);
    case 'get_candidate_detail': return getCandidateDetail(input.candidate_id as string);
    case 'get_whatsapp_inbox': return getWhatsappInbox();
    case 'get_pipeline_stats': return getPipelineStats();
    case 'get_follow_ups_needed': return getFollowUpsNeeded();
    case 'match_candidates_for_role': return matchCandidatesForRole(input as any);
    case 'search_content': return searchContent(input.keyword as string);
    default: return { error: `Unknown tool: ${name}` };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { messages, contextCandidateId } = await request.json() as {
      messages: Anthropic.MessageParam[];
      contextCandidateId?: string;
    };

    let contextNote = '';
    if (contextCandidateId) {
      const { data } = await supabase.from('candidates').select('name').eq('id', contextCandidateId).single();
      if (data?.name) {
        contextNote = `\n\nCURRENT CONTEXT: The recruiter has "${data.name}" open right now (ID: ${contextCandidateId}). If they ask about "this candidate", "them", or "their messages" — call get_candidate_detail for this ID immediately.`;
      }
    }

    const systemPrompt = `You are the personal recruitment assistant for a UK care staffing agency. You have live access to the recruiter's candidate database, WhatsApp messages, and call records via tools.

PERSONALITY: You are direct, specific, and practical — like a smart colleague who has read every message and knows every candidate. Never be vague. Never give generic recruitment advice. Always use real names and real data from the tools.

RULES:
- Always call at least one tool before answering — never guess from memory
- Name specific candidates, never "Candidate A" or "someone in your pipeline"
- Lead with the most important thing first
- If you spot something the recruiter didn't ask about (e.g. someone said they're available NOW, or hasn't been called in 3 weeks despite expressing interest), flag it
- Keep replies concise — bullet points, bold names, clear next action
- If a candidate said something specific in WhatsApp that's relevant, quote it directly
- UK care context: DBS = criminal record check, mandatory training = care certificate, community roles usually need a driver${contextNote}`;

    let currentMessages = [...messages];

    for (let round = 0; round < 8; round++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      });

      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');
        return NextResponse.json({ reply: text });
      }

      if (response.stop_reason === 'tool_use') {
        currentMessages = [...currentMessages, { role: 'assistant', content: response.content }];
        const toolBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
        const toolResults = await Promise.all(
          toolBlocks.map(async block => ({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: JSON.stringify(await executeTool(block.name, block.input as Record<string, unknown>)),
          }))
        );
        currentMessages = [...currentMessages, { role: 'user', content: toolResults }];
        continue;
      }

      break;
    }

    return NextResponse.json({ reply: 'I searched the database but ran out of processing rounds before forming a complete answer. Try asking a more specific question, or ask me to search for a specific keyword (e.g. "search for Tamil in call summaries").' });
  } catch (error: unknown) {
    console.error('[Assistant Chat] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
