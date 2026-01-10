// src/app/api/whatsapp/route.ts
// This runs the WhatsApp service as part of Next.js

import { NextRequest, NextResponse } from 'next/server';

// We need to use a singleton pattern because Next.js API routes can be called multiple times
let whatsappClient: any = null;
let currentState = {
  status: 'not_initialized',
  qrCode: null as string | null,
  clientInfo: null as any,
  lastError: null as string | null,
};
let messageQueue: any[] = [];
let isProcessing = false;
let isPaused = false;
let stateListeners: ((state: any) => void)[] = [];

// Initialize WhatsApp client (only once)
async function initializeWhatsApp() {
  if (whatsappClient) return;
  
  // Dynamic import to avoid SSR issues
  const { Client, LocalAuth } = await import('whatsapp-web.js');
  
  currentState.status = 'initializing';
  broadcastState();
  
  whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
  });

  whatsappClient.on('qr', (qr: string) => {
    console.log('📱 QR Code received');
    currentState.status = 'qr_ready';
    currentState.qrCode = qr;
    broadcastState();
  });

  whatsappClient.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated');
    currentState.status = 'authenticated';
    currentState.qrCode = null;
    broadcastState();
  });

  whatsappClient.on('auth_failure', (msg: string) => {
    console.error('❌ Auth failure:', msg);
    currentState.status = 'auth_failed';
    currentState.lastError = msg;
    broadcastState();
  });

  whatsappClient.on('ready', () => {
    console.log('🚀 WhatsApp ready!');
    currentState.status = 'ready';
    currentState.qrCode = null;
    const info = whatsappClient.info;
    currentState.clientInfo = {
      pushname: info?.pushname || 'Unknown',
      phone: info?.wid?.user || 'Unknown',
      platform: info?.platform || 'Unknown'
    };
    broadcastState();
  });

  whatsappClient.on('disconnected', (reason: string) => {
    console.log('🔌 Disconnected:', reason);
    currentState.status = 'disconnected';
    currentState.clientInfo = null;
    currentState.qrCode = null;
    broadcastState();
  });

  whatsappClient.on('message_ack', (msg: any, ack: number) => {
    const ackMap: Record<number, string> = { 0: 'pending', 1: 'sent', 2: 'delivered', 3: 'read' };
    const status = ackMap[ack] || 'unknown';
    const to = msg.to?.replace('@c.us', '') || '';
    // Broadcast ACK update
    stateListeners.forEach(listener => listener({
      type: 'message_ack',
      phone: to,
      ack,
      status
    }));
  });

  try {
    await whatsappClient.initialize();
  } catch (err: any) {
    console.error('Failed to initialize:', err);
    currentState.status = 'error';
    currentState.lastError = err.message;
    broadcastState();
  }
}

function broadcastState() {
  const state = {
    type: 'state_update',
    ...currentState,
    queueLength: messageQueue.length,
    isPaused
  };
  stateListeners.forEach(listener => listener(state));
}

// Process message queue
async function processQueue() {
  if (isProcessing || isPaused || messageQueue.length === 0) return;
  if (currentState.status !== 'ready' || !whatsappClient) return;

  isProcessing = true;

  while (messageQueue.length > 0 && !isPaused) {
    const item = messageQueue[0];

    try {
      let phone = item.phone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '44' + phone.slice(1);
      if (!phone.startsWith('44') && phone.length === 10) phone = '44' + phone;
      const chatId = phone + '@c.us';

      const isRegistered = await whatsappClient.isRegisteredUser(chatId);
      if (!isRegistered) {
        item.status = 'failed';
        item.error = 'Not on WhatsApp';
        stateListeners.forEach(l => l({ type: 'message_failed', item, error: 'Not on WhatsApp' }));
        messageQueue.shift();
        continue;
      }

      item.status = 'sending';
      stateListeners.forEach(l => l({ type: 'message_sending', item }));

      const result = await whatsappClient.sendMessage(chatId, item.message);
      item.status = 'sent';
      item.messageId = result.id?.id;
      item.sentAt = new Date().toISOString();
      stateListeners.forEach(l => l({ type: 'message_sent', item }));

    } catch (err: any) {
      item.status = 'failed';
      item.error = err.message;
      stateListeners.forEach(l => l({ type: 'message_failed', item, error: err.message }));
    }

    messageQueue.shift();

    if (messageQueue.length > 0 && !isPaused) {
      const delay = 3000 + Math.random() * 5000;
      stateListeners.forEach(l => l({ type: 'queue_delay', delay, remaining: messageQueue.length }));
      await new Promise(r => setTimeout(r, delay));
    }
  }

  isProcessing = false;
  if (messageQueue.length === 0) {
    stateListeners.forEach(l => l({ type: 'queue_complete' }));
  }
}

