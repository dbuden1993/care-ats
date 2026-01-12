// Analyze shared call page and try to get recording
// Run: node analyze-shared-page.js

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;

async function test() {
  // The share link ID
  const shareId = 'UPk6CMGwnZr0MTlvWBJ5NHpdbCsZXOqixu0lTwhpAam3';
  const callId = '6304626250096640';
  const recordingId = '6501907050012672';
  
  console.log('Testing various API endpoints for recording download...\n');
  
  // 1. Try getting the shared call data via API
  console.log('1. Try shared call API endpoint...');
  const endpoints = [
    `https://dialpad.com/api/v2/callreviewsharelink/${shareId}`,
    `https://dialpad.com/api/v2/shared/call/${shareId}`,
    `https://dialpad.com/shared/call/${shareId}/recording`,
    `https://dialpad.com/shared/call/${shareId}/download`,
    `https://dialpad.com/api/v2/call/${callId}/recording`,
    `https://dialpad.com/r/${recordingId}`,
    `https://dialpad.com/secureblob/callrecording/${recordingId}`,
    `https://dialpad.com/secureblob/adminrecording/${recordingId}`,
  ];
  
  for (const url of endpoints) {
    console.log(`\nTrying: ${url}`);
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
      });
      const contentType = res.headers.get('content-type');
      console.log(`  Status: ${res.status}, Type: ${contentType}`);
      
      if (contentType?.includes('audio') || contentType?.includes('octet-stream')) {
        console.log('  ✅ FOUND AUDIO!');
        const buffer = await res.arrayBuffer();
        console.log(`  Size: ${buffer.byteLength} bytes`);
        
        // Save it
        fs.writeFileSync('test-recording.mp3', Buffer.from(buffer));
        console.log('  Saved to test-recording.mp3');
        return;
      }
      
      if (contentType?.includes('json')) {
        const data = await res.json();
        console.log('  JSON:', JSON.stringify(data).slice(0, 300));
        
        // Check for recording URL in response
        if (data.recording_url || data.url || data.download_url || data.link) {
          console.log('  Found URL field:', data.recording_url || data.url || data.download_url || data.link);
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  // 2. Try the callreviewsharelink GET endpoint
  console.log('\n\n2. Get call review share link details...');
  const shareLinkRes = await fetch(`https://dialpad.com/api/v2/callreviewsharelink/${shareId}`, {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  console.log('Status:', shareLinkRes.status);
  const shareLinkData = await shareLinkRes.json();
  console.log('Data:', JSON.stringify(shareLinkData, null, 2));
  
  // 3. Check if there are recording share links already
  console.log('\n\n3. List all recording share links...');
  const recShareRes = await fetch('https://dialpad.com/api/v2/recordingsharelink', {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  console.log('Status:', recShareRes.status);
  if (recShareRes.ok) {
    const recShareData = await recShareRes.json();
    console.log('Recording share links:', JSON.stringify(recShareData, null, 2));
  }
  
  // 4. Try updating the call review share link to include recording
  console.log('\n\n4. Try updating share link settings...');
  const updateRes = await fetch(`https://dialpad.com/api/v2/callreviewsharelink/${shareId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${DIALPAD_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      include_recording: true,
      privacy: 'public'
    })
  });
  console.log('Update status:', updateRes.status);
  const updateData = await updateRes.json();
  console.log('Update response:', JSON.stringify(updateData, null, 2));
}

test().catch(console.error);
