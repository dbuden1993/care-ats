// src/app/api/dialpad/route.ts
// Simplified webhook - stores call info quickly, triggers Supabase Edge Function for processing

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Dialpad] Webhook received:', {
      state: body.state,
      call_id: body.call_id,
      has_recording: !!(body.recording_details?.length),
      external_number: body.external_number,
    });

    const eventType = body.event_type || body.type || body.state;

    // Only process hangup events with recordings
    if (
      (eventType === 'hangup' || body.state === 'hangup') &&
      body.recording_details?.length > 0
    ) {
      return handleCallWithRecording(body);
    }

    // Regular hangup without recording
    if (eventType === 'hangup' || body.state === 'hangup') {
      return handleCallHangup(body);
    }

    // Non-hangup event (ringing, connected, etc.) - acknowledge
    return NextResponse.json({ status: 'ok', event: eventType });
  } catch (error: any) {
    console.error('[Dialpad] Webhook error:', error?.message || error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

async function handleCallHangup(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone;

  console.log(`[Dialpad] Hangup (no recording): ${callId} / ${phone}`);

  const { error } = await supabase.from('call_history').upsert(
    {
      call_id: callId,
      phone_e164: phone,
      call_time: new Date().toISOString(),
      direction: data.direction || 'unknown',
      duration_ms: data.duration ? Math.round(data.duration) : null,
      processing_status: 'no_recording',
    },
    { onConflict: 'call_id' }
  );

  if (error) {
    console.error('[Dialpad] Upsert error (no-recording):', error);
  }

  return NextResponse.json({ status: 'ok', call_id: callId });
}

async function handleCallWithRecording(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone;
  const recordingDetails = data.recording_details?.[0];
  const durationMs = data.duration ? Math.round(data.duration) : null;

  console.log(`[Dialpad] Hangup WITH recording: ${callId} / ${phone}`, {
    recording_id: recordingDetails?.id,
    recording_type: recordingDetails?.recording_type,
    recording_url: recordingDetails?.url ? '(present)' : '(missing)',
  });

  // Store call immediately with pending status
  const { error: upsertErr } = await supabase.from('call_history').upsert(
    {
      call_id: callId,
      phone_e164: phone,
      recording_url: recordingDetails?.url || null,
      call_time: data.date_started
        ? new Date(parseInt(data.date_started)).toISOString()
        : new Date().toISOString(),
      direction: data.direction || 'unknown',
      duration_ms: durationMs,
      processing_status: 'pending',
      recording_id: recordingDetails?.id || null,
      recording_type:
        recordingDetails?.recording_type || 'admincallrecording',
    },
    { onConflict: 'call_id' }
  );

  if (upsertErr) {
    console.error('[Dialpad] Upsert error (with-recording):', upsertErr);
    return NextResponse.json(
      { error: 'DB upsert failed', details: upsertErr.message },
      { status: 500 }
    );
  }

  // Trigger Edge Function (fire and forget)
  triggerEdgeFunction(callId);

  return NextResponse.json({
    status: 'ok',
    message: 'Call queued for processing',
    call_id: callId,
  });
}

function triggerEdgeFunction(callId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error('[Dialpad] Cannot trigger Edge Function - missing SUPABASE_URL or ANON_KEY');
    return;
  }

  const url = `${supabaseUrl}/functions/v1/process-call`;
  console.log(`[Dialpad] Triggering Edge Function for call ${callId}: ${url}`);

  // FIX: was previously a tagged template literal — fetch`...` — which silently failed.
  // Must be fetch(...) with parentheses.
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ call_id: callId }),
  })
    .then(async (res) => {
      const text = await res.text().catch(() => '');
      console.log(`[Dialpad] Edge Function response (${res.status}):`, text.substring(0, 200));
    })
    .catch((e) => {
      console.error('[Dialpad] Edge Function trigger failed:', e?.message || e);
    });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Dialpad webhook - stores calls, processes via Supabase Edge Function',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
  });
}
