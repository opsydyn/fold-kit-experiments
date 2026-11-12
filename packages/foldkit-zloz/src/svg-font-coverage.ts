import { ZlozError } from './graph';
import {
  prepareSvgFontResource,
  type ZlozSvgFontResource,
  type ZlozSvgFontFailureCode,
} from './svg-font';
export type ZlozSvgFontCoverage =
  | Readonly<{
      type: 'checked';
      format: 4 | 12;
      checkedCodePoints: number;
      missingCodePoints: readonly number[];
      unverifiedCodePoints: readonly number[];
    }>
  | Readonly<{ type: 'unverified'; reason: string }>
  | Readonly<{
      type: 'invalid';
      code:
        | ZlozSvgFontFailureCode
        | 'font-cmap-invalid'
        | 'font-text-invalid'
        | 'font-coverage-limit';
      reason: string;
    }>;
export type PreparedSvgFontCoverage =
  | Exclude<ZlozSvgFontCoverage, { type: 'checked' }>
  | Readonly<{
      type: 'ready';
      inspect: (text: string, maxCharacters: number) => ZlozSvgFontCoverage;
    }>;
class CmapError extends Error {}
function invalid(reason: string): never {
  throw new CmapError(reason);
}
/** Internal: consumes owned, structurally validated sfnt bytes. Never exposes mutable tables. */
export function prepareSvgFontCoverage(bytes: Uint8Array): PreparedSvgFontCoverage {
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free binary parser turns malformed cmap ranges into explicit data failures.
  try {
    const file = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let cmapOffset = 0,
      cmapLength = 0,
      glyphCount = 0;
    for (let i = 0; i < file.getUint16(4); i++) {
      const at = 12 + i * 16,
        tag = String.fromCharCode(...bytes.subarray(at, at + 4));
      if (tag === 'cmap') {
        cmapOffset = file.getUint32(at + 8);
        cmapLength = file.getUint32(at + 12);
      }
      if (tag === 'maxp') glyphCount = file.getUint16(file.getUint32(at + 8) + 4);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset + cmapOffset, cmapLength);
    const bounds = (offset: number, length: number) => {
      if (offset < 0 || length < 0 || offset + length > view.byteLength)
        invalid('cmap record or subtable exceeds its declared bounds.');
    };
    bounds(0, 4);
    if (view.getUint16(0) !== 0) invalid('Unsupported cmap header version.');
    const count = view.getUint16(2);
    bounds(4, count * 8);
    let chosen: { offset: number; rank: number; expected: 4 | 12 | null } | null = null;
    const encodings = new Set<number>();
    for (let i = 0; i < count; i++) {
      const at = 4 + i * 8,
        platform = view.getUint16(at),
        encoding = view.getUint16(at + 2),
        offset = view.getUint32(at + 4);
      const key = platform * 65536 + encoding;
      bounds(offset, 2);
      if (offset < 4 + count * 8) invalid('cmap subtable overlaps its encoding records.');
      const rank =
        platform === 3 && encoding === 10
          ? 100
          : platform === 0 && encoding === 4
            ? 90
            : platform === 0 && encoding === 6
              ? 80
              : platform === 3 && encoding === 1
                ? 60
                : platform === 0 && encoding === 3
                  ? 50
                  : platform === 0 && encoding < 3
                    ? 40
                    : 0;
      if (rank > 0) {
        if (encodings.has(key)) invalid('Duplicate Unicode cmap encoding records are ambiguous.');
        encodings.add(key);
      }
      if (rank > 0 && (!chosen || rank > chosen.rank))
        chosen = { offset, rank, expected: rank > 80 ? 12 : rank < 80 ? 4 : null };
    }
    if (!chosen)
      return {
        type: 'unverified',
        reason: 'No supported Unicode cmap encoding is available; glyph coverage is unverified.',
      };
    const base = chosen.offset,
      format = view.getUint16(base);
    if ((format !== 4 && format !== 12) || format !== chosen.expected)
      return {
        type: 'unverified',
        reason: `Selected Unicode cmap format ${format}/encoding profile is unsupported; glyph coverage is unverified.`,
      };
    const groups: { start: number; end: number; glyph: (codePoint: number) => number }[] = [];
    if (format === 12) {
      bounds(base, 16);
      const length = view.getUint32(base + 4);
      bounds(base, length);
      const n = view.getUint32(base + 12);
      if (
        view.getUint16(base + 2) !== 0 ||
        view.getUint32(base + 8) !== 0 ||
        length !== 16 + n * 12
      )
        invalid('Invalid format 12 header or group count.');
      let last = -1;
      for (let i = 0; i < n; i++) {
        const at = base + 16 + i * 12,
          start = view.getUint32(at),
          end = view.getUint32(at + 4),
          first = view.getUint32(at + 8);
        if (start > end || start <= last || end > 0x10ffff || first + end - start >= glyphCount)
          invalid('Invalid format 12 group order, Unicode range or glyph index.');
        groups.push({ start, end, glyph: (cp) => first + cp - start });
        last = end;
      }
    } else {
      bounds(base, 14);
      const length = view.getUint16(base + 2);
      bounds(base, length);
      const twice = view.getUint16(base + 6),
        n = twice / 2;
      if (
        length < 16 ||
        twice === 0 ||
        twice % 2 !== 0 ||
        16 + n * 8 > length ||
        view.getUint16(base + 4) !== 0
      )
        invalid('Invalid format 4 header or segment arrays.');
      const starts = base + 16 + 2 * n,
        deltas = base + 16 + 4 * n,
        ranges = base + 16 + 6 * n,
        array = base + 16 + 8 * n;
      if (view.getUint16(base + 14 + 2 * n) !== 0)
        invalid('Format 4 reserved padding must be zero.');
      let last = -1;
      for (let i = 0; i < n; i++) {
        const start = view.getUint16(starts + 2 * i),
          end = view.getUint16(base + 14 + 2 * i),
          delta = view.getInt16(deltas + 2 * i),
          rangeAt = ranges + 2 * i,
          range = view.getUint16(rangeAt);
        if (start > end || start <= last) invalid('Format 4 segments overlap or are not sorted.');
        if (
          range !== 0 &&
          (range % 2 !== 0 ||
            rangeAt + range < array ||
            rangeAt + range + 2 * (end - start) + 2 > base + length)
        )
          invalid('Format 4 glyph range offsets exceed the glyph array.');
        const glyph = (cp: number) => {
          if (range === 0) return (cp + delta) & 0xffff;
          const value = view.getUint16(rangeAt + range + 2 * (cp - start));
          return value === 0 ? 0 : (value + delta) & 0xffff;
        };
        for (let cp = start; cp <= end; cp++)
          if (glyph(cp) >= glyphCount) invalid('Format 4 maps to a glyph outside the font.');
        groups.push({ start, end, glyph });
        last = end;
      }
      const terminal = groups[groups.length - 1];
      if (
        !terminal ||
        terminal.start !== 65535 ||
        terminal.end !== 65535 ||
        terminal.glyph(65535) !== 0
      )
        invalid('Format 4 needs a terminal missing-glyph segment.');
    }
    const mapped = (cp: number) => {
      let low = 0,
        high = groups.length - 1;
      while (low <= high) {
        const middle = (low + high) >>> 1,
          group = groups[middle];
        if (!group) return false;
        if (cp < group.start) high = middle - 1;
        else if (cp > group.end) low = middle + 1;
        else return group.glyph(cp) !== 0;
      }
      return false;
    };
    return {
      type: 'ready',
      inspect: (text, maxCharacters) => {
        if (text.length > maxCharacters)
          return {
            type: 'invalid',
            code: 'font-coverage-limit',
            reason: 'Exported text exceeds the configured coverage character budget.',
          };
        const unique = new Set<number>(),
          missing: number[] = [],
          unverified: number[] = [];
        for (const character of text) {
          const cp = character.codePointAt(0);
          if (cp === undefined) continue;
          if (cp >= 0xd800 && cp <= 0xdfff)
            return {
              type: 'invalid',
              code: 'font-text-invalid',
              reason: 'Coverage requires valid Unicode scalar text.',
            };
          if (cp === 9 || cp === 10 || cp === 13 || unique.has(cp)) continue;
          unique.add(cp);
          if (/\p{Default_Ignorable_Code_Point}/u.test(character)) unverified.push(cp);
          else if (!mapped(cp)) missing.push(cp);
        }
        return {
          type: 'checked',
          format,
          checkedCodePoints: unique.size - unverified.length,
          missingCodePoints: missing.sort((a, b) => a - b),
          unverifiedCodePoints: unverified.sort((a, b) => a - b),
        };
      },
    };
  } catch (error) {
    if (error instanceof CmapError)
      return { type: 'invalid', code: 'font-cmap-invalid', reason: error.message };
    throw error;
  }
}
/** Default Unicode mappings only; no shaping, font fallback discovery or variation-sequence claims. */
export function inspectSvgFontCoverage(
  resource: ZlozSvgFontResource,
  text: string,
  options: Readonly<{ maxBytes?: number; maxCharacters?: number }> = {},
): ZlozSvgFontCoverage {
  const max = options.maxCharacters ?? 2000000;
  if (!Number.isSafeInteger(max) || max < 1)
    throw new ZlozError('invalid-edit', 'Coverage maxCharacters must be a positive safe integer.');
  const prepared = prepareSvgFontResource(resource, options);
  if (prepared.type === 'invalid') return prepared;
  const cmap = prepareSvgFontCoverage(prepared.bytes);
  if (cmap.type === 'unverified') {
    if (text.length > max)
      return {
        type: 'invalid',
        code: 'font-coverage-limit',
        reason: 'Exported text exceeds the configured coverage character budget.',
      };
    for (const character of text) {
      const cp = character.codePointAt(0);
      if (cp !== undefined && cp >= 0xd800 && cp <= 0xdfff)
        return {
          type: 'invalid',
          code: 'font-text-invalid',
          reason: 'Coverage requires valid Unicode scalar text.',
        };
    }
  }
  return cmap.type === 'ready' ? cmap.inspect(text, max) : cmap;
}
