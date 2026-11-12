import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import {
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  createEditor,
  createArchitecturePattern,
  writeSvgExport,
  validateSvgFontResource,
  type ZlozSvgExportOptions,
} from '../src/index';
const bytes = new Uint8Array(
  readFileSync(new URL('./fixtures/font/inter-latin-400.ttf', import.meta.url)),
);
const resource = { assetId: 'inter', format: 'truetype', bytes } as const;
const snapshot = createEditor(createArchitecturePattern('c4-context'));
const options: ZlozSvgExportOptions = {
  title: 'Embedded text',
  region: { type: 'model', padding: 24 },
  theme: { colorScheme: 'light' },
  background: { type: 'transparent' },
  font: { family: 'Inter', size: 14, weight: 400, assetId: 'inter' },
  assets: [{ id: 'inter', kind: 'font', availability: 'embedded' }],
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
test('a real TrueType face validates structurally and embeds exactly its bytes without fetching or editing', () => {
  const before = JSON.stringify(snapshot);
  const validation = validateSvgFontResource(resource);
  expect(validation.type).toBe('valid');
  if (validation.type !== 'valid') throw new Error('Expected valid font');
  expect(validation.byteLength).toBe(67952);
  expect(validation.tableCount).toBe(15);
  expect(validation.dataUrl).toBe(`data:font/ttf;base64,${Buffer.from(bytes).toString('base64')}`);
  const result = writeSvgExport(snapshot, options, { fontResources: [resource] });
  expect(result.type).toBe('written');
  if (result.type !== 'written') throw new Error('Expected embedded font SVG');
  expect(result.svg).toContain(validation.dataUrl);
  expect(result.svg).toContain('@font-face');
  expect(result.svg).toContain('font-family="zloz-export-font"');
  expect(result.svg).not.toContain('local(');
  expect(result.findings.filter((f) => f.severity === 'unsupported')).toEqual([]);
  expect(result.findings.find((f) => f.code === 'font-unverified')?.reason).toContain('glyph');
  expect(JSON.stringify(snapshot)).toBe(before);
});
test('malformed, truncated, mismatched and oversized font resources report atomic failures', () => {
  const damaged = bytes.slice();
  damaged[damaged.length - 1] = (damaged[damaged.length - 1] ?? 0) ^ 1;
  for (const [font, code] of [
    [{ ...resource, bytes: bytes.slice(0, 20) }, 'font-resource-invalid'],
    [{ ...resource, bytes: damaged }, 'font-resource-invalid'],
    [{ ...resource, format: 'woff2' }, 'font-format-unsupported'],
  ] as const) {
    // SAFETY: runtime rejection deliberately exercises unsupported format input.
    const result = writeSvgExport(snapshot, options, { fontResources: [font as typeof resource] });
    expect(result.type).toBe('blocked');
    expect('svg' in result).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code,
        severity: 'unsupported',
        target: { kind: 'asset', id: 'inter' },
      }),
    );
  }
  expect(validateSvgFontResource(resource, { maxBytes: bytes.length - 1 })).toEqual(
    expect.objectContaining({ type: 'invalid', code: 'font-resource-limit' }),
  );
  const missing = writeSvgExport(snapshot, options);
  expect(missing.findings.some((f) => f.code === 'font-resource-missing')).toBe(true);
  const unexpected = writeSvgExport(snapshot, options, {
    fontResources: [{ ...resource, assetId: 'other' }],
  });
  expect(unexpected.type).toBe('blocked');
  expect(unexpected.findings.some((f) => f.code === 'font-resource-unexpected')).toBe(true);
  const duplicate = writeSvgExport(snapshot, options, { fontResources: [resource, resource] });
  expect(duplicate.type).toBe('blocked');
  expect(duplicate.findings.some((f) => f.code === 'font-resource-unexpected')).toBe(true);
});
test('resource bytes are revalidated for every export, including mutable byte views', () => {
  const view = new Uint8Array(bytes.length + 8);
  view.set(bytes, 4);
  const selected = { ...resource, bytes: view.subarray(4, 4 + bytes.length) };
  const first = writeSvgExport(snapshot, options, { fontResources: [selected] });
  expect(first.type).toBe('written');
  view[view.length - 5] = (view[view.length - 5] ?? 0) ^ 1;
  const next = writeSvgExport(snapshot, options, { fontResources: [selected], allowLosses: true });
  expect(next.type).toBe('blocked');
  expect('svg' in next).toBe(false);
});

