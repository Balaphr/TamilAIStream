'use strict';
// Pure-Node PWA icon generator for Tamil AI Stream.
// Produces manifest icons, apple-touch icon and favicon as PNG files.
// No external dependencies. Usage: node _gen_icons.cjs

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'public', 'icons');

// ---------- Minimal PNG encoder ----------
function crc32(buf) {
    let c, table = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 6;   // color type RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    const raw = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        raw[y * (1 + width * 4)] = 0; // filter: None
        rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
    }
    const idat = zlib.deflateSync(raw, { level: 9 });
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- Drawing helpers (all coords/pixels in absolute px) ----------
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.max(x0 + r, Math.min(x, x1 - r));
    const cy = Math.max(y0 + r, Math.min(y, y1 - r));
    const dx = x - cx, dy = y - cy;
    return (dx * dx + dy * dy) <= r * r;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function makeCanvas(size) {
    const buf = Buffer.alloc(size * size * 4);
    return { size, buf };
}

function setPx(c, x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= c.size || y >= c.size) return;
    const i = (y * c.size + x) * 4;
    const dstA = c.buf[i + 3] / 255;
    const srcA = a / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA <= 0) return;
    c.buf[i] = Math.round((r * srcA + c.buf[i] * dstA * (1 - srcA)) / outA);
    c.buf[i + 1] = Math.round((g * srcA + c.buf[i + 1] * dstA * (1 - srcA)) / outA);
    c.buf[i + 2] = Math.round((b * srcA + c.buf[i + 2] * dstA * (1 - srcA)) / outA);
    c.buf[i + 3] = Math.round(outA * 255);
}

function drawHeadphones(c, S, cx, cy, scale, palette) {
    // Headband: upper ring centered below top of glyph
    const bandCx = cx, bandCy = cy + 58 * scale;
    const bandR = 128 * scale;
    const bandT = 26 * scale;
    const t1 = bandR - bandT / 2, t2 = bandR + bandT / 2;
    const x0 = Math.floor(bandCx - t2 - 4), x1 = Math.ceil(bandCx + t2 + 4);
    const y0 = Math.floor(bandCy - t2), y1 = Math.ceil(bandCy + 30 * scale);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const d = Math.hypot(x - bandCx, y - bandCy);
            if (d >= t1 && d <= t2 && y <= bandCy) {
                const t = (y - Math.max(bandCy - t2, y0)) / Math.max(1, t2);
                setPx(c, x, y, lerp(palette.c1[0], palette.c2[0], t), lerp(palette.c1[1], palette.c2[1], t), lerp(palette.c1[2], palette.c2[2], t), 255);
            }
        }
    }
    // Ear pads: rounded rects on left & right
    const padW = 62 * scale, padH = 116 * scale, padR = 24 * scale;
    const padY0 = cy + 128 * scale, padY1 = padY0 + padH;
    const padX0L = cx - 206 * scale, padX1L = padX0L + padW;
    const padX0R = cx + 144 * scale, padX1R = padX0R + padW;
    let col = palette.c2;
    for (let y = padY0; y <= padY1; y++) {
        const t = (y - padY0) / padH;
        for (let x = padX0L; x <= padX1L; x++) {
            if (inRoundedRect(x, y, padX0L, padY0, padX1L, padY1, padR)) {
                const lt = Math.max(0, Math.min(1, (y - cy) / (S * 1.6)));
                setPx(c, x, y, lerp(palette.c1[0], col[0], lt), lerp(palette.c1[1], col[1], lt), lerp(palette.c1[2], col[2], lt), 255);
            }
        }
        for (let x = padX0R; x <= padX1R; x++) {
            if (inRoundedRect(x, y, padX0R, padY0, padX1R, padY1, padR)) {
                const lt = Math.max(0, Math.min(1, (y - cy) / (S * 1.6)));
                setPx(c, x, y, lerp(palette.c1[0], col[0], lt), lerp(palette.c1[1], col[1], lt), lerp(palette.c1[2], col[2], lt), 255);
            }
        }
    }
    // Center mic capsule
    const micW = 44 * scale, micH = 70 * scale, micR = 22 * scale;
    const micX0 = cx - micW / 2, micX1 = cx + micW / 2, micy0 = cy + 152 * scale, micy1 = micy0 + micH;
    for (let y = micy0; y <= micy1; y++) {
        for (let x = Math.floor(micX0); x <= micX1; x++) {
            if (inRoundedRect(x, y, micX0, micy0, micX1, micy1, micR)) {
                setPx(c, x, y, palette.c1[0], palette.c1[1], palette.c1[2], 255);
            }
        }
    }
}

function drawGlyph(c, S, maskable) {
    const cx = S / 2;
    const cy = maskable ? S * 0.44 : S * 0.5;
    const scale = S / 512;
    const palette = {
        c1: [16, 185, 129],   // emerald #10b981
        c2: [34, 211, 238]    // cyan #22d3ee
    };
    // Soft glow behind glyph
    const glowR = 200 * scale;
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const d = Math.hypot(x - cx, y - cy + 20 * scale);
            if (d < glowR) {
                const a = Math.max(0, 1 - d / glowR) * 60;
                setPx(c, x, y, 20, 210, 200, a);
            }
        }
    }
    if (maskable) {
        // For maskable icons draw inside the safe zone (>=40px padding at 512)
        const pad = 56 * scale;
        drawHeadphones(c, S, cx, cy, Math.max(0.78, scale * 0.9), palette);
    } else {
        drawHeadphones(c, S, cx, cy, scale, palette);
    }
}

function renderIcon(size, { maskable = false, rounded = false } = {}) {
    const c = makeCanvas(size);
    const S = size;
    const corner = rounded ? Math.round(S * 0.22) : 0;

    // Background gradient
    const cTop = [10, 14, 28];   // #0a0e1c
    const cBot = [4, 6, 14];     // #04060e
    for (let y = 0; y < S; y++) {
        const t = y / S;
        const bg = [lerp(cTop[0], cBot[0], t), lerp(cTop[1], cBot[1], t), lerp(cTop[2], cBot[2], t)];
        for (let x = 0; x < S; x++) {
            if (rounded) {
                if (!inRoundedRect(x, y, 0, 0, S - 1, S - 1, corner)) continue;
            }
            setPx(c, x, y, bg[0], bg[1], bg[2], 255);
        }
    }
    drawGlyph(c, S, maskable);
    return encodePNG(S, S, c.buf);
}

function write(name, buf) {
    fs.writeFileSync(path.join(OUT_DIR, name), buf);
    console.log('wrote', path.join(OUT_DIR, name), buf.length, 'bytes');
}

fs.mkdirSync(OUT_DIR, { recursive: true });
write('icon-192.png', renderIcon(192, { rounded: true }));
write('icon-512.png', renderIcon(512, { rounded: true }));
write('icon-maskable-512.png', renderIcon(512, { maskable: true }));
write('apple-touch-icon.png', renderIcon(180));
write('favicon-32.png', renderIcon(32, { rounded: true }));
console.log('Done.');