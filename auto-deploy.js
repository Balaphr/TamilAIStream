#!/usr/bin/env node
'use strict';

/**
 * Tamil AI FM - Auto Deploy Script
 * Watches for file changes and automatically deploys to Vercel.
 * 
 * Usage:
 *   node auto-deploy.js          # Watch and auto-deploy on changes
 *   node auto-deploy.js --once   # Deploy once and exit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WATCH_DIR = __dirname;
const IGNORE_DIRS = ['node_modules', '.git', '.vercel', 'dist', '.github'];
const IGNORE_FILES = ['package-lock.json', 'auto-deploy.js'];
const DEBOUNCE_MS = 5000; // Wait 5 seconds after last change before deploying

let deployTimer = null;
let isDeploying = false;
let lastDeployTime = 0;

// ============================================
// Deploy to Vercel
// ============================================
function deployToVercel() {
    if (isDeploying) {
        console.log('⏳ Deployment already in progress, skipping...');
        return;
    }

    const now = Date.now();
    if (now - lastDeployTime < 30000) {
        console.log('⏳ Waiting 30 seconds between deployments...');
        return;
    }

    isDeploying = true;
    console.log('\n🚀 Deploying to Vercel...');

    try {
        const output = execSync('vercel --prod --yes', {
            cwd: WATCH_DIR,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        console.log(output);
        lastDeployTime = Date.now();
        console.log('✅ Deployment successful!');
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
    } finally {
        isDeploying = false;
    }
}

// ============================================
// File Change Detection
// ============================================
function shouldIgnore(filePath) {
    const relativePath = path.relative(WATCH_DIR, filePath);
    const parts = relativePath.split(path.sep);

    // Check if in ignored directory
    for (const dir of IGNORE_DIRS) {
        if (parts.includes(dir)) return true;
    }

    // Check if in ignored files
    for (const file of IGNORE_FILES) {
        if (relativePath === file) return true;
    }

    return false;
}

function onFileChange(eventType, filename) {
    if (!filename) return;
    const filePath = path.join(WATCH_DIR, filename);

    if (shouldIgnore(filePath)) return;

    console.log(`📝 ${eventType}: ${filename}`);

    // Debounce - wait for changes to settle
    clearTimeout(deployTimer);
    deployTimer = setTimeout(() => {
        console.log('🔄 Changes detected, deploying...');
        deployToVercel();
    }, DEBOUNCE_MS);
}

// ============================================
// Watch Mode
// ============================================
function startWatching() {
    console.log('👀 Watching for file changes...');
    console.log('   Press Ctrl+C to stop');
    console.log('');

    // Watch all files recursively
    const watchDirs = [WATCH_DIR];

    function watchDirectory(dir) {
        try {
            fs.watch(dir, { recursive: true }, onFileChange);
        } catch (e) {
            // Recursive watch not supported on some platforms, watch subdirectories
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !shouldIgnore(path.join(dir, entry.name))) {
                    watchDirectory(path.join(dir, entry.name));
                }
            }
        }
    }

    watchDirectory(WATCH_DIR);

    // Also watch for new files/directories
    fs.watch(WATCH_DIR, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const filePath = path.join(WATCH_DIR, filename);
        if (shouldIgnore(filePath)) return;

        // If a new directory is created, watch it too
        try {
            if (fs.statSync(filePath).isDirectory()) {
                watchDirectory(filePath);
            }
        } catch (e) {
            // File might have been deleted
        }
    });
}

// ============================================
// Main
// ============================================
const args = process.argv.slice(2);

if (args.includes('--once')) {
    console.log('🚀 Deploying once...');
    deployToVercel();
} else {
    // Initial deployment
    console.log('🚀 Initial deployment...');
    deployToVercel();

    // Start watching
    setTimeout(startWatching, 2000);
}