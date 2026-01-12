// Check Dialpad webhook setup
// Run: node check-webhook.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;

async function checkWebhooks() {
  console.log('Checking Dialpad webhook configuration...\n');
  
  // List all webhooks
  console.log('1. Listing existing webhooks...');
  const webhooksRes = await fetch('https://dialpad.com/api/v2/webhooks', {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const webhooks = await webhooksRes.json();
  console.log('Webhooks:', JSON.stringify(webhooks, null, 2));
  
  // List call event subscriptions
  console.log('\n2. Listing call event subscriptions...');
  const subsRes = await fetch('https://dialpad.com/api/v2/subscriptions/call', {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const subs = await subsRes.json();
  console.log('Call subscriptions:', JSON.stringify(subs, null, 2));
  
  // Get user info to use for subscription
  console.log('\n3. Getting current user info...');
  const userRes = await fetch('https://dialpad.com/api/v2/users/me', {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const user = await userRes.json();
  console.log('User ID:', user.id);
  console.log('User email:', user.email);
  
  // Check if we need to create webhook and subscription
  const hasWebhook = webhooks.items?.some(w => w.hook_url?.includes('care-ats'));
  const hasSubscription = subs.items?.length > 0;
  
  console.log('\n--- Status ---');
  console.log('Has care-ats webhook:', hasWebhook);
  console.log('Has call subscriptions:', hasSubscription);
  
  if (!hasWebhook) {
    console.log('\n⚠️  No webhook found for care-ats. Creating one...');
    
    const createWebhookRes = await fetch('https://dialpad.com/api/v2/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DIALPAD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        hook_url: 'https://care-ats.vercel.app/api/dialpad'
      })
    });
    const newWebhook = await createWebhookRes.json();
    console.log('Created webhook:', JSON.stringify(newWebhook, null, 2));
    
    if (newWebhook.id) {
      console.log('\n4. Creating call event subscription...');
      
      const createSubRes = await fetch('https://dialpad.com/api/v2/subscriptions/call', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIALPAD_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhook_id: newWebhook.id,
          call_states: ['hangup', 'recording', 'voicemail'],
          target_id: user.id,
          target_type: 'user'
        })
      });
      const newSub = await createSubRes.json();
      console.log('Created subscription:', JSON.stringify(newSub, null, 2));
    }
  }
  
  console.log('\n✅ Done! Your webhook should now receive call events.');
  console.log('Test it by making a call, then check Vercel logs at:');
  console.log('https://vercel.com/YOUR_USERNAME/care-ats/logs');
}

checkWebhooks().catch(console.error);
