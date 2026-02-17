// CareRecruit WhatsApp Web Reader
// Makes API calls directly from content script — no background service worker needed.
// This avoids "Extension context invalidated" errors from MV3 service worker death.

const FLUSH_INTERVAL_MS = 2000;
const DEFAULT_API_URL = 'https://care-ats.vercel.app/api/whatsapp-webhook';
const PROCESSED_IDS = new Set();
let pendingMessages = [];
let observer = null;
let isCapturingHistory = false;
let lastChatName = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Config (read directly from storage — no background needed) ──────────────

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['apiUrl', 'apiToken', 'enabled'], r => {
      resolve({
        apiUrl: r.apiUrl || DEFAULT_API_URL,
        apiToken: r.apiToken || '',
        enabled: r.enabled !== false,
      });
    });
  });
}

function updateStats(sent) {
  const today = new Date().toDateString();
  chrome.storage.local.get(['stats'], r => {
    const stats = r.stats || {};
    if (!stats[today]) stats[today] = { captured: 0, sent: 0 };
    stats[today].sent = (stats[today].sent || 0) + sent;
    stats[today].captured = (stats[today].captured || 0) + sent;
    stats.lastSync = new Date().toISOString();
    chrome.storage.local.set({ stats });
  });
}

// ─── Message extraction ───────────────────────────────────────────────────────

function directionFromId(id) {
  return id?.startsWith('true_') ? 'outbound' : 'inbound';
}

function phoneFromId(id) {
  const m = id?.match(/(?:true|false)_(\d+)@/);
  return m ? '+' + m[1] : null;
}

function getChatName() {
  const selectors = [
    '#main header [data-testid="conversation-info-header-chat-title"] span',
    '#main header span[dir="auto"]',
    '#main header ._ao3e',
    'header span[title]',
  ];
  for (const s of selectors) {
    const t = document.querySelector(s)?.textContent?.trim();
    if (t && t.length > 0 && t.length < 100) return t;
  }
  return null;
}

function getMessageText(el) {
  for (const span of el.querySelectorAll('span.selectable-text')) {
    const t = span.innerText?.trim();
    if (t) return t;
  }
  const copyable = el.querySelector('.copyable-text');
  if (copyable?.innerText?.trim()) return copyable.innerText.trim();
  if (el.querySelector('[data-testid="audio-play"]')) return '[Voice message]';
  if (el.querySelector('img[src*="blob:"]')) return '[Image]';
  if (el.querySelector('video')) return '[Video]';
  if (el.querySelector('[data-testid="document-thumb"]')) return '[Document]';
  return null;
}

