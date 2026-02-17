# CareRecruit WhatsApp Extension

A Chrome extension that reads your WhatsApp Web conversations and syncs them automatically to CareRecruit ATS.

## How to install

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `whatsapp-extension` folder
5. Click the extension icon in your toolbar
6. Paste your API token (find it in CareRecruit → Settings → WhatsApp Extension)
7. Open [WhatsApp Web](https://web.whatsapp.com) — messages sync automatically as you browse

## How it works

- When you open a chat in WhatsApp Web, the extension reads the visible messages
- New messages are captured as they arrive
- Every 6 seconds, batched messages are sent to your CareRecruit API
- Messages are matched to candidates by phone number (or name)
- AI analysis runs automatically on inbound messages

## Icon files needed

Place these PNG files in this folder (or the extension will use a text fallback):
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

You can use any square PNG. The app logo from CareRecruit works well.

## Troubleshooting

- **No messages syncing**: Check that the API token is correct in the popup
- **Token rejected**: Regenerate the token in CareRecruit Settings
- **Extension not loading**: Make sure Developer mode is on and you selected the right folder
