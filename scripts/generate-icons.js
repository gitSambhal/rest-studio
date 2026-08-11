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

// Point-in-polygon helper for lightning bolt
const boltVertices = [
  [276, 168],
  [192, 272],
  [260, 272],
  [236, 344],
  [320, 240],
  [252, 240]
];

function isInsidePolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Render single subpixel in 512x512 SVG coordinate space
 */
function sampleSubpixel(sx, sy) {
  // 1. Outer Rounded Card: [0, 0, 512, 512], rx = 128
  const R1 = 128;
  const dxCard = Math.max(0, Math.abs(sx - 256) - (256 - R1));
  const dyCard = Math.max(0, Math.abs(sy - 256) - (256 - R1));
  const distCard = Math.sqrt(dxCard * dxCard + dyCard * dyCard);

  if (distCard > R1) {
    return [0, 0, 0, 0]; // Transparent outside card
  }

  // Base background gradient: #0f172a to #020617
  const tGrad = Math.min(1, Math.max(0, (sx + sy) / 1024));
  let r = Math.round(15 + (2 - 15) * tGrad);
  let g = Math.round(23 + (6 - 23) * tGrad);
  let b = Math.round(42 + (23 - 42) * tGrad);
  let a = 255;

  // 2. Inner Border: [16, 16, 496, 496] (width 480, height 480), rx = 112, stroke-width = 8
  const R2 = 112;
  const dxInner = Math.max(0, Math.abs(sx - 256) - (240 - R2));
  const dyInner = Math.max(0, Math.abs(sy - 256) - (240 - R2));
  const distInner = Math.sqrt(dxInner * dxInner + dyInner * dyInner);
  if (Math.abs(distInner - R2) <= 4) {
    // Inner stroke #1e293b (30, 41, 59)
    r = 30; g = 41; b = 59;
  }

  // 3. Pulse Dashed Ring: cx=256, cy=256, r=180, stroke=4, dasharray=16 12, opacity=0.3
  const distCenter = Math.hypot(sx - 256, sy - 256);
  if (Math.abs(distCenter - 180) <= 2) {
    let angle = Math.atan2(sy - 256, sx - 256);
    if (angle < 0) angle += Math.PI * 2;
    const arcLen = angle * 180;
    if ((arcLen % 28) < 16) {
      // Overlay #10b981 (16, 185, 129) at opacity 0.35
      r = Math.round(r * 0.65 + 16 * 0.35);
      g = Math.round(g * 0.65 + 185 * 0.35);
      b = Math.round(b * 0.65 + 129 * 0.35);
    }
  }

  // 4. Central Box: x=128, y=128, w=256, h=256, rx=64
  const R3 = 64;
  const dxBox = Math.max(0, Math.abs(sx - 256) - (128 - R3));
  const dyBox = Math.max(0, Math.abs(sy - 256) - (128 - R3));
  const distBox = Math.sqrt(dxBox * dxBox + dyBox * dyBox);

  // Soft glow around box
  if (distBox > R3 && distBox <= R3 + 24) {
    const glowOpacity = (1 - (distBox - R3) / 24) * 0.25;
    r = Math.round(r * (1 - glowOpacity) + 16 * glowOpacity);
    g = Math.round(g * (1 - glowOpacity) + 185 * glowOpacity);
    b = Math.round(b * (1 - glowOpacity) + 129 * glowOpacity);
  }

  // Inside central box
  if (distBox <= R3) {
    // Box gradient: #10b981 (16, 185, 129) to #14b8a6 (20, 184, 166)
    const tBox = Math.min(1, Math.max(0, ((sx - 128) + (sy - 128)) / 512));
    r = Math.round(16 + (20 - 16) * tBox);
    g = Math.round(185 + (184 - 185) * tBox);
    b = Math.round(129 + (166 - 129) * tBox);

    // 5. Lightning Bolt (Zap) inside box: fill #020617 (2, 6, 23)
    if (isInsidePolygon(sx, sy, boltVertices)) {
      r = 2; g = 6; b = 23;
    }
  }

  return [r, g, b, a];
}

