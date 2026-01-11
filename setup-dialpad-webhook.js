// Run this script ONCE to set up Dialpad webhooks
// Usage: node setup-dialpad-webhook.js

const DIALPAD_API_KEY = '8rrNCfzyn4SkW65uKNZSLQrDRGPp9bhCXUQQ6gYXP8qUYt4MCjLYyXy9BmBtZTSqnHzLj6dmXXwNvfkADtSgD4Vhvq3Eqj9ZU5er';
const WEBHOOK_URL = 'https://care-ats.vercel.app/api/dialpad';
const WEBHOOK_ID = '5151028032053248'; // Already created

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
  
  const res = await fetch(url, options);
  const text = await res.text();
  
  console.log(`${method} ${endpoint}: ${res.status}`);
  
  if (!res.ok) {
    console.error('Error:', text);
    return null;
  }
  
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function setup() {
  console.log('🔧 Setting up Dialpad call subscription...\n');
  
  // First get user info to find target IDs
  console.log('👤 Getting user info...');
  const me = await dialpadRequest('/users/me');
  console.log('User info:', JSON.stringify(me, null, 2));
  
  // Create call event subscription with required call_states
  // States: ringing, calling, connected, hangup, voicemail, recording, transcription, recap_summary, call_transcription
  console.log('\n📞 Creating call event subscription...');
  
  // Try company-wide subscription first
  if (me?.company_id) {
    console.log('Trying company-wide subscription...');
    const sub1 = await dialpadRequest('/subscriptions/call', 'POST', {
      webhook_id: WEBHOOK_ID,
      call_states: ['recording', 'hangup'],
      target_id: me.company_id.toString(),
      target_type: 'company'
    });
    
    if (sub1) {
      console.log('✅ Company subscription created:', JSON.stringify(sub1, null, 2));
    }
  }
  
  // Also try user-level subscription as fallback
  if (me?.id) {
    console.log('\n📱 Creating user-level subscription...');
    const sub2 = await dialpadRequest('/subscriptions/call', 'POST', {
      webhook_id: WEBHOOK_ID,
      call_states: ['recording', 'hangup'],
      target_id: me.id.toString(),
      target_type: 'user'
    });
    
    if (sub2) {
      console.log('✅ User subscription created:', JSON.stringify(sub2, null, 2));
    }
  }
  
  // List all subscriptions
  console.log('\n📋 Listing all subscriptions...');
  const subs = await dialpadRequest('/subscriptions');
  console.log('Subscriptions:', JSON.stringify(subs, null, 2));
  
  console.log('\n✅ Setup complete!');
  console.log('Make a test call in Dialpad and wait for it to end to verify it works!');
}

setup().catch(console.error);
