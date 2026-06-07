import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

// Plugin: injeta timestamp de build no sw.js para invalidar cache automaticamente
function injectSwVersion() {
  return {
    name: 'inject-sw-version',
    closeBundle() {
      const swPath = join(process.cwd(), 'dist/sw.js')
      if (!existsSync(swPath)) return
      const version = `v${Date.now()}`
      const content = readFileSync(swPath, 'utf-8')
      writeFileSync(swPath, content.replace("'__SW_VERSION__'", `'${version}'`))
      console.log(`[inject-sw-version] Cache version: ${version}`)
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    injectSwVersion(),
    VitePWA({
      registerType: 'autoUpdate',
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
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
})
