// Popup script — loads/saves config and shows stats

const DEFAULT_API_URL = 'https://care-ats.vercel.app/api/whatsapp-webhook';

async function loadConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['apiUrl', 'apiToken', 'enabled'], result => {
      resolve({
        apiUrl: result.apiUrl || '',
        apiToken: result.apiToken || '',
        enabled: result.enabled !== false
      });
    });
  });
}

async function loadStats() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  return response;
}

async function init() {
  const [config, stats] = await Promise.all([loadConfig(), loadStats()]);

  // Populate form
  document.getElementById('apiToken').value = config.apiToken;
  document.getElementById('apiUrl').value = config.apiUrl;
  document.getElementById('enabledToggle').checked = config.enabled;

  // Populate stats
  const today = stats.today || {};
  document.getElementById('capturedCount').textContent = today.captured || 0;
  document.getElementById('sentCount').textContent = today.sent || 0;

  // Status indicator
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const setupInfo = document.getElementById('setupInfo');

  if (!config.apiToken) {
    dot.className = 'status-dot error';
    statusText.textContent = 'Not configured — enter token below';
    setupInfo.innerHTML = `Find your token in <strong>CareRecruit → Settings → WhatsApp Extension</strong>`;
  } else if (!config.enabled) {
    dot.className = 'status-dot';
    statusText.textContent = 'Paused — toggle enabled to resume';
    setupInfo.textContent = 'Extension is paused. Toggle "Enable auto-sync" to resume.';
  } else {
    dot.className = 'status-dot active';
    statusText.textContent = 'Active — syncing messages';
    setupInfo.textContent = 'Open any WhatsApp chat and messages will sync automatically.';
  }

  // Last sync time
  if (stats.lastSync) {
    const d = new Date(stats.lastSync);
    document.getElementById('lastSync').textContent = `Last sync: ${d.toLocaleTimeString()}`;
  }

  // Save button
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const token = document.getElementById('apiToken').value.trim();
    const url = document.getElementById('apiUrl').value.trim();
    const enabled = document.getElementById('enabledToggle').checked;

    await new Promise(resolve => {
      chrome.storage.sync.set({
        apiToken: token,
        apiUrl: url || DEFAULT_API_URL,
        enabled
      }, resolve);
    });

    const btn = document.getElementById('saveBtn');
    btn.textContent = 'Saved!';
    btn.style.background = '#10b981';
    setTimeout(() => {
      btn.textContent = 'Save Settings';
      btn.style.background = '';
      window.close();
    }, 1000);
  });
}

init();
