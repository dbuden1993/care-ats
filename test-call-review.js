// Test call review share link API
// Run: node test-call-review.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;

async function test() {
  const callId = '6304626250096640'; // From your URL
  
  console.log('Testing call review API for call:', callId);
  
  // 1. Try creating a call review share link
  console.log('\n1. Creating call review share link...');
  const reviewRes = await fetch('https://dialpad.com/api/v2/callreviewsharelink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIALPAD_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ call_id: callId })
  });
  const reviewData = await reviewRes.json();
  console.log('Response:', JSON.stringify(reviewData, null, 2));
  
  if (reviewData.link) {
    console.log('\n✅ Got share link:', reviewData.link);
    
    // Try to fetch the share link page
    console.log('\n2. Fetching share link page...');
    const pageRes = await fetch(reviewData.link);
    const pageText = await pageRes.text();
    
    // Look for recording URL in the page
    const recordingMatch = pageText.match(/https:\/\/dialpad\.com\/[^"'\s]+\.mp3/g);
    if (recordingMatch) {
      console.log('Found recording URLs:', recordingMatch);
    }
    
    // Look for any blob/recording URLs
    const blobMatch = pageText.match(/https:\/\/dialpad\.com\/(blob|r|secureblob)\/[^"'\s]+/g);
    if (blobMatch) {
      console.log('Found blob/recording URLs:', blobMatch);
    }
  }
  
  // 2. Try the AI recap endpoint
  console.log('\n3. Getting AI recap for call...');
  const recapRes = await fetch(`https://dialpad.com/api/v2/call/${callId}/ai_recap`, {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const recapData = await recapRes.json();
  console.log('AI Recap:', JSON.stringify(recapData, null, 2));
  
  // 3. Get full call details again and look at ALL fields
  console.log('\n4. Full call details...');
  const callRes = await fetch(`https://dialpad.com/api/v2/call/${callId}`, {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const callData = await callRes.json();
  console.log('All call fields:');
  Object.keys(callData).forEach(key => {
    const val = callData[key];
    if (val !== null && val !== undefined && val !== '' && 
        !(Array.isArray(val) && val.length === 0)) {
      console.log(`  ${key}:`, typeof val === 'object' ? JSON.stringify(val) : val);
    }
  });
  
  // 4. Try transcript URL endpoint
  console.log('\n5. Getting transcript URL...');
  const transcriptUrlRes = await fetch(`https://dialpad.com/api/v2/transcripts/${callId}/url`, {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const transcriptUrlData = await transcriptUrlRes.json();
  console.log('Transcript URL:', JSON.stringify(transcriptUrlData, null, 2));
}

test().catch(console.error);
