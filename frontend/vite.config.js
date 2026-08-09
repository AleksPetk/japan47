import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// robots.txt and sitemap.xml are written by scripts/prerender.mjs after pages exist.

// Analytics is injected into the built document only for production builds,
// keeping local development and test sessions out of the production metrics.
function umamiAnalytics(enabled) {
  return {
    name: 'japan47-umami-analytics',
    transformIndexHtml() {
      if (!enabled) return []

      return [{
        tag: 'script',
        attrs: {
          defer: true,
          src: 'https://analytics.alekspetk.com/script.js',
          'data-website-id': '9e7fe0cd-c220-4850-8808-fe033aa13d74',
        },
        injectTo: 'head',
      }]
    },
  }
}

function publicUrlRewrite(publicUrl) {
  const origin = publicUrl.replace(/\/$/, '')
  return {
    name: 'japan47-public-url-rewrite',
    transformIndexHtml(html) {
      return html.replaceAll('https://example.com/', `${origin}/`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const publicUrl = process.env.VITE_PUBLIC_URL || env.VITE_PUBLIC_URL || 'http://localhost:5173'
  return {
  plugins: [
    react(),
    publicUrlRewrite(publicUrl),
    umamiAnalytics(mode === 'production'),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      // The browser keeps using its current origin (localhost on the Mac or
      // the Mac's LAN IP on a phone). Only Vite's internal hop is loopback.
      // Keeping changeOrigin disabled is essential: Django uses the request
      // host to produce image URLs, and 127.0.0.1 would point at the phone.
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/static': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
  },
}})