function createPngBuffer(width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);  // 8 bits per channel
  ihdrData.writeUInt8(6, 9);  // RGBA color type
  ihdrData.writeUInt8(0, 10); // Compression
  ihdrData.writeUInt8(0, 11); // Filter
  ihdrData.writeUInt8(0, 12); // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const scanlines = [];
  const scale = 512 / width;

  // 2x2 Subpixel sampling for clean anti-aliasing
  const subOffsets = [0.25, 0.75];

  for (let y = 0; y < height; y++) {
    const row = [0]; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      let accR = 0, accG = 0, accB = 0, accA = 0;

      for (const syOff of subOffsets) {
        for (const sxOff of subOffsets) {
          const sx = (x + sxOff) * scale;
          const sy = (y + syOff) * scale;
          const [r, g, b, a] = sampleSubpixel(sx, sy);
          accR += r;
          accG += g;
          accB += b;
          accA += a;
        }
      }

      row.push(
        Math.round(accR / 4),
        Math.round(accG / 4),
        Math.round(accB / 4),
        Math.round(accA / 4)
      );
    }
    scanlines.push(Buffer.from(row));
  }

  const rawData = Buffer.concat(scanlines);
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createIcoFromPngs(pngImages) {
  const count = pngImages.length;
  const headerSize = 6;
  const directorySize = 16 * count;
  let currentOffset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  const buffers = [];

  pngImages.forEach(({ width, height, buffer }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(currentOffset, 12);

    entries.push(entry);
    buffers.push(buffer);
    currentOffset += buffer.length;
  });

  return Buffer.concat([header, ...entries, ...buffers]);
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
  { name: 'Square30x30Logo.png', width: 30, height: 30 },
  { name: 'Square44x44Logo.png', width: 44, height: 44 },
  { name: 'Square71x71Logo.png', width: 71, height: 71 },
  { name: 'Square89x89Logo.png', width: 89, height: 89 },
  { name: 'Square150x150Logo.png', width: 150, height: 150 },
  { name: 'Square310x310Logo.png', width: 310, height: 310 },
  { name: 'StoreLogo.png', width: 50, height: 50 },
];

const generatedPngs = [];

sizes.forEach(({ name, width, height }) => {
  const pngBuf = createPngBuffer(width, height);
  const targetPath = path.join(iconsDir, name);
  fs.writeFileSync(targetPath, pngBuf);
  generatedPngs.push({ width, height, buffer: pngBuf });
  console.log(`[Icon Generator] Created SVG-matched PNG: ${targetPath} (${width}x${height})`);
});

// Create root icon.png and public/icon.png
const rootPng = createPngBuffer(512, 512);
fs.writeFileSync(path.resolve('icon.png'), rootPng);
fs.writeFileSync(path.resolve('public/icon.png'), rootPng);

// Create valid ICO file containing 32x32 and 256x256 icon images
const png32 = generatedPngs.find(p => p.width === 32) || { width: 32, height: 32, buffer: createPngBuffer(32, 32) };
const png256 = generatedPngs.find(p => p.width === 256) || { width: 256, height: 256, buffer: createPngBuffer(256, 256) };
const icoBuf = createIcoFromPngs([png32, png256]);
fs.writeFileSync(path.resolve('src-tauri/icons/icon.ico'), icoBuf);

// Ensure public/js/neutralino.js exists so vite build copies it to dist/js/neutralino.js
const rootJs = path.resolve('js/neutralino.js');
const publicJsDir = path.resolve('public/js');
if (fs.existsSync(rootJs)) {
  fs.mkdirSync(publicJsDir, { recursive: true });
  fs.copyFileSync(rootJs, path.join(publicJsDir, 'neutralino.js'));
  console.log('[Icon Generator] Synced js/neutralino.js to public/js/neutralino.js!');
}

console.log('[Icon Generator] All SVG-matched icons (public/icon.png, icon.png, src-tauri/icons/*) successfully generated!');


