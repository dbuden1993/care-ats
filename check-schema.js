// Check what columns exist in candidates and call_history tables
// Run: node check-schema.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
  console.log('Checking database schema...\n');
  
  // Try to get one row from candidates to see columns
  console.log('=== CANDIDATES TABLE ===');
  const { data: candidate, error: candError } = await supabase
    .from('candidates')
    .select('*')
    .limit(1)
    .single();
  
  if (candidate) {
    console.log('Columns found:', Object.keys(candidate).join(', '));
    console.log('\nSample data:');
    Object.entries(candidate).forEach(([key, value]) => {
      const preview = typeof value === 'string' ? value.slice(0, 50) : JSON.stringify(value);
      console.log(`  ${key}: ${preview}`);
    });
  } else {
    console.log('No candidates found, trying empty insert to see error...');
    const { error } = await supabase.from('candidates').insert([{ name: 'Test' }]);
    console.log('Insert error:', error?.message);
  }
  
  // Try to get one row from call_history to see columns
  console.log('\n=== CALL_HISTORY TABLE ===');
  const { data: callHist, error: callError } = await supabase
    .from('call_history')
    .select('*')
    .limit(1)
    .single();
  
  if (callHist) {
    console.log('Columns found:', Object.keys(callHist).join(', '));
    console.log('\nSample data:');
    Object.entries(callHist).forEach(([key, value]) => {
      const preview = typeof value === 'string' ? value.slice(0, 50) : JSON.stringify(value);
      console.log(`  ${key}: ${preview}`);
    });
  } else {
    console.log('No call_history found or error:', callError?.message);
  }
  
  // Also check if there's a specific required field
  console.log('\n=== TESTING MINIMAL INSERT ===');
  
  // Test candidates minimal insert
  const testPhone = `+44test${Date.now()}`;
  const { data: testCand, error: testCandError } = await supabase
    .from('candidates')
    .insert([{ name: 'Test Candidate', phone: testPhone }])
    .select('id')
    .single();
  
  if (testCand) {
    console.log('✅ Candidates: minimal insert works (name + phone)');
    // Clean up
    await supabase.from('candidates').delete().eq('id', testCand.id);
  } else {
    console.log('❌ Candidates minimal insert failed:', testCandError?.message);
  }
}

checkSchema().catch(console.error);
