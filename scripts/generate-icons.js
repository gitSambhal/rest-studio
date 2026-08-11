import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// CRC32 implementation for PNG chunk validation
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPngBuffer(width, height) {
  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // 8 bits per channel
  ihdrData.writeUInt8(6, 9);  // RGBA color type
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Generate image pixels (Emerald/Teal icon with dark rounded box)
  const scanlines = [];
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    const row = [0]; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Emerald / Teal gradient (#10b981 to #0f766e)
        const t = (x + y) / (width + height);
        const r = Math.round(16 + (15 - 16) * t);
        const g = Math.round(185 + (118 - 185) * t);
        const b = Math.round(129 + (110 - 129) * t);
        row.push(r, g, b, 255);
      } else {
        // Transparent
        row.push(0, 0, 0, 0);
      }
    }
    scanlines.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(scanlines);
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Generate all required Tauri and Neutralino icon sizes
const iconsDir = path.resolve('src-tauri/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [
  { name: '32x32.png', width: 32, height: 32 },
  { name: '128x128.png', width: 128, height: 128 },
  { name: '128x128@2x.png', width: 256, height: 256 },
  { name: 'icon.png', width: 512, height: 512 },
];

sizes.forEach(({ name, width, height }) => {
  const pngBuf = createPngBuffer(width, height);
  const targetPath = path.join(iconsDir, name);
  fs.writeFileSync(targetPath, pngBuf);
  console.log(`[Icon Generator] Created valid PNG: ${targetPath} (${width}x${height})`);
});

// Also create root icon.png and public/icon.png
const rootPng = createPngBuffer(512, 512);
fs.writeFileSync(path.resolve('icon.png'), rootPng);
fs.writeFileSync(path.resolve('public/icon.png'), rootPng);
fs.writeFileSync(path.resolve('src-tauri/icons/icon.ico'), rootPng);

console.log('[Icon Generator] All icons successfully generated with valid PNG signatures!');
