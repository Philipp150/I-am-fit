import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const FOREST = [47, 93, 80];
const CREAM = [255, 251, 244];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = paint(x, y, size);
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function onSegment(px, py, ax, ay, bx, by, width) {
  const length = dist(ax, ay, bx, by) || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / (length * length)));
  const qx = ax + t * (bx - ax);
  const qy = ay + t * (by - ay);
  return dist(px, py, qx, qy) <= width;
}

function paint(x, y, size) {
  const nx = x / (size - 1);
  const ny = y / (size - 1);
  const radius = 0.18;
  const inRound =
    (nx < radius && ny < radius && dist(nx, ny, radius, radius) > radius) ||
    (nx > 1 - radius && ny < radius && dist(nx, ny, 1 - radius, radius) > radius) ||
    (nx < radius && ny > 1 - radius && dist(nx, ny, radius, 1 - radius) > radius) ||
    (nx > 1 - radius && ny > 1 - radius && dist(nx, ny, 1 - radius, 1 - radius) > radius);
  if (inRound) return [244, 239, 230];

  const stroke = 0.035;
  const head = dist(nx, ny, 0.5, 0.28) <= 0.11;
  const body = onSegment(nx, ny, 0.5, 0.4, 0.5, 0.64, stroke);
  const arms = onSegment(nx, ny, 0.28, 0.5, 0.72, 0.5, stroke);
  const leftLeg = onSegment(nx, ny, 0.5, 0.64, 0.34, 0.86, stroke);
  const rightLeg = onSegment(nx, ny, 0.5, 0.64, 0.66, 0.86, stroke);
  if (head || body || arms || leftLeg || rightLeg) return CREAM;
  return FOREST;
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../public/icon-${size}.png`, import.meta.url), png(size, paint));
  console.log(`Wrote public/icon-${size}.png`);
}
