import { ZlozError } from './graph';

/** Trusted host-supplied single-face TrueType sfnt; not a URL or a sanitizer result. */
export type ZlozSvgFontResource = Readonly<{
  assetId: string;
  format: 'truetype';
  bytes: Uint8Array;
}>;
export type ZlozSvgFontFailureCode =
  | 'font-resource-invalid'
  | 'font-format-unsupported'
  | 'font-resource-limit';
/** Valid means structural checks passed, not glyph, shaping or security qualification. */
export type ZlozSvgFontValidation =
  | Readonly<{
      type: 'valid';
      byteLength: number;
      tableCount: number;
      weight: number;
      dataUrl: string;
    }>
  | Readonly<{ type: 'invalid'; code: ZlozSvgFontFailureCode; reason: string }>;
class FontValidationError extends Error {
  constructor(
    readonly code: ZlozSvgFontFailureCode,
    reason: string,
  ) {
    super(reason);
  }
}
function fail(reason: string, code: ZlozSvgFontFailureCode = 'font-resource-invalid'): never {
  throw new FontValidationError(code, reason);
}
function base64(bytes: Uint8Array): string {
  // oxlint-disable-next-line linteffect/no-string-sentinel-const -- Base64 alphabet is encoding data, not a status token.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  // oxlint-disable-next-line linteffect/no-string-sentinel-const -- Bounded text accumulator, not a status token.
  let block = '';
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset] ?? 0,
      b = bytes[offset + 1] ?? 0,
      c = bytes[offset + 2] ?? 0;
    block +=
      alphabet.charAt(a >> 2) +
      alphabet.charAt(((a & 3) << 4) | (b >> 4)) +
      (offset + 1 < bytes.length ? alphabet.charAt(((b & 15) << 2) | (c >> 6)) : '=') +
      (offset + 2 < bytes.length ? alphabet.charAt(c & 63) : '=');
    if (block.length >= 8192) {
      chunks.push(block);
      block = '';
    }
  }
  chunks.push(block);
  return chunks.join('');
}
/** No IO or platform font APIs. Copies bytes; budgets are checked before copying/encoding. */
export function validateSvgFontResource(
  resource: ZlozSvgFontResource,
  options: Readonly<{ maxBytes?: number }> = {},
): ZlozSvgFontValidation {
  const maxBytes = options.maxBytes ?? 1048576;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16777216)
    throw new ZlozError('invalid-edit', 'Font maxBytes must be an integer from 1 to 16777216.');
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free core converts bounded synchronous byte validation failures to data; no Effect dependency.
  try {
    if (resource.format !== 'truetype')
      fail('Only single-face TrueType sfnt font bytes are supported.', 'font-format-unsupported');
    if (!(resource.bytes instanceof Uint8Array)) fail('Font bytes must be a Uint8Array.');
    if (resource.bytes.byteLength > maxBytes)
      fail('Font bytes exceed the configured byte budget.', 'font-resource-limit');
    if (!resource.assetId.trim()) fail('Font resources need a non-blank asset ID.');
    const bytes = new Uint8Array(resource.bytes);
    if (bytes.length < 12 || bytes.length % 4 !== 0) fail('Truncated or unaligned TrueType file.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0) !== 0x00010000)
      fail('Font signature is not a single-face TrueType sfnt.', 'font-format-unsupported');
    const count = view.getUint16(4),
      directoryEnd = 12 + count * 16;
    if (count === 0 || count > 256 || directoryEnd > bytes.length)
      fail('Invalid or truncated TrueType table directory.');
    const exponent = Math.floor(Math.log2(count)),
      searchRange = 16 * 2 ** exponent;
    if (
      view.getUint16(6) !== searchRange ||
      view.getUint16(8) !== exponent ||
      view.getUint16(10) !== 16 * count - searchRange
    )
      fail('Invalid TrueType directory search fields.');
    const checksum = (start: number, length: number, head = false) => {
      let sum = 0;
      for (let at = 0; at < length; at += 4) {
        let word = 0;
        for (let i = 0; i < 4; i++)
          word =
            word * 256 +
            (at + i < length && !(head && at + i >= 8 && at + i < 12)
              ? (bytes[start + at + i] ?? 0)
              : 0);
        sum = (sum + word) >>> 0;
      }
      return sum;
    };
    const tables = new Map<string, Readonly<{ offset: number; length: number }>>();
    let previousTag = -1;
    for (let index = 0; index < count; index++) {
      const at = 12 + index * 16;
      const tag = String.fromCharCode(...bytes.subarray(at, at + 4));
      const offset = view.getUint32(at + 8),
        length = view.getUint32(at + 12);
      if (!/^[\x20-\x7e]{4}$/u.test(tag) || view.getUint32(at) <= previousTag)
        fail('Table tags must be unique and sorted.');
      previousTag = view.getUint32(at);
      if (
        offset % 4 !== 0 ||
        offset < directoryEnd ||
        offset + length > bytes.length ||
        offset + Math.ceil(length / 4) * 4 > bytes.length
      )
        fail(`Font table ${tag} has invalid bounds or alignment.`);
      if (checksum(offset, length, tag === 'head') !== view.getUint32(at + 4))
        fail(`Font table ${tag} checksum does not match its bytes.`);
      tables.set(tag, { offset, length });
    }
    let end = directoryEnd;
    for (const table of [...tables.values()].sort((a, b) => a.offset - b.offset)) {
      if (table.offset < end) fail('Font tables overlap.');
      for (let at = end; at < table.offset; at++)
        if (bytes[at] !== 0) fail('Font table gaps must be zero padding.');
      end = table.offset + table.length;
      const padded = Math.ceil(end / 4) * 4;
      for (let at = end; at < padded; at++)
        if (bytes[at] !== 0) fail('Font table padding is not zero.');
      end = padded;
    }
    if (end !== bytes.length) fail('Unexpected trailing font bytes.');
    if (checksum(0, bytes.length) !== 0xb1b0afba) fail('Whole-font checksum does not match.');
    for (const tag of [
      'CFF ',
      'CFF2',
      'fvar',
      'gvar',
      'SVG ',
      'COLR',
      'CPAL',
      'CBDT',
      'CBLC',
      'sbix',
      'EBDT',
      'EBLC',
    ])
      if (tables.has(tag))
        fail(
          `Font table ${tag} needs an unsupported font format adapter.`,
          'font-format-unsupported',
        );
    const required = (tag: string, minimum: number) => {
      const table = tables.get(tag);
      if (!table || table.length < minimum)
        fail(`Required font table ${tag} is missing or truncated.`);
      return table;
    };
    const head = required('head', 54),
      maxp = required('maxp', 32),
      hhea = required('hhea', 36);
    const os2 = required('OS/2', 78);
    const os2Version = view.getUint16(os2.offset);
    const os2Minimum = [78, 86, 96, 96, 96, 100][os2Version];
    if (os2Minimum === undefined)
      fail('Unsupported OS/2 table version.', 'font-format-unsupported');
    required('OS/2', os2Minimum);
    if (
      view.getUint32(hhea.offset) !== 0x00010000 ||
      view.getInt16(hhea.offset + 32) !== 0 ||
      view.getInt16(head.offset + 52) !== 0
    )
      fail('Invalid horizontal metric header or glyph data format.');
    required('cmap', 4);
    required('name', 6);
    required('post', 32);
    const glyf = required('glyf', 0);
    if (
      view.getUint32(head.offset) !== 0x00010000 ||
      view.getUint32(head.offset + 12) !== 0x5f0f3cf5
    )
      fail('Invalid TrueType head version or magic.');
    const units = view.getUint16(head.offset + 18),
      locationFormat = view.getInt16(head.offset + 50);
    if (units < 16 || units > 16384 || (locationFormat !== 0 && locationFormat !== 1))
      fail('Invalid units-per-em or outline location format.');
    const glyphs = view.getUint16(maxp.offset + 4),
      metrics = view.getUint16(hhea.offset + 34);
    if (
      view.getUint32(maxp.offset) !== 0x00010000 ||
      glyphs === 0 ||
      metrics === 0 ||
      metrics > glyphs
    )
      fail('Invalid glyph or horizontal metric counts.');
    required('hmtx', metrics * 4 + (glyphs - metrics) * 2);
    const stride = locationFormat === 0 ? 2 : 4,
      loca = required('loca', (glyphs + 1) * stride);
    let last = 0;
    for (let index = 0; index <= glyphs; index++) {
      const offset =
        stride === 2
          ? view.getUint16(loca.offset + index * 2) * 2
          : view.getUint32(loca.offset + index * 4);
      if ((index === 0 && offset !== 0) || offset < last || offset > glyf.length)
        fail('Glyph locations exceed outlines or are not monotonic.');
      last = offset;
    }
    const weight = view.getUint16(os2.offset + 4),
      embedding = view.getUint16(os2.offset + 8);
    if (weight < 1 || weight > 1000) fail('Invalid TrueType font weight.');
    if ((embedding & 0x0202) !== 0)
      fail('Font flags disallow outline embedding or restrict embedding.');
    return {
      type: 'valid',
      byteLength: bytes.length,
      tableCount: count,
      weight,
      dataUrl: `data:font/ttf;base64,${base64(bytes)}`,
    };
  } catch (error) {
    if (error instanceof FontValidationError)
      return { type: 'invalid', code: error.code, reason: error.message };
    throw error;
  }
}
