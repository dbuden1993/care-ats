// Content script — runs on web.whatsapp.com
// Reads messages from the currently open chat and sends them to CareRecruit

const SEND_INTERVAL_MS = 6000;       // Send captured messages every 6 seconds
const MAX_HISTORY_ON_OPEN = 50;      // Max messages to capture when opening a new chat
const PROCESSED_IDS = new Set();     // Track already-sent message IDs this session

let currentChatName = null;
let currentChatPhone = null;
let pendingMessages = [];
let observer = null;
let sendTimer = null;

// ─── Helpers ───────────────────────────────────────────────────────────────

function getActiveChatInfo() {
  // Contact name from the chat header
  const titleEl =
    document.querySelector('header [data-testid="conversation-info-header-chat-title"] span') ||
    document.querySelector('header ._ao3e') ||
    document.querySelector('header span[title]');
  const name = titleEl ? titleEl.textContent.trim() : null;

  // Try to get phone from URL hash or header subtitle
  const subtitleEl =
    document.querySelector('header [data-testid="conversation-info-header-subtitle"] span') ||
    document.querySelector('header ._ao3e + ._ao3e span');
  const subtitle = subtitleEl ? subtitleEl.textContent.trim() : null;

  // subtitle might be a phone number or "online"/"last seen..."
  const phone = subtitle && /^\+?\d[\d\s\-\(\)]{6,}$/.test(subtitle) ? subtitle : null;

  return { name, phone };
}

function getMessageDirection(msgEl) {
  if (msgEl.classList.contains('message-out')) return 'outbound';
  if (msgEl.classList.contains('message-in')) return 'inbound';
  // Fallback: check for outgoing indicator (tail)
  if (msgEl.querySelector('[data-testid="msg-dblcheck"], [data-testid="msg-check"]')) return 'outbound';
  return 'inbound';
}

function getMessageText(msgEl) {
  // Primary: copyable-text with data-pre-plain-text
  const copyable = msgEl.querySelector('.copyable-text span.selectable-text');
  if (copyable) {
    // Collect all text, skip emoji alt text
    let text = '';
    copyable.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.nodeName === 'IMG') text += node.getAttribute('alt') || '';
      else text += node.textContent;
    });
    return text.trim();
  }
  // Media message fallback
  const mediaCaption = msgEl.querySelector('span[data-testid="caption"]');
  if (mediaCaption) return '[Media] ' + (mediaCaption.textContent.trim() || '');
  // Voice message
  if (msgEl.querySelector('[data-testid="audio-play"]')) return '[Voice message]';
  // Image/video
  if (msgEl.querySelector('img[src*="blob"]')) return '[Image]';
  return null;
}