// Fixture corruption with independently repaired sfnt checksums reaches semantic
// header/location validation rather than failing only the checksum gate.
function tableOffset(data: Uint8Array, tag: string) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < buffer.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    if (buffer.toString('ascii', at, at + 4) === tag) return buffer.readUInt32BE(at + 8);
  }
  throw new Error(`Missing test table ${tag}`);
}
function repair(data: Uint8Array) {
  const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const sum = (offset: number, length: number) => {
    let total = 0;
    for (let at = 0; at < Math.ceil(length / 4) * 4; at += 4)
      total = (total + buffer.readUInt32BE(offset + at)) >>> 0;
    return total;
  };
  const head = tableOffset(data, 'head');
  buffer.writeUInt32BE(0, head + 8);
  for (let i = 0; i < buffer.readUInt16BE(4); i++) {
    const at = 12 + 16 * i;
    buffer.writeUInt32BE(sum(buffer.readUInt32BE(at + 8), buffer.readUInt32BE(at + 12)), at + 4);
  }
  buffer.writeUInt32BE((0xb1b0afba - sum(0, buffer.length)) >>> 0, head + 8);
}
test('checksummed but inconsistent headers and outline locations report specific structural failures', () => {
  for (const [tag, offset, value, reason] of [
    ['head', 18, 0, 'units-per-em'],
    ['hhea', 34, 65535, 'metric counts'],
    ['OS/2', 8, 2, 'restrict embedding'],
  ] as const) {
    const altered = bytes.slice();
    new DataView(altered.buffer).setUint16(tableOffset(altered, tag) + offset, value);
    repair(altered);
    expect(validateSvgFontResource({ ...resource, bytes: altered })).toEqual(
      expect.objectContaining({
        type: 'invalid',
        code: 'font-resource-invalid',
        reason: expect.stringContaining(reason),
      }),
    );
  }
  const altered = bytes.slice();
  const view = new DataView(altered.buffer);
  const stride = view.getInt16(tableOffset(altered, 'head') + 50) === 0 ? 2 : 4;
  const location = tableOffset(altered, 'loca');
  if (stride === 2) view.setUint16(location + 2, 65535);
  else view.setUint32(location + 4, 0xffffffff);
  repair(altered);
  const result = validateSvgFontResource({ ...resource, bytes: altered });
  expect(result).toEqual(
    expect.objectContaining({
      type: 'invalid',
      reason: expect.stringContaining('Glyph locations'),
    }),
  );
});
test('directory bounds, overlapping tables and byte budgets are enforced before emission', () => {
  const outside = bytes.slice();
  new DataView(outside.buffer).setUint32(20, bytes.length + 4);
  expect(validateSvgFontResource({ ...resource, bytes: outside })).toEqual(
    expect.objectContaining({ type: 'invalid', reason: expect.stringContaining('bounds') }),
  );
  const overlap = bytes.slice();
  overlap.set(overlap.subarray(16, 28), 32);
  expect(validateSvgFontResource({ ...resource, bytes: overlap })).toEqual(
    expect.objectContaining({ type: 'invalid', reason: expect.stringContaining('overlap') }),
  );
  const limited = writeSvgExport(snapshot, options, {
    fontResources: [resource],
    maxFontBytes: bytes.length - 1,
  });
  expect(limited.type).toBe('blocked');
  expect(limited.findings.some((f) => f.code === 'font-resource-limit')).toBe(true);
  expect(() => validateSvgFontResource(resource, { maxBytes: Infinity })).toThrow();
  const xmlLimited = writeSvgExport(snapshot, options, {
    fontResources: [resource],
    maxCharacters: 1000,
  });
  expect(xmlLimited.type).toBe('blocked');
  expect('svg' in xmlLimited).toBe(false);
});

