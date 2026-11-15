import { readFileSync } from 'node:fs';
export const fontBytes = new Uint8Array(
  readFileSync(new URL('../fixtures/font/inter-latin-400.ttf', import.meta.url)),
);
// Literal test maps, independent from the production cmap parser.
export function format4() {
  const data = Buffer.alloc(48);
  // A/B use direct delta; C/D use range words with a zero hole and a delta.
  [4, 48, 0, 6, 4, 1, 2, 66, 68, 65535, 0, 65, 67, 65535, 65536 - 64, 1, 1, 0, 4, 0, 0, 4].forEach(
    (v, i) => data.writeUInt16BE(v, i * 2),
  );
  return data;
}
export function format12() {
  const data = Buffer.alloc(40);
  data.writeUInt16BE(12, 0);
  data.writeUInt32BE(40, 4);
  data.writeUInt32BE(2, 12);
  data.writeUInt32BE(65, 16);
  data.writeUInt32BE(65, 20);
  data.writeUInt32BE(1, 24);
  data.writeUInt32BE(0x1f600, 28);
  data.writeUInt32BE(0x1f601, 32);
  data.writeUInt32BE(3, 36);
  return data;
}
export function cmap(
  records: readonly { platform: number; encoding: number; table: Uint8Array }[],
) {
  const header = Buffer.alloc(4 + records.length * 8);
  header.writeUInt16BE(records.length, 2);
  let offset = header.length;
  records.forEach((r, i) => {
    const at = 4 + i * 8;
    header.writeUInt16BE(r.platform, at);
    header.writeUInt16BE(r.encoding, at + 2);
    header.writeUInt32BE(offset, at + 4);
    offset += r.table.length;
  });
  return Buffer.concat([header, ...records.map((r) => Buffer.from(r.table))]);
}
export function fontWithCmap(replacement: Uint8Array) {
  const original = Buffer.from(fontBytes),
    count = original.readUInt16BE(4);
  const chunks: Buffer[] = [Buffer.from(original.subarray(0, 12)), Buffer.alloc(count * 16)];
  let offset = 12 + count * 16,
    head = 0;
  const checksum = (data: Buffer) => {
    let total = 0;
    for (let i = 0; i < data.length; i += 4) total = (total + data.readUInt32BE(i)) >>> 0;
    return total;
  };
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16,
      tag = original.toString('ascii', at, at + 4);
    const data = Buffer.from(
      tag === 'cmap'
        ? replacement
        : original.subarray(
            original.readUInt32BE(at + 8),
            original.readUInt32BE(at + 8) + original.readUInt32BE(at + 12),
          ),
    );
    if (tag === 'head') {
      data.writeUInt32BE(0, 8);
      head = offset;
    }
    const padded = Buffer.concat([data, Buffer.alloc(-data.length & 3)]);
    const directory = chunks[1];
    if (!directory) throw new Error('Missing directory');
    directory.write(tag, i * 16, 'ascii');
    directory.writeUInt32BE(checksum(padded), i * 16 + 4);
    directory.writeUInt32BE(offset, i * 16 + 8);
    directory.writeUInt32BE(data.length, i * 16 + 12);
    chunks.push(padded);
    offset += padded.length;
  }
  const file = Buffer.concat(chunks);
  file.writeUInt32BE((0xb1b0afba - checksum(file)) >>> 0, head + 8);
  return new Uint8Array(file);
}