function getMessageTimestamp(msgEl) {
  // data-pre-plain-text contains "[HH:MM, DD/MM/YYYY] Name:"
  const copyable = msgEl.querySelector('.copyable-text[data-pre-plain-text]');
  if (copyable) {
    const raw = copyable.getAttribute('data-pre-plain-text') || '';
    const match = raw.match(/\[(\d{1,2}:\d{2}),\s*(\d{1,2}\/\d{1,2}\/\d{4})\]/);
    if (match) {
      const [, time, date] = match;
      const [day, month, year] = date.split('/');
      return new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${time.padStart(5,'0')}:00`).toISOString();
    }
  }
  // Fallback: timestamp span
  const timeEl = msgEl.querySelector('[data-testid="msg-meta"] span, ._a04s, .copyable-text + span span');
  return timeEl ? new Date().toISOString() : new Date().toISOString();
}

function getMessageId(msgEl) {
  // data-id is the stable WhatsApp message ID
  return msgEl.getAttribute('data-id') || null;
}

function extractMessage(msgEl, chatName, chatPhone) {
  const id = getMessageId(msgEl);
  if (!id || PROCESSED_IDS.has(id)) return null;

  const text = getMessageText(msgEl);
  if (!text) return null;

  const direction = getMessageDirection(msgEl);
  const timestamp = getMessageTimestamp(msgEl);

  PROCESSED_IDS.add(id);

  return {
    id,
    chatName: chatName || 'Unknown',
    phone: chatPhone,
    direction,
    text,
    timestamp,
    rawTimestamp: timestamp,
    capturedAt: new Date().toISOString()
  };
}

// ─── Capture ───────────────────────────────────────────────────────────────

function captureVisibleMessages() {
  const { name, phone } = getActiveChatInfo();
  if (!name) return; // No chat open

  // All message elements in the current chat
  const msgEls = document.querySelectorAll(
    '#main div.message-in, #main div.message-out, #main div[data-id]'
  );

  const captured = [];
  const limit = Math.min(msgEls.length, MAX_HISTORY_ON_OPEN);

  // Capture the most recent ones (last N)
  const toCapture = Array.from(msgEls).slice(-limit);
  for (const el of toCapture) {
    // Only elements that ARE messages (have data-id)
    const id = el.getAttribute('data-id');
    if (!id || PROCESSED_IDS.has(id)) continue;

    const msg = extractMessage(el, name, phone);
    if (msg) captured.push(msg);
  }

  if (captured.length > 0) {
    pendingMessages.push(...captured);
    console.log(`[CareRecruit] Captured ${captured.length} messages from "${name}"`);
  }

  currentChatName = name;
  currentChatPhone = phone;
}

// ─── Observer ──────────────────────────────────────────────────────────────

function startObserving() {
  if (observer) observer.disconnect();

  const mainEl = document.getElementById('main');
  if (!mainEl) {
    setTimeout(startObserving, 1000);
    return;
  }

  // Capture any existing messages when chat first loads
  setTimeout(captureVisibleMessages, 1500);

  observer = new MutationObserver(() => {
    const { name, phone } = getActiveChatInfo();
    if (!name) return;

    // If chat changed, reset context
    if (name !== currentChatName) {
      currentChatName = name;
      currentChatPhone = phone;
      setTimeout(captureVisibleMessages, 500);
      return;
    }

    // Capture any new messages
    const allMsgEls = document.querySelectorAll('#main div[data-id]');
    for (const el of allMsgEls) {
      const id = el.getAttribute('data-id');
      if (!id || PROCESSED_IDS.has(id)) continue;
      const msg = extractMessage(el, name, phone);
      if (msg) {
        pendingMessages.push(msg);
        console.log(`[CareRecruit] New message from "${name}": ${msg.direction}`);
      }
    }
  });

  observer.observe(mainEl, { childList: true, subtree: true });
  console.log('[CareRecruit] Observing WhatsApp Web...');
}

// ─── Sender ────────────────────────────────────────────────────────────────

async function flushPendingMessages() {
  if (pendingMessages.length === 0) return;

  const toSend = [...pendingMessages];
  pendingMessages = [];

  const response = await chrome.runtime.sendMessage({
    type: 'SEND_MESSAGES',
    payload: { messages: toSend }
  });

  if (response && !response.success) {
    console.warn('[CareRecruit] Failed to send messages:', response.reason);
    // Put them back in the queue if it's a temporary error
    if (response.reason && response.reason.includes('API error 5')) {
      pendingMessages.unshift(...toSend);
    }
  } else if (response && response.success) {
    console.log(`[CareRecruit] Synced ${toSend.length} messages (${response.processed} processed by API)`);
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────

function init() {
  console.log('[CareRecruit] WhatsApp extension loaded');

  // Start observing once WhatsApp has loaded its UI
  const waitForApp = setInterval(() => {
    if (document.getElementById('main') || document.querySelector('[data-testid="chat-list"]')) {
      clearInterval(waitForApp);
      startObserving();
    }
  }, 500);

  // Send pending messages on a timer
  sendTimer = setInterval(flushPendingMessages, SEND_INTERVAL_MS);

  // Also flush when navigating to a new chat (URL hash change)
  window.addEventListener('hashchange', () => {
    flushPendingMessages(); // Send current chat messages before switching
    setTimeout(() => {
      captureVisibleMessages();
      startObserving();
    }, 2000); // Wait for new chat to load
  });
}

// Wait for page to be interactive
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000); // Give WhatsApp Web time to boot
}
