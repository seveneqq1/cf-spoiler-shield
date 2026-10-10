const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const pixel = pixels(x, y);
      const offset = row + 1 + x * 4;
      raw[offset] = pixel[0];
      raw[offset + 1] = pixel[1];
      raw[offset + 2] = pixel[2];
      raw[offset + 3] = pixel[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c;
}

function icon(size) {
  return png(size, (x, y) => {
    const nx = (x + 0.5) / size;
    const ny = (y + 0.5) / size;
    const inShield = ny > 0.12 && ny < 0.9 && Math.abs(nx - 0.5) < (ny < 0.58 ? 0.34 : 0.34 * (0.9 - ny) / 0.32);
    if (!inShield) return [22, 22, 28, 0];
    const bar = (ny > 0.34 && ny < 0.4) || (ny > 0.48 && ny < 0.54) || (ny > 0.62 && ny < 0.68);
    const barX = Math.abs(nx - 0.5) < 0.16;
    if (bar && barX) return [236, 234, 244, 255];
    return [123, 108, 246, 255];
  });
}

const dir = path.join(__dirname, "../icons");
fs.mkdirSync(dir, { recursive: true });
[16, 32, 48, 128].forEach((size) => {
  fs.writeFileSync(path.join(dir, `icon${size}.png`), icon(size));
});
