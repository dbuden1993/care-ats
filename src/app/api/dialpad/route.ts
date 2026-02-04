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
    console.log('Dialpad webhook:', body.state, body.call_id);

    const eventType = body.event_type || body.type || body.state;

    // Only process hangup events with recordings
    if ((eventType === 'hangup' || body.state === 'hangup') && body.recording_details?.length > 0) {
      return handleCallWithRecording(body);
    }

    // Regular hangup without recording
    if (eventType === 'hangup' || body.state === 'hangup') {
      return handleCallHangup(body);
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}

async function handleCallHangup(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone;

  await supabase.from('call_history').upsert({
    call_id: callId,
    phone_e164: phone,
    call_time: new Date().toISOString(),
    direction: data.direction || 'unknown',
    duration_ms: data.duration ? Math.round(data.duration) : null,
    processing_status: 'no_recording'
  }, { onConflict: 'call_id' });

  return NextResponse.json({ status: 'ok' });
}

async function handleCallWithRecording(data: any) {
  const callId = data.call_id || data.id;
  const phone = data.external_number || data.contact?.phone;
  const recordingDetails = data.recording_details?.[0];
  const durationMs = data.duration ? Math.round(data.duration) : null;

  // Store call immediately
  await supabase.from('call_history').upsert({
    call_id: callId,
    phone_e164: phone,
    recording_url: recordingDetails?.url,
    call_time: new Date(parseInt(data.date_started || Date.now())).toISOString(),
    direction: data.direction || 'unknown',
    duration_ms: durationMs,
    processing_status: 'pending',
    recording_id: recordingDetails?.id,
    recording_type: recordingDetails?.recording_type || 'admincallrecording'
  }, { onConflict: 'call_id' });

  // Trigger Edge Function (fire and forget)
  triggerEdgeFunction(callId);

  return NextResponse.json({ 
    status: 'ok', 
    message: 'Call queued for processing',
    call_id: callId 
  });
}

function triggerEdgeFunction(callId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !anonKey) return;

  // Fire and forget - don't await
  fetch(`${supabaseUrl}/functions/v1/process-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`
    },
    body: JSON.stringify({ call_id: callId })
  }).catch(e => console.error('Edge trigger failed:', e));
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Dialpad webhook - stores calls, processes via Supabase Edge Function'
  });
}
