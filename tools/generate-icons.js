#!/usr/bin/env node
/**
 * Generate PWA icons from the Tamil AI Stream brand SVG logo.
 * Run: node tools/generate-icons.js
 * Requires: npm install sharp (or use canvas-based approach)
 */
const fs = require('fs');
const path = require('path');

const SVG_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="100" fill="#060e1a"/>
  <circle cx="256" cy="256" r="180" fill="url(#g)"/>
  <path d="M180 340V180l160 80-160 80z" fill="#fff" opacity=".9"/>
  <defs>
    <linearGradient id="g" x1="76" y1="76" x2="436" y2="436">
      <stop stop-color="#22d3ee"/>
      <stop offset=".5" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
</svg>`;

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

const SIZES = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
];

// Save SVG for reference
const svgPath = path.join(ICONS_DIR, 'icon.svg');
fs.writeFileSync(svgPath, SVG_LOGO);
console.log('Saved SVG:', svgPath);

// Try to use sharp if available
async function generateWithSharp() {
  const sharp = require('sharp');
  const svgBuffer = Buffer.from(SVG_LOGO);
  
  for (const icon of SIZES) {
    const outPath = path.join(ICONS_DIR, icon.name);
    await sharp(svgBuffer)
      .resize(icon.size, icon.size)
      .png()
      .toFile(outPath);
    console.log('Generated:', icon.name, `(${icon.size}x${icon.size})`);
  }
  console.log('\nAll icons generated successfully!');
}

// Fallback: save SVG files that browsers can use
function generateSVGFallback() {
  console.log('sharp not available. Saving SVG icon for browser use.');
  console.log('For production, install sharp: npm install sharp');
  console.log('Then re-run: node tools/generate-icons.js');
  
  // Save different sized SVGs
  for (const icon of SIZES) {
    const outPath = path.join(ICONS_DIR, icon.name.replace('.png', '.svg'));
    fs.writeFileSync(outPath, SVG_LOGO);
  }
  console.log('SVG icons saved.');
}

generateWithSharp().catch(generateSVGFallback);
