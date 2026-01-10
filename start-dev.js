// start-dev.js - Run this instead of "npm run dev"
// This starts both Next.js and the WhatsApp service together

const { spawn } = require('child_process');
const path = require('path');

console.log(`
╔════════════════════════════════════════════════════════════╗
║              Care ATS - Development Server                 ║
╠════════════════════════════════════════════════════════════╣
║  Starting Next.js + WhatsApp Service...                   ║
╚════════════════════════════════════════════════════════════╝
`);

// Start WhatsApp service
const whatsapp = spawn('node', ['whatsapp-service.js'], {
  cwd: process.cwd(),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

whatsapp.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => console.log(`[WhatsApp] ${line}`));
});

whatsapp.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l.trim());
  lines.forEach(line => console.log(`[WhatsApp] ${line}`));
});

whatsapp.on('error', (err) => {
  console.error('[WhatsApp] Failed to start:', err.message);
});

// Start Next.js after a brief delay
setTimeout(() => {
  const next = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  next.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => console.log(`[Next.js] ${line}`));
  });

  next.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => console.log(`[Next.js] ${line}`));
  });

  next.on('error', (err) => {
    console.error('[Next.js] Failed to start:', err.message);
  });

  // Handle exit
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    whatsapp.kill();
    next.kill();
    process.exit(0);
  });

}, 1000);