// GET - Get current state or establish SSE connection
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sse = searchParams.get('sse');

  // Initialize if not already
  if (!whatsappClient && currentState.status === 'not_initialized') {
    initializeWhatsApp();
  }

  // Server-Sent Events for real-time updates
  if (sse === 'true') {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial state
        const initialData = `data: ${JSON.stringify({
          type: 'init',
          status: currentState.status,
          qrCode: currentState.qrCode,
          clientInfo: currentState.clientInfo,
          queueLength: messageQueue.length,
          isPaused
        })}\n\n`;
        controller.enqueue(encoder.encode(initialData));

        // Add listener for updates
        const listener = (data: any) => {
          try {
            const sseData = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          } catch (e) {
            // Stream closed
          }
        };
        stateListeners.push(listener);

        // Keep-alive ping every 30s
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch (e) {
            clearInterval(pingInterval);
          }
        }, 30000);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          stateListeners = stateListeners.filter(l => l !== listener);
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Regular GET - return current state
  return NextResponse.json({
    status: currentState.status,
    qrCode: currentState.qrCode,
    clientInfo: currentState.clientInfo,
    queueLength: messageQueue.length,
    isPaused
  });
}

// POST - Handle actions
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  // Initialize if not already
  if (!whatsappClient && currentState.status === 'not_initialized') {
    initializeWhatsApp();
  }

  switch (action) {
    case 'send-bulk':
      if (currentState.status !== 'ready') {
        return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 503 });
      }
      const messages = body.messages || [];
      messages.forEach((m: any, i: number) => {
        messageQueue.push({
          id: `msg-${Date.now()}-${i}`,
          ...m,
          status: 'pending',
          queuedAt: new Date().toISOString()
        });
      });
      stateListeners.forEach(l => l({ type: 'queue_updated', queueLength: messageQueue.length, added: messages.length }));
      processQueue();
      return NextResponse.json({ success: true, queued: messages.length });

    case 'pause':
      isPaused = true;
      stateListeners.forEach(l => l({ type: 'queue_paused' }));
      return NextResponse.json({ success: true, isPaused });

    case 'resume':
      isPaused = false;
      stateListeners.forEach(l => l({ type: 'queue_resumed' }));
      processQueue();
      return NextResponse.json({ success: true, isPaused });

    case 'stop':
      isPaused = true;
      const cleared = messageQueue.length;
      messageQueue = [];
      stateListeners.forEach(l => l({ type: 'queue_stopped', cleared }));
      return NextResponse.json({ success: true, cleared });

    case 'logout':
      if (whatsappClient) {
        await whatsappClient.logout();
        currentState.status = 'disconnected';
        currentState.clientInfo = null;
        broadcastState();
      }
      return NextResponse.json({ success: true });

    case 'restart':
      if (whatsappClient) {
        await whatsappClient.destroy();
        whatsappClient = null;
      }
      currentState.status = 'not_initialized';
      currentState.qrCode = null;
      currentState.clientInfo = null;
      initializeWhatsApp();
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
