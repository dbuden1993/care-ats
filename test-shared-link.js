// Test fetching shared call review link
// Run: node test-shared-link.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;

async function test() {
  const shareLink = 'https://dialpad.com/shared/call/UPk6CMGwnZr0MTlvWBJ5NHpdbCsZXOqixu0lTwhpAam3';
  
  console.log('Fetching shared call review page...');
  console.log('URL:', shareLink);
  
  // Try fetching without auth (it's a share link)
  const res = await fetch(shareLink);
  const html = await res.text();
  
  console.log('\nResponse status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('HTML length:', html.length);
  
  // Look for any recording/audio URLs
  const patterns = [
    /https:\/\/dialpad\.com\/[^"'\s]*\.mp3/g,
    /https:\/\/dialpad\.com\/(blob|r|secureblob|dl)\/[^"'\s]*/g,
    /recording[_-]?url["']?\s*[:=]\s*["']([^"']+)/gi,
    /audio[_-]?src["']?\s*[:=]\s*["']([^"']+)/gi,
    /"url"\s*:\s*"([^"]*recording[^"]*)"/gi,
    /"url"\s*:\s*"([^"]*\.mp3[^"]*)"/gi,
  ];
  
  console.log('\nSearching for recording URLs...');
  
  for (const pattern of patterns) {
    const matches = html.match(pattern);
    if (matches) {
      console.log(`\nPattern ${pattern}:`);
      matches.forEach(m => console.log('  ', m));
    }
  }
  
  // Look for JSON data embedded in the page
  const jsonMatches = html.match(/\{[^{}]*recording[^{}]*\}/g);
  if (jsonMatches) {
    console.log('\nJSON blocks with "recording":');
    jsonMatches.slice(0, 5).forEach(m => console.log('  ', m.slice(0, 200)));
  }
  
  // Check if there's a download button/link
  const downloadMatches = html.match(/download[^>]*href=["']([^"']+)/gi);
  if (downloadMatches) {
    console.log('\nDownload links:');
    downloadMatches.forEach(m => console.log('  ', m));
  }
  
  // Save full HTML for inspection
  const fs = require('fs');
  fs.writeFileSync('shared-call-page.html', html);
  console.log('\nFull HTML saved to shared-call-page.html');
  
  // Also try with auth
  console.log('\n\nTrying with Bearer auth...');
  const authRes = await fetch(shareLink, {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const authHtml = await authRes.text();
  
  if (authHtml !== html) {
    console.log('Auth response is different!');
    console.log('Auth HTML length:', authHtml.length);
    
    for (const pattern of patterns) {
      const matches = authHtml.match(pattern);
      if (matches) {
        console.log(`\nPattern ${pattern}:`);
        matches.forEach(m => console.log('  ', m));
      }
    }
    
    fs.writeFileSync('shared-call-page-auth.html', authHtml);
    console.log('\nAuth HTML saved to shared-call-page-auth.html');
  }
}

test().catch(console.error);
