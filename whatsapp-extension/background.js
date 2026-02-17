// Background service worker — handles API calls to avoid CORS issues in content scripts

const DEFAULT_API_URL = 'https://care-ats.vercel.app/api/whatsapp-webhook';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEND_MESSAGES') {
    handleSendMessages(message.payload).then(sendResponse);
    return true; // Keep channel open for async response
  }
  if (message.type === 'GET_STATS') {
    getStats().then(sendResponse);
    return true;
  }
  if (message.type === 'GET_CONFIG') {
    getConfig().then(sendResponse);
    return true;
  }
});

async function getConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['apiUrl', 'apiToken', 'enabled'], result => {
      resolve({
        apiUrl: result.apiUrl || DEFAULT_API_URL,
        apiToken: result.apiToken || '',
        enabled: result.enabled !== false // default true
      });
    });
  });
}

async function getStats() {
  return new Promise(resolve => {
    const today = new Date().toDateString();
    chrome.storage.local.get(['stats'], result => {
      const stats = result.stats || {};
      const todayStats = stats[today] || { captured: 0, sent: 0, errors: 0 };
      resolve({ today: todayStats, lastSync: stats.lastSync || null });
    });
  });
}

async function incrementStats(field, count = 1) {
  const today = new Date().toDateString();
  return new Promise(resolve => {
    chrome.storage.local.get(['stats'], result => {
      const stats = result.stats || {};
      if (!stats[today]) stats[today] = { captured: 0, sent: 0, errors: 0 };
      stats[today][field] = (stats[today][field] || 0) + count;
      stats.lastSync = new Date().toISOString();
      chrome.storage.local.set({ stats }, resolve);
    });
  });
}

async function handleSendMessages(payload) {
  const config = await getConfig();

  if (!config.enabled) {
    return { success: false, reason: 'Extension disabled' };
  }

  if (!config.apiToken) {
    return { success: false, reason: 'No API token configured. Open extension popup to set it.' };
  }

  await incrementStats('captured', payload.messages.length);

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': config.apiToken
      },
      body: JSON.stringify({
        source: 'chrome-extension',
        messages: payload.messages,
        capturedAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const text = await response.text();
      await incrementStats('errors');
      return { success: false, reason: `API error ${response.status}: ${text}` };
    }

    const data = await response.json();
    await incrementStats('sent', payload.messages.length);
    return { success: true, processed: data.processed };

  } catch (err) {
    await incrementStats('errors');
    return { success: false, reason: err.message };
  }
}
