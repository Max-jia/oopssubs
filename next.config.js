/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // DISABLE_PWA=true for Capacitor app builds — service worker breaks navigation in the WebView
  disable: process.env.NODE_ENV === 'development' || process.env.DISABLE_PWA === 'true'
})

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // Folder-style output (/app -> app/index.html) — required so Capacitor's
  // local server can resolve routes; flat app.html files fall back to index.html
  trailingSlash: true,
}

module.exports = withPWA(nextConfig)