test('font bytes participate in review identity and unsupported resources cannot be loss-accepted', () => {
  const firstNode = snapshot.graph.nodes[0];
  if (!firstNode) throw new Error('Missing node');
  const state = createSvgReview('font-review');
  const context = {
    ...options,
    scope: 'font-review',
    sourceRevision: 0,
    snapshot,
    renderers: {
      ...options.renderers,
      overrides: [
        {
          target: { kind: 'node' as const, id: firstNode.id },
          renderer: { type: 'omit' as const, reason: 'Omitted for review' },
        },
      ],
    },
    writing: { fontResources: [resource] },
  };
  const first = resolveSvgReview(state, context);
  const accepted = updateSvgReview(state, context, {
    ...first.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  expect(resolveSvgReview(accepted, context).accepted).toBe(true);
  const changed = bytes.slice();
  // Change only a timestamp in the head table, retaining a structurally valid font.
  const timestamp = tableOffset(changed, 'head') + 27;
  changed[timestamp] = (changed[timestamp] ?? 0) ^ 1;
  repair(changed);
  const next = { ...context, writing: { fontResources: [{ ...resource, bytes: changed }] } };
  expect(resolveSvgReview(accepted, next).result?.type).toBe('written');
  expect(resolveSvgReview(accepted, next).accepted).toBe(false);
  expect(
    updateSvgReview(accepted, next, { ...first.identity, type: 'SvgDownloadRequested' }).payload,
  ).toBeNull();
  const invalid = {
    ...context,
    writing: { fontResources: [{ ...resource, bytes: bytes.slice(0, 12) }] },
  };
  const blocked = resolveSvgReview(accepted, invalid);
  expect(blocked.result?.type).toBe('blocked');
  const attempted = updateSvgReview(accepted, invalid, {
    ...blocked.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  });
  expect(
    updateSvgReview(attempted.state, invalid, { ...blocked.identity, type: 'SvgDownloadRequested' })
      .payload,
  ).toBeNull();
});
test('embedded face CSS uses only package-generated identifiers and encoded bytes', () => {
  const result = writeSvgExport(
    snapshot,
    { ...options, font: { ...options.font, family: "x';}</style><script>bad</script>" } },
    { fontResources: [resource] },
  );
  expect(result.type).toBe('written');
  if (result.type !== 'written') throw new Error('Expected SVG');
  expect(result.svg).not.toContain('<script>');
  expect(result.svg).not.toContain("x';}");
  expect(result.svg).toContain("font-family:'zloz-export-font'");
});

test('signatures, variable font tables and missing required tables reject with explicit findings', () => {
  const signature = bytes.slice();
  signature.set([0x77, 0x4f, 0x46, 0x32]);
  expect(validateSvgFontResource({ ...resource, bytes: signature })).toEqual(
    expect.objectContaining({ type: 'invalid', code: 'font-format-unsupported' }),
  );
  for (const [before, after, reason] of [
    ['gasp', 'fvar', 'unsupported'],
    ['post', 'zzzz', 'missing'],
  ] as const) {
    const changed = bytes.slice();
    const buffer = Buffer.from(changed.buffer);
    for (let i = 0; i < buffer.readUInt16BE(4); i++) {
      const at = 12 + i * 16;
      if (buffer.toString('ascii', at, at + 4) === before) buffer.write(after, at, 'ascii');
    }
    repair(changed);
    expect(validateSvgFontResource({ ...resource, bytes: changed })).toEqual(
      expect.objectContaining({ type: 'invalid', reason: expect.stringContaining(reason) }),
    );
  }
});
