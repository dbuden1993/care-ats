// Run this script ONCE to set up Dialpad webhooks
// Usage: node setup-dialpad-webhook.js

const DIALPAD_API_KEY = '8rrNCfzyn4SkW65uKNZSLQrDRGPp9bhCXUQQ6gYXP8qUYt4MCjLYyXy9BmBtZTSqnHzLj6dmXXwNvfkADtSgD4Vhvq3Eqj9ZU5er';
const WEBHOOK_URL = 'https://care-ats.vercel.app/api/dialpad';

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
  console.log('🔧 Setting up Dialpad webhook...\n');
  
  // Step 1: List existing webhooks
  console.log('📋 Checking existing webhooks...');
  const existingWebhooks = await dialpadRequest('/webhooks');
  console.log('Existing webhooks:', JSON.stringify(existingWebhooks, null, 2));
  
  // Step 2: Create a new webhook
  console.log('\n🆕 Creating webhook...');
  const webhook = await dialpadRequest('/webhooks', 'POST', {
    hook_url: WEBHOOK_URL,
    // secret: 'your-secret-here', // Optional: for JWT signing
  });
  
  if (!webhook || !webhook.id) {
    console.error('❌ Failed to create webhook');
    return;
  }
  
  console.log('✅ Webhook created:', webhook);
  const webhookId = webhook.id;
  
  // Step 3: Create call event subscription
  console.log('\n📞 Creating call event subscription...');
  const subscription = await dialpadRequest('/subscriptions/call', 'POST', {
    webhook_id: webhookId,
    // Subscribe to company-wide events
    // You can also target specific users/offices/call_centers
  });
  
  if (subscription) {
    console.log('✅ Call subscription created:', subscription);
  } else {
    console.log('⚠️ Could not create call subscription - may need company admin access');
  }
  
  // Step 4: Verify setup
  console.log('\n🔍 Verifying setup...');
  const allWebhooks = await dialpadRequest('/webhooks');
  console.log('All webhooks:', JSON.stringify(allWebhooks, null, 2));
  
  console.log('\n✅ Setup complete!');
  console.log(`Webhook URL: ${WEBHOOK_URL}`);
  console.log(`Webhook ID: ${webhookId}`);
  console.log('\nNow make a test call in Dialpad to verify it works!');
}

setup().catch(console.error);
