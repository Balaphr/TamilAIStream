import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync, copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs'

const vanillaFiles = [
  'ultra-perf.js',
  'ads-display.js',
  'auth.js', 'data-store.js', 'firebase-init.js', 'firebase-config.js',
  'r2-config.js', 'r2-upload.js', 'r2-content-sync.js', 'publish-manager.js', 'admin-editor.js',
  'equalizer.js', 'eq-ui.js',
  'playlist-manager.js', 'search-engine.js', 'search-ui.js',
  'premium-effects.js',
  'ai-music-assistant.js', 'ai-autofill.js', 'ai-automation.js',
  'ai-command-bot.js', 'ai-publish-check.js',
  'yt-music.js', 'script.js',
  'unified-player.js',
  'listening-history.js', 'ai-home.js',
  'premium-landing.js',
  'builder.js', 'builder-360.js', 'ai-webflow.js', 'builder-ads.js',
  'admin.js', 'admin-upload.js', 'admin-login.js',
  'login.js', 'profile.js', 'dashboard.js', 'site-config.js',
  'app-init.js', 'site-integration.js', 'pwa.js', 'pwa-splash.js', 'analytics.js', 'analytics-tracker.js',
  'brand-config.js', 've-edit-mode.js',
  'nexvora-model-manager.js', 'nexvora-api-config.js', 'nexvora-ai-service.js', 'nexvora.js'
]

function skipVanillaTransform() {
  return {
    name: 'skip-vanilla-transform',
    enforce: 'pre',
    transform(code, id) {
      const fileName = id.split(/[\\/]/).pop()
      if (vanillaFiles.includes(fileName)) {
        return { code, map: null }
      }
    }
  }
}

function stampBuildVersion() {
  return {
    name: 'stamp-build-version',
    enforce: 'pre',
    buildStart() {
      const version = Date.now().toString()
      const versionFile = resolve('src', 'build-version.js')
      writeFileSync(versionFile, `export const BUILD_VERSION = '${version}';\n`)
      console.log(`[stamp-build-version] BUILD_VERSION = ${version}`)
    }
  }
}

function copyVanillaScripts() {
  return {
    name: 'copy-vanilla-scripts',
    closeBundle() {
      const vanillaJS = [
        'ultra-perf.js',
        'ads-display.js',
        'auth.js',
        'data-store.js', 'firebase-init.js', 'firebase-config.js',
        'r2-config.js', 'r2-upload.js', 'r2-content-sync.js', 'publish-manager.js', 'admin-editor.js',
        'equalizer.js', 'eq-ui.js',
        'playlist-manager.js', 'search-engine.js', 'search-ui.js',
        'premium-effects.js',
        'ai-music-assistant.js', 'ai-autofill.js', 'ai-automation.js',
        'ai-command-bot.js', 'ai-publish-check.js',
        'yt-music.js', 'script.js',
        'unified-player.js',
        'listening-history.js', 'ai-home.js',
        'premium-landing.js',
        'builder.js', 'builder-360.js', 'ai-webflow.js', 'builder-ads.js',
        'admin.js', 'admin-upload.js', 'admin-login.js',
        'login.js', 'profile.js', 'dashboard.js', 'site-config.js',
        'app-init.js', 'site-integration.js', 'pwa.js', 'pwa-splash.js', 'analytics.js', 'analytics-tracker.js',
        'brand-config.js', 've-edit-mode.js',
        'nexvora-model-manager.js', 'nexvora-api-config.js', 'nexvora-ai-service.js', 'nexvora.js'
      ]

      const vanillaCSS = [
        'style.css', 'yt-music.css', 'player.css',
        'ads.css',
        'listening-history.css', 'search-ui.css',
        'responsive.css', 'ai-glass.css', 'splash.css',
        'premium-ui.css', 'ultra-perf.css',
        'builder.css', 'builder-360.css', 'ai-webflow.css', 'admin.css', 'admin-upload.css', 'analytics.css',
        'login.css', 'particles.css',
        'profile.css', 'playlist.css', 'dashboard.css',
        'nexvora.css'
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
  plugins: [stampBuildVersion(), skipVanillaTransform(), copyVanillaScripts()],
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
        particles: 'particles.html',
        nexvora: 'nexvora.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true,
    hmr: { overlay: false },
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      }
    }
  },
  optimizeDeps: {
    exclude: [
      'premium-landing.js', 'script.js', 'yt-music.js', 'global-player.js',
      'premium-effects.js', 'player-engine.js', 'r2-content-sync.js',
      'pwa.js', 'ai-music-assistant.js', 'listening-history.js', 'ai-home.js',
      'builder.js', 'admin.js', 'login.js', 'profile.js', 'dashboard.js',
      'nexvora-model-manager.js', 'nexvora-api-config.js', 'nexvora-ai-service.js', 'nexvora.js'
    ]
  }
})
