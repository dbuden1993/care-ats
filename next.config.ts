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
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle these packages on the server
      config.externals = config.externals || [];
      config.externals.push({
        'whatsapp-web.js': 'commonjs whatsapp-web.js',
        'puppeteer': 'commonjs puppeteer',
        'puppeteer-core': 'commonjs puppeteer-core',
      });
    }
    return config;
  },
  experimental: {
    turbo: {
      resolveAlias: {
        'whatsapp-web.js': false,
        'puppeteer': false,
        'puppeteer-core': false,
      }
    }
  }
};

export default nextConfig;
