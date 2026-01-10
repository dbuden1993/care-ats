const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local (same as Next.js uses)
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for logging campaign interactions
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔧 Supabase URL:', SUPABASE_URL ? '✅ Found' : '❌ Missing');
console.log('🔧 Supabase Key:', SUPABASE_KEY ? '✅ Found' : '❌ Missing');

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

if (supabase) {
  console.log('✅ Supabase client initialized - campaign interactions will be logged');
} else {
  console.log('⚠️ Supabase not configured - campaign interactions will NOT be logged');
}

// Log campaign interaction to database
async function logCampaignInteraction(data) {
  if (!supabase) {
    console.log('⚠️ Supabase not configured, skipping interaction log');
    return;
  }
  try {
    const { error } = await supabase.from('campaign_interactions').insert([{
      candidate_id: data.candidateId,
      campaign_id: data.campaignId,
      campaign_name: data.campaignName,
      message_type: data.messageType || null,
      status: data.status,
      message_preview: data.message?.slice(0, 100) || null,
      error_message: data.error || null,
      sent_at: new Date().toISOString(),
    }]);
    if (error) console.log('⚠️ Failed to log interaction:', error.message);
    else console.log('📝 Logged interaction for', data.candidateName);
  } catch (e) {
    console.log('⚠️ Error logging interaction:', e.message);
  }
}

const app = express();
app.use(express.json());
app.use((req, res, next) => { res.header('Access-Control-Allow-Origin', '*'); next(); });

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

const broadcast = (data) => {
  const msg = JSON.stringify(data);
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
  console.log('📤', data.type, data.status || data.clientInfo?.pushname || '');
};

let whatsapp = null;
let currentState = { status: 'idle', qrCode: null, clientInfo: null };
let messageQueue = [];
let isPaused = false;

function setReady() {
  if (currentState.status === 'ready') return;
  
  const info = whatsapp?.info;
  console.log('🚀 READY!');
  currentState.status = 'ready';
  currentState.qrCode = null;
  currentState.clientInfo = {
    pushname: info?.pushname || 'User',
    phone: info?.wid?.user || ''
  };
  broadcast({ type: 'ready', clientInfo: currentState.clientInfo });
  console.log(`📞 ${currentState.clientInfo.pushname} (+${currentState.clientInfo.phone})`);
}

async function startWhatsApp() {
  if (whatsapp) return;
  
  console.log('🔄 Starting WhatsApp...');
  currentState.status = 'initializing';
  broadcast({ type: 'status', status: 'initializing' });
  
  whatsapp = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
  });

  whatsapp.on('qr', qr => {
    console.log('📱 QR Code - scan in app');
    currentState.status = 'qr_ready';
    currentState.qrCode = qr;
    broadcast({ type: 'qr_code', qr });
  });

  whatsapp.on('authenticated', () => {
    console.log('✅ Authenticated');
    currentState.qrCode = null;
    broadcast({ type: 'status', status: 'authenticated' });
  });

  whatsapp.on('loading_screen', (pct, msg) => {
    console.log(`⏳ Loading ${pct}% - ${msg}`);
    broadcast({ type: 'status', status: 'loading' });
    
    // When loading hits 100%, start polling for ready state
    if (pct >= 100) {
      console.log('📊 Starting ready check...');
      let checks = 0;
      const checkReady = setInterval(() => {
        checks++;
        console.log(`🔍 Check #${checks}: info=${!!whatsapp?.info}, wid=${!!whatsapp?.info?.wid}, pupPage=${!!whatsapp?.pupPage}`);
        
        if (whatsapp?.info?.wid) {
          clearInterval(checkReady);
          setReady();
        } else if (checks >= 30) {
          clearInterval(checkReady);
          console.log('⚠️ Ready check timeout');
        }
      }, 1000);
    }
  });

  whatsapp.on('ready', () => {
    console.log('📣 Ready event fired!');
    setReady();
  });

  whatsapp.on('auth_failure', (msg) => {
    console.log('❌ Auth failed:', msg);
    cleanup();
    fs.rmSync('./.wwebjs_auth', { recursive: true, force: true });
    currentState = { status: 'disconnected', qrCode: null, clientInfo: null };
    broadcast({ type: 'status', status: 'disconnected' });
    setTimeout(startWhatsApp, 3000);
  });

  whatsapp.on('disconnected', (reason) => {
    console.log('🔌 Disconnected:', reason);
    cleanup();
    currentState = { status: 'disconnected', qrCode: null, clientInfo: null };
    broadcast({ type: 'status', status: 'disconnected' });
    setTimeout(startWhatsApp, 5000);
  });

  try {
    await whatsapp.initialize();
    
    // Final fallback: check 5 seconds after initialize completes
    setTimeout(() => {
      console.log('🔍 Post-init check: status=' + currentState.status + ', info=' + !!whatsapp?.info?.wid);
      if (currentState.status !== 'ready' && whatsapp?.info?.wid) {
        console.log('✅ Late ready detection');
        setReady();
      }
    }, 5000);
    
  } catch (e) {
    console.error('❌ Init error:', e.message);
    cleanup();
    setTimeout(startWhatsApp, 10000);
  }
}

function cleanup() {
  if (whatsapp) {
    try { whatsapp.destroy(); } catch(e) {}
    whatsapp = null;
  }
}

