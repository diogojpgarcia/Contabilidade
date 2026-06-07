import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' — VitePWA dispara onNeedRefresh quando há update.
      // main.jsx mostra o banner e chama updateSW(true) para activar.
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Finanças Familiares',
        short_name: 'Finanças',
        description: 'App de gestão de finanças familiares',
        theme_color: '#0b0d10',
        background_color: '#0b0d10',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Pre-cachear assets estáticos — versão automática via content hash
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // API e Supabase nunca em cache — sempre frescos
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /supabase\.co/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
