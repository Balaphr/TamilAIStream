import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync, copyFileSync, existsSync, mkdirSync } from 'fs'

function copyVanillaScripts() {
  return {
    name: 'copy-vanilla-scripts',
    closeBundle() {
      const vanillaFiles = [
        'auth.js',
        'data-store.js', 'firebase-init.js', 'firebase-config.js',
        'r2-config.js', 'r2-upload.js', 'r2-content-sync.js',
        'player-engine.js', 'equalizer.js', 'eq-ui.js',
        'playlist-manager.js', 'search-engine.js', 'search-ui.js',
        'premium-effects.js', 'player-ui.js',
        'ai-music-assistant.js',
        'ai-autofill.js',
        'yt-music.js', 'script.js', 'mini-audio-player.js',
        'builder.js', 'admin.js', 'admin-upload.js', 'admin-login.js',
        'login.js', 'profile.js', 'dashboard.js', 'site-config.js',
        'builder-v2.js', 'builder-v2-auth.js'
      ]
      const outDir = 'dist'
      vanillaFiles.forEach(file => {
        const src = resolve(file)
        const dest = resolve(outDir, file)
        if (existsSync(src)) {
          copyFileSync(src, dest)
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
        'builder-v2': 'builder-v2.html',
        'builder-v2-login': 'builder-v2-login.html',
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
