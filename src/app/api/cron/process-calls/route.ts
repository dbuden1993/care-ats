// Vercel Cron Job — runs every 5 minutes automatically
// Picks up any calls stuck in 'pending' or 'failed' status and triggers the Edge Function
// Vercel calls this with Authorization: Bearer ${CRON_SECRET}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel cron (or us internally)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Find all calls stuck in pending or failed — oldest first, max 10 per run
  const { data: pending, error } = await supabase
    .from('call_history')
    .select('call_id, phone_e164, processing_status, call_time')
    .in('processing_status', ['pending', 'failed'])
    .not('recording_id', 'is', null)
    .order('call_time', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[Cron] DB error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending?.length) {
    return NextResponse.json({ ok: true, processed: 0, message: 'Queue is clear' });
  }

  console.log(`[Cron] Processing ${pending.length} pending call(s)`);

  const results: { call_id: string; status: string }[] = [];

  for (const call of pending) {
    try {
      // Mark as processing so parallel cron runs don't double-process
      await supabase
        .from('call_history')
        .update({ processing_status: 'pending', processing_error: null })
        .eq('call_id', call.call_id);

      const res = await fetch(`${supabaseUrl}/functions/v1/process-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ call_id: call.call_id }),
        // No timeout here — cron runs up to 5 min on Vercel Pro, 10s on Hobby
        // Edge Function handles its own timeout internally
      });

      const text = await res.text().catch(() => '');
      results.push({ call_id: call.call_id, status: `${res.status}: ${text.slice(0, 100)}` });
    } catch (e: any) {
      results.push({ call_id: call.call_id, status: `error: ${e.message}` });
    }

    // 1s gap between calls to avoid hammering the Edge Function
    if (pending.length > 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log('[Cron] Done:', results);
  return NextResponse.json({ ok: true, processed: results.length, results });
}