function getTimestamp(el) {
  const raw = el.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text') || '';
  const m = raw.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
  if (m) {
    const [, time, date] = m;
    const [d, mo, y] = date.split('/');
    return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${time.padStart(5,'0')}:00`).toISOString();
  }
  return new Date().toISOString();
}

function extractMessage(el) {
  const id = el.getAttribute('data-id');
  if (!id || PROCESSED_IDS.has(id)) return null;
  const text = getMessageText(el);
  if (!text) return null;
  PROCESSED_IDS.add(id);
  const phone = phoneFromId(id);
  return {
    id,
    chatName: getChatName() || phone || 'Unknown',
    phone,
    direction: directionFromId(id),
    text,
    timestamp: getTimestamp(el),
    rawTimestamp: getTimestamp(el),
    capturedAt: new Date().toISOString(),
  };
}

function scanMessages() {
  let count = 0;
  for (const el of document.querySelectorAll('[data-id]')) {
    const msg = extractMessage(el);
    if (msg) { pendingMessages.push(msg); count++; }
  }
  if (count > 0) console.log(`[CareRecruit] +${count} messages (${PROCESSED_IDS.size} total)`);
  return count;
}

// ─── Direct API flush — no service worker ────────────────────────────────────

async function flush() {
  if (pendingMessages.length === 0) return;

  const config = await getConfig();
  if (!config.enabled || !config.apiToken) {
    console.warn('[CareRecruit] Not configured — set token in extension popup');
    return;
  }

  const batch = [...pendingMessages];
  pendingMessages = [];

  try {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': config.apiToken,
      },
      body: JSON.stringify({
        source: 'chrome-extension',
        messages: batch,
        capturedAt: new Date().toISOString(),
      }),
    });

    if (res.ok) {
      const data = await res.json();
      console.log(`[CareRecruit] ✓ Synced ${batch.length} messages (${data.processed} processed)`);
      updateStats(batch.length);
    } else {
      console.warn(`[CareRecruit] API error ${res.status} — will retry`);
      pendingMessages.unshift(...batch);
    }
  } catch (e) {
    console.warn('[CareRecruit] Network error — will retry:', e.message);
    pendingMessages.unshift(...batch);
  }
}

// ─── Auto-scroll to load full chat history ────────────────────────────────────

function getScrollContainer() {
  const main = document.querySelector('#main');
  if (!main) return null;
  // Find the tallest scrollable div inside #main
  let best = null, bestHeight = 0;
  for (const div of main.querySelectorAll('div')) {
    if (div.scrollHeight > div.clientHeight + 100 && div.scrollHeight > bestHeight) {
      bestHeight = div.scrollHeight;
      best = div;
    }
  }
  return best;
}

async function captureFullHistory() {
  if (isCapturingHistory) return;
  isCapturingHistory = true;
  const chatName = getChatName();
  console.log(`[CareRecruit] Capturing history for "${chatName}"...`);

  scanMessages(); // Capture what's visible immediately

  const container = getScrollContainer();
  if (container) {
    let noNewCount = 0;
    while (noNewCount < 3) {
      const before = PROCESSED_IDS.size;
      container.scrollTop = 0;
      await sleep(700);
      scanMessages();
      const after = PROCESSED_IDS.size;
      noNewCount = after > before ? 0 : noNewCount + 1;
    }
    // Scroll back to bottom
    container.scrollTop = container.scrollHeight;
  }

  console.log(`[CareRecruit] History done: ${PROCESSED_IDS.size} messages captured`);
  await flush();
  isCapturingHistory = false;
}

// ─── Real-time observer ───────────────────────────────────────────────────────

let debounceTimer = null;

function startObserver() {
  if (observer) { observer.disconnect(); }

  observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      let found = false;
      for (const el of document.querySelectorAll('[data-id]')) {
        if (!PROCESSED_IDS.has(el.getAttribute('data-id'))) {
          const msg = extractMessage(el);
          if (msg) {
            pendingMessages.push(msg);
            found = true;
            console.log(`[CareRecruit] Real-time ${msg.direction}: "${msg.text.slice(0, 60)}"`);
          }
        }
      }
      // Flush immediately on new real-time messages
      if (found) flush();
    }, 400);
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Chat switch detection ────────────────────────────────────────────────────

function checkChatSwitch() {
  const current = getChatName();
  if (current && current !== lastChatName) {
    console.log(`[CareRecruit] Switched to "${current}"`);
    lastChatName = current;
    flush(); // Send pending from previous chat
    setTimeout(() => captureFullHistory(), 1500);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  console.log('[CareRecruit] Starting...');

  // Wait for WhatsApp to load
  await new Promise(resolve => {
    const t = setInterval(() => {
      if (document.querySelector('[data-testid="chat-list"]') || document.querySelector('#main')) {
        clearInterval(t); resolve();
      }
    }, 500);
  });

  console.log('[CareRecruit] WhatsApp Web ready — observer active');
  startObserver();

  // Capture currently open chat
  await sleep(2000);
  lastChatName = getChatName();
  if (lastChatName) captureFullHistory();

  // Detect chat switches
  setInterval(checkChatSwitch, 1000);

  // Periodic flush as safety net
  setInterval(flush, FLUSH_INTERVAL_MS);
}

init();
