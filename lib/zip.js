// lib/zip.js
// Minimal ZIP builder for text files (store method, no compression).
// Creates valid ZIP archives with UTF-8 file names.

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32Bytes(bytes) {
  // CRC over a Uint8Array — matches the bytes actually stored in the ZIP
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8));
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function toBytes(str) {
  return new TextEncoder().encode(str);
}

function buildLocalFileHeader(name, data, crc) {
  const nameBytes = toBytes(name);
  const header = new Uint8Array(30 + nameBytes.length + data.length);
  const dv = new DataView(header.buffer);
  let offset = 0;

  header.set([0x50, 0x4B, 0x03, 0x04], offset); offset += 4; // signature
  dv.setUint16(offset, 20, true); offset += 2;      // version needed
  dv.setUint16(offset, 0x0800, true); offset += 2;  // general purpose bit flag (UTF-8)
  dv.setUint16(offset, 0, true); offset += 2;       // compression method (store)
  dv.setUint16(offset, 0, true); offset += 2;       // mod time
  dv.setUint16(offset, 0, true); offset += 2;       // mod date
  dv.setUint32(offset, crc, true); offset += 4;     // crc32
  dv.setUint32(offset, data.length, true); offset += 4;  // compressed size
  dv.setUint32(offset, data.length, true); offset += 4;  // uncompressed size
  dv.setUint16(offset, nameBytes.length, true); offset += 2;
  dv.setUint16(offset, 0, true); offset += 2;       // extra field length

  header.set(nameBytes, offset); offset += nameBytes.length;
  header.set(data, offset);

  return header;
}

function buildCentralDirectory(entries, offset) {
  let dir = new Uint8Array(0);
  let startOffset = 0;

  for (const entry of entries) {
    const nameBytes = toBytes(entry.name);
    const h = new Uint8Array(46 + nameBytes.length);
    const dv = new DataView(h.buffer);
    let o = 0;

    h.set([0x50, 0x4B, 0x01, 0x02], o); o += 4;
    dv.setUint16(o, 20, true); o += 2;
    dv.setUint16(o, 20, true); o += 2;
    dv.setUint16(o, 0x0800, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;
    dv.setUint32(o, entry.crc, true); o += 4;
    dv.setUint32(o, entry.size, true); o += 4;
    dv.setUint32(o, entry.size, true); o += 4;
    dv.setUint16(o, nameBytes.length, true); o += 2;
    dv.setUint16(o, 0, true); o += 2;    // extra
    dv.setUint16(o, 0, true); o += 2;    // comment
    dv.setUint16(o, 0, true); o += 2;    // disk start
    dv.setUint16(o, 0, true); o += 2;    // internal attrs
    dv.setUint32(o, 0, true); o += 4;   // external attrs
    dv.setUint32(o, startOffset, true); o += 4;

    h.set(nameBytes, o);

    const combined = new Uint8Array(dir.length + h.length);
    combined.set(dir);
    combined.set(h, dir.length);
    dir = combined;
    startOffset += entry.headerSize;
  }

  const eocd = new Uint8Array(22);
  const eocdDv = new DataView(eocd.buffer);
  eocd.set([0x50, 0x4B, 0x05, 0x06], 0);
  eocdDv.setUint16(4, 0, true);
  eocdDv.setUint16(6, 0, true);
  eocdDv.setUint16(8, entries.length, true);
  eocdDv.setUint16(10, entries.length, true);
  eocdDv.setUint32(12, dir.length, true);
  eocdDv.setUint32(16, offset, true);
  eocdDv.setUint16(20, 0, true);

  return new Uint8Array([...dir, ...eocd]);
}

function createZip(files) {
  // files: [{ name: string, content: string }]
  const entries = [];
  const parts = [];

  for (const file of files) {
    const data = toBytes(file.content);
    const crc = crc32Bytes(data);
    const header = buildLocalFileHeader(file.name, data, crc);
    parts.push(header);
    entries.push({
      name: file.name,
      crc,
      size: data.length,
      headerSize: header.length
    });
  }

  const localSize = parts.reduce((s, p) => s + p.length, 0);
  const cdir = buildCentralDirectory(entries, localSize);

  const all = new Uint8Array(localSize + cdir.length);
  let pos = 0;
  for (const p of parts) { all.set(p, pos); pos += p.length; }
  all.set(cdir, pos);

  return new Blob([all], { type: 'application/zip' });
}

export { createZip };
