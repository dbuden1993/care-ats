// app/api/whatsapp/route.ts
// Proxy to WhatsApp Web service

import { NextRequest, NextResponse } from 'next/server';

const WHATSAPP_SERVICE_URL = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';

  try {
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/${action}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'WhatsApp service not running',
      details: error.message,
      hint: 'Start the service with: node whatsapp-service.js'
    }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, ...data } = body;

  try {
    const endpoint = action === 'send-bulk' ? 'send-bulk' : 
                     action === 'clear-queue' ? 'clear-queue' : 'send';
    
    const res = await fetch(`${WHATSAPP_SERVICE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    const result = await res.json();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'WhatsApp service not running',
      details: error.message 
    }, { status: 503 });
  }
}
