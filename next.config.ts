import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'whatsapp-web.js',
    'puppeteer',
    'puppeteer-core',
    'express',
    'ws',
    'qrcode-terminal'
  ],
  turbopack: {
    resolveAlias: {
      'whatsapp-web.js': '',
      'puppeteer': '',
      'puppeteer-core': '',
    }
  }
};

export default nextConfig;
