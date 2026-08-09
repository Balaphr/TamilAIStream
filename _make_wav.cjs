// Generate a 5-minute silence WAV for real-media seek testing
const fs = require('fs');
const sampleRate = 8000;
const seconds = 300; // 5 minutes
const numSamples = sampleRate * seconds;
const dataSize = numSamples; // 8-bit mono
const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);          // fmt chunk size
buffer.writeUInt16LE(1, 20);           // PCM
buffer.writeUInt16LE(1, 22);           // mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate, 28);  // byte rate
buffer.writeUInt16LE(1, 32);           // block align
buffer.writeUInt16LE(8, 34);           // bits per sample
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);
// quiet 8-bit silence = 128
buffer.fill(128, 44);

fs.writeFileSync('_silence.wav', buffer);
console.log('Wrote _silence.wav', buffer.length, 'bytes');