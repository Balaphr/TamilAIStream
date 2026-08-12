import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs'

function copyVanillaScripts() {
  return {
    name: 'copy-vanilla-scripts',
    closeBundle() {
      const vanillaJS = [
        'auth.js',
        'data-store.js', 'firebase-init.js', 'firebase-config.js',
        'r2-config.js', 'r2-upload.js', 'r2-content-sync.js',
        'player-engine.js', 'equalizer.js', 'eq-ui.js',
        'playlist-manager.js', 'search-engine.js', 'search-ui.js',
        'premium-effects.js', 'player-ui.js',
        'ai-music-assistant.js', 'ai-autofill.js', 'ai-automation.js',
        'ai-command-bot.js', 'ai-publish-check.js',
        'yt-music.js', 'script.js', 'mini-audio-player.js',
        'global-player.js', 'listening-history.js',
        'premium-landing.js',
        'builder.js', 'admin.js', 'admin-upload.js', 'admin-login.js',
        'login.js', 'profile.js', 'dashboard.js', 'site-config.js',
        'app-init.js', 'site-integration.js', 'pwa.js', 'analytics.js', 'analytics-tracker.js'
      ]

      const vanillaCSS = [
        'style.css', 'yt-music.css', 'player.css',
        'global-player.css', 'mini-audio-player.css',
        'listening-history.css', 'search-ui.css',
        'responsive.css', 'ai-glass.css', 'splash.css',
        'premium-ui.css',
        'builder.css', 'admin.css', 'admin-login.css', 'analytics.css',
        'profile.css', 'playlist.css', 'dashboard.css'
      ]

      const outDir = resolve('dist')
      if (!existsSync(outDir)) {
        mkdirSync(outDir, { recursive: true })
      }

      vanillaJS.forEach(file => {
        try {
          const src = resolve(file)
          const dest = resolve(outDir, file)
          if (existsSync(src)) {
            copyFileSync(src, dest)
          } else {
            console.warn(`[copy-vanilla-scripts] skipped missing JS: ${file}`)
          }
        } catch (err) {
          console.warn(`[copy-vanilla-scripts] failed to copy ${file}: ${err.message}`)
        }
      })

      vanillaCSS.forEach(file => {
        try {
          const src = resolve(file)
          const dest = resolve(outDir, file)
          if (existsSync(src)) {
            copyFileSync(src, dest)
          } else {
            console.warn(`[copy-vanilla-scripts] skipped missing CSS: ${file}`)
          }
        } catch (err) {
          console.warn(`[copy-vanilla-scripts] failed to copy ${file}: ${err.message}`)
        }
      })
    }
  }
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [copyVanillaScripts()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        login: 'login.html',
        builder: 'builder.html',
        playlist: 'playlist.html',
        profile: 'profile.html',
        admin: 'admin.html',
        'admin-login': 'admin-login.html',
        'admin-upload': 'admin-upload.html',
        dashboard: 'dashboard.html',
        particles: 'particles.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      }
    }
  }
})
