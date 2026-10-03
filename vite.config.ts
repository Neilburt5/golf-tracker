/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `base` must match the GitHub repository name.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  base: '/golf-tracker/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    // The main chunk is about 720 kB (SheetJS, see D17). It is downloaded once and
    // precached for offline use, so the default 500 kB warning is noise (D22).
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new service worker waits until the user accepts the update.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Golf Tracker',
        short_name: 'Golf',
        description: 'Registro y análisis personal de rondas de golf',
        lang: 'es',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
})