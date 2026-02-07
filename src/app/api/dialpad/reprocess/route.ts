// src/app/api/dialpad/reprocess/route.ts
// Manually trigger reprocessing of pending/failed calls
// Usage: POST /api/dialpad/reprocess           → process next pending
//        POST /api/dialpad/reprocess?all=true   → process all pending (one by one)
//        POST /api/dialpad/reprocess?call_id=X  → process specific call

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get('call_id');
    const processAll = url.searchParams.get('all') === 'true';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Missing Supabase config' },
        { status: 500 }
      );
    }

    // Process a specific call
    if (callId) {
      const res = await triggerEdgeFunction(supabaseUrl, anonKey, callId);
      return NextResponse.json({
        status: 'ok',
        message: `Triggered processing for call ${callId}`,
        edge_response: res,
      });
    }

    // Find pending/failed calls
    const { data: pendingCalls, error } = await supabase
      .from('call_history')
      .select('call_id, phone_e164, processing_status, recording_id')
      .in('processing_status', ['pending', 'failed'])
      .not('recording_id', 'is', null)
      .order('call_time', { ascending: true })
      .limit(processAll ? 100 : 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!pendingCalls?.length) {
      return NextResponse.json({
        status: 'ok',
        message: 'No pending/failed calls to reprocess',
      });
    }

    // Trigger processing for each
    const results = [];
    for (const call of pendingCalls) {
      // Reset status to pending before triggering
      await supabase
        .from('call_history')
        .update({ processing_status: 'pending', processing_error: null })
        .eq('call_id', call.call_id);

      const res = await triggerEdgeFunction(
        supabaseUrl,
        anonKey,
        call.call_id
      );
      results.push({
        call_id: call.call_id,
        phone: call.phone_e164,
        triggered: true,
        response: res,
      });

      // Small delay between calls to avoid rate limiting
      if (processAll && pendingCalls.length > 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return NextResponse.json({
      status: 'ok',
      message: `Triggered ${results.length} call(s) for processing`,
      results,
    });
  } catch (error: any) {
    console.error('[Reprocess] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

async function triggerEdgeFunction(
  supabaseUrl: string,
  anonKey: string,
  callId: string
): Promise<string> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/process-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ call_id: callId }),
    });
    const text = await resp.text();
    return `${resp.status}: ${text.substring(0, 200)}`;
  } catch (e: any) {
    return `Error: ${e?.message}`;
  }
}

export async function GET() {
  // Show pending/failed call count
  const { data: pending } = await supabase
    .from('call_history')
    .select('call_id, phone_e164, processing_status, call_time')
    .in('processing_status', ['pending', 'failed'])
    .order('call_time', { ascending: false })
    .limit(50);

  return NextResponse.json({
    status: 'ok',
    pending_count: pending?.length || 0,
    calls: pending || [],
    usage: {
      'POST /api/dialpad/reprocess': 'Process next pending call',
      'POST /api/dialpad/reprocess?all=true': 'Process all pending calls',
      'POST /api/dialpad/reprocess?call_id=X': 'Process specific call',
    },
  });
}
