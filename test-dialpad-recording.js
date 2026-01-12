// Test script to figure out Dialpad recording download
// Run: node test-dialpad-recording.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const DIALPAD_API_KEY = process.env.DIALPAD_API_KEY;

async function test() {
  console.log('Testing Dialpad Stats API for recordings export...\n');
  
  // Try the Stats API to export recordings
  console.log('1. Initiating stats export for calls (with recordings)...');
  
  const statsBody = {
    stat_type: 'calls',
    export_type: 'records',
    days_ago_start: 7,
    days_ago_end: 0
  };
  
  console.log('Request body:', JSON.stringify(statsBody, null, 2));
  
  const initRes = await fetch('https://dialpad.com/api/v2/stats', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DIALPAD_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(statsBody)
  });
  
  const initData = await initRes.json();
  console.log('Init response:', JSON.stringify(initData, null, 2));
  
  if (initData.request_id) {
    console.log('\n2. Waiting for export to complete...');
    
    // Poll for results - use "id" parameter instead of "request_id"
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 3000)); // Wait 3 seconds
      
      // Try different parameter names
      const statusRes = await fetch(`https://dialpad.com/api/v2/stats?id=${initData.request_id}`, {
        headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
      });
      
      const statusText = await statusRes.text();
      console.log(`Attempt ${i+1}: ${statusText.slice(0, 300)}`);
      
      try {
        const statusData = JSON.parse(statusText);
        
        if (statusData.status === 'complete' || statusData.download_url || statusData.file_url) {
          console.log('\n✅ Export complete!');
          const downloadUrl = statusData.download_url || statusData.file_url;
          console.log('Download URL:', downloadUrl);
          
          // Try to download the CSV
          if (downloadUrl) {
            console.log('\n3. Downloading CSV...');
            const csvRes = await fetch(downloadUrl, {
              headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
            });
            const csvText = await csvRes.text();
            console.log('CSV preview (first 2000 chars):');
            console.log(csvText.slice(0, 2000));
            
            // Check for recording columns
            const lines = csvText.split('\n');
            console.log('\nHeader row:', lines[0]);
            if (lines[1]) console.log('First data row:', lines[1].slice(0, 500));
          }
          break;
        }
        
        if (statusData.status === 'failed' || statusData.error) {
          console.log('❌ Export failed');
          break;
        }
        
        console.log('Status:', statusData.status);
      } catch (e) {
        // Not JSON, might still be processing
      }
    }
  }
  
  // Also try getting offices to see structure
  console.log('\n\n4. Getting office list (to try office-specific export)...');
  const officesRes = await fetch('https://dialpad.com/api/v2/offices', {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const officesData = await officesRes.json();
  console.log('Offices:', JSON.stringify(officesData, null, 2));
  
  // Try getting company info
  console.log('\n5. Getting company info...');
  const companyRes = await fetch('https://dialpad.com/api/v2/company', {
    headers: { 'Authorization': `Bearer ${DIALPAD_API_KEY}` }
  });
  const companyData = await companyRes.json();
  console.log('Company:', JSON.stringify(companyData, null, 2));
}

test().catch(console.error);