async function processQueue() {
  console.log('🔄 processQueue called:', { isPaused, queueLength: messageQueue.length, status: currentState.status });
  
  if (isPaused) { console.log('⏸️ Queue is paused'); return; }
  if (!messageQueue.length) { console.log('📭 Queue is empty'); return; }
  if (currentState.status !== 'ready') { console.log('⚠️ WhatsApp not ready, status:', currentState.status); return; }
  
  console.log('📤 Processing', messageQueue.length, 'messages...');
  
  while (messageQueue.length && !isPaused) {
    const item = messageQueue.shift();
    console.log('📱 Sending to:', item.name, item.phone);
    try {
      let phone = item.phone.replace(/\D/g, '');
      if (phone.startsWith('0')) phone = '44' + phone.slice(1);
      const chatId = phone + '@c.us';
      
      console.log('  Chat ID:', chatId);
      
      // Check if number is registered on WhatsApp
      const isRegistered = await whatsapp.isRegisteredUser(chatId);
      console.log('  Registered on WhatsApp:', isRegistered);
      
      if (!isRegistered) {
        console.log(`⚠️ ${item.name} (${phone}) is NOT on WhatsApp`);
        broadcast({ type: 'message_failed', item: { ...item, status: 'failed', error: 'Number not on WhatsApp' } });
        
        // Log to database - not on WhatsApp
        logCampaignInteraction({
          candidateId: item.candidateId,
          candidateName: item.name,
          campaignId: item.campaignId || 'unknown',
          campaignName: item.campaignName || 'WhatsApp Campaign',
          status: 'not_on_whatsapp',
          message: item.message,
          error: 'Number not registered on WhatsApp'
        });
        continue;
      }
      
      await whatsapp.sendMessage(chatId, item.message);
      broadcast({ type: 'message_sent', item: { ...item, status: 'sent' } });
      console.log(`✅ Sent to ${item.name}`);
      
      // Log to database - sent successfully
      logCampaignInteraction({
        candidateId: item.candidateId,
        candidateName: item.name,
        campaignId: item.campaignId || 'unknown',
        campaignName: item.campaignName || 'WhatsApp Campaign',
        status: 'sent',
        message: item.message
      });
      
    } catch (e) {
      console.log(`❌ Failed to send to ${item.name}:`, e.message);
      broadcast({ type: 'message_failed', item: { ...item, status: 'failed', error: e.message } });
      
      // Log to database - failed
      logCampaignInteraction({
        candidateId: item.candidateId,
        candidateName: item.name,
        campaignId: item.campaignId || 'unknown',
        campaignName: item.campaignName || 'WhatsApp Campaign',
        status: 'failed',
        message: item.message,
        error: e.message
      });
    }
    
    if (messageQueue.length) {
      const delay = 3000 + Math.random() * 4000;
      console.log(`⏳ Waiting ${Math.round(delay/1000)}s before next message...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  if (!messageQueue.length) {
    console.log('✅ Queue complete!');
    broadcast({ type: 'queue_complete' });
  }
}

wss.on('connection', ws => {
  console.log('🔗 Client connected');
  clients.add(ws);
  
  ws.send(JSON.stringify({
    type: 'init',
    status: currentState.status,
    qrCode: currentState.qrCode,
    clientInfo: currentState.clientInfo
  }));
  
  ws.on('message', async data => {
    const msg = JSON.parse(data.toString());
    
    switch (msg.action) {
      case 'get-status':
        ws.send(JSON.stringify({
          type: 'init',
          status: currentState.status,
          qrCode: currentState.qrCode,
          clientInfo: currentState.clientInfo
        }));
        break;
        
      case 'send-bulk':
        console.log('📨 Received send-bulk with', msg.messages?.length, 'messages');
        msg.messages?.forEach((m, i) => {
          console.log(`  - ${m.name}: ${m.phone}`);
          messageQueue.push({ id: `${Date.now()}-${i}`, ...m });
        });
        processQueue();
        break;
        
      case 'pause': 
        console.log('⏸️ Pause requested');
        isPaused = true; 
        broadcast({ type: 'queue_paused' }); 
        break;
      case 'resume': 
        console.log('▶️ Resume requested');
        isPaused = false; 
        broadcast({ type: 'queue_resumed' }); 
        processQueue(); 
        break;
      case 'stop': 
        console.log('🛑 Stop requested');
        isPaused = true; 
        messageQueue = []; 
        broadcast({ type: 'queue_stopped' }); 
        break;
        
      case 'logout':
        if (whatsapp) {
          try { await whatsapp.logout(); } catch(e) {}
          cleanup();
          fs.rmSync('./.wwebjs_auth', { recursive: true, force: true });
          currentState = { status: 'disconnected', qrCode: null, clientInfo: null };
          broadcast({ type: 'status', status: 'disconnected' });
          setTimeout(startWhatsApp, 2000);
        }
        break;
        
      case 'check':
        // Manual check for debugging
        console.log('Manual check: info=', !!whatsapp?.info, 'wid=', !!whatsapp?.info?.wid);
        if (whatsapp?.info?.wid && currentState.status !== 'ready') {
          setReady();
        }
        break;
    }
  });
  
  ws.on('close', () => { clients.delete(ws); });
});

app.get('/status', (_, res) => res.json(currentState));

// Manual check endpoint for debugging
app.get('/check', (_, res) => {
  const hasInfo = !!whatsapp?.info;
  const hasWid = !!whatsapp?.info?.wid;
  console.log('HTTP check: info=' + hasInfo + ', wid=' + hasWid);
  
  if (hasWid && currentState.status !== 'ready') {
    setReady();
    res.json({ triggered: true, status: currentState.status });
  } else {
    res.json({ info: hasInfo, wid: hasWid, status: currentState.status });
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🟢 WhatsApp Service on ws://localhost:${PORT}`);
  console.log(`   Debug: http://localhost:${PORT}/check\n`);
  startWhatsApp();
});

process.on('SIGINT', async () => {
  console.log('\n👋 Bye');
  cleanup();
  process.exit(0);
});
