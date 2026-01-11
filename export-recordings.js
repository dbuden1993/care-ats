// Export call recordings via Dialpad Stats API
// Usage: node export-recordings.js

const DIALPAD_API_KEY = '8rrNCfzyn4SkW65uKNZSLQrDRGPp9bhCXUQQ6gYXP8qUYt4MCjLYyXy9BmBtZTSqnHzLj6dmXXwNvfkADtSgD4Vhvq3Eqj9ZU5er';

async function dialpadRequest(endpoint, method = 'GET', body = null) {
  const url = `https://dialpad.com/api/v2${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${DIALPAD_API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  console.log(`${method} ${endpoint}`);
  const res = await fetch(url, options);
  const text = await res.text();
  
  if (!res.ok) {
    console.error(`Error ${res.status}:`, text.slice(0, 500));
    return null;
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log('🔍 Checking API access and scopes...\n');
  
  // Check user info
  const me = await dialpadRequest('/users/me');
  console.log('User:', me?.display_name || me?.email || JSON.stringify(me));
  
  // Try to get a single call with full details
  console.log('\n📞 Fetching a sample call...');
  const calls = await dialpadRequest('/call?limit=1&state=hangup');
  
  if (calls?.items?.[0]) {
    const call = calls.items[0];
    console.log('\nSample call structure:');
    console.log(JSON.stringify(call, null, 2));
    
    // Check if recording fields are present
    console.log('\n📼 Recording-related fields:');
    console.log('- was_recorded:', call.was_recorded);
    console.log('- recording_url:', call.recording_url);
    console.log('- call_recording_ids:', call.call_recording_ids);
    
    // Try to get full call details
    if (call.call_id) {
      console.log('\n📋 Fetching full call details...');
      const fullCall = await dialpadRequest(`/call/${call.call_id}`);
      console.log('\nFull call details:');
      console.log(JSON.stringify(fullCall, null, 2));
      
      // Check for recording URL in full details
      if (fullCall?.recording_url) {
        console.log('\n✅ RECORDING URL FOUND:', fullCall.recording_url);
      } else if (fullCall?.call_recording_ids?.length > 0) {
        console.log('\n📼 Recording IDs found:', fullCall.call_recording_ids);
        
        // Try to get recording share link
        for (const recId of fullCall.call_recording_ids) {
          console.log(`\nTrying to get share link for recording ${recId}...`);
          const shareLink = await dialpadRequest(`/recordingsharelink/${recId}`);
          console.log('Share link result:', shareLink);
        }
      } else {
        console.log('\n❌ No recording URL in call details');
      }
    }
  }
  
  // Try Stats API for recordings export
  console.log('\n\n📊 Trying Stats API for recordings export...');
  
  // Get date range for last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const statsRequest = await dialpadRequest('/stats', 'POST', {
    stat_type: 'calls',
    export_type: 'records',
    days_ago_start: 30,
    days_ago_end: 0,
  });
  
  console.log('Stats API result:', JSON.stringify(statsRequest, null, 2));
  
  // Try alternative endpoint
  console.log('\n\n🔄 Trying call recordings endpoint...');
  const recordings = await dialpadRequest('/recordings?limit=10');
  console.log('Recordings result:', JSON.stringify(recordings, null, 2));
  
  console.log('\n\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('If you see recording_url fields above, your API key has access.');
  console.log('If not, you need to contact Dialpad support to enable "recordings_export" scope.');
  console.log('\nAlternatively, you can:');
  console.log('1. Go to Dialpad Admin > Analytics > Export');
  console.log('2. Export calls with recordings');
  console.log('3. The CSV will contain recording URLs we can process');
}

main().catch(console.error);
