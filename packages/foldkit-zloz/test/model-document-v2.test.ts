import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  ZlozError,
  captureEditionV2,
  parseEditionsV2,
  serializeEditionsV2,
  captureModelDocumentV2,
  parseModelDocumentV2,
  serializeModelDocumentV2,
  upgradeModelDocumentToV2,
  upgradeEditionsToV2,
  planModelDocumentV2Downgrade,
  planEditionsV2Downgrade,
  captureModelDocument,
  createEditor,
  createEditorFromConnectionDocument,
  serializeSnapshot,
  parseModelDocument,
  serializeModelDocument,
  parseEditions,
  serializeEditions,
  parseConnectionDocument,
  type ZlozModelDocumentV2,
} from '../src/index';
import loose from './fixtures/connection-v2-loose.json';
import archiveWire from './fixtures/editions-v2-modes.json';
import legacy from './fixtures/model-v1-strict.json';
import modes from './fixtures/model-v2-modes.json';

const read = () => parseModelDocumentV2(JSON.stringify(modes));

test('literal canonical v2 retains independent current, edition and pinned-origin modes, cameras and identity', () => {
  const source = read();
  assert.deepEqual(source, modes.document);
  expect(source.snapshot.connectionMode).toBe('strict');
  expect(source.editions[0]!.snapshot.connectionMode).toBe('loose');
  expect(source.origin!.edition.snapshot.connectionMode).toBe('loose');
  expect(parseModelDocumentV2(serializeModelDocumentV2(source))).toEqual(source);
  assert.deepEqual(JSON.parse(serializeModelDocumentV2(source)), modes);
  expect(captureModelDocumentV2(source)).not.toBe(source);
  expect(Object.isFrozen(source.origin!.edition.snapshot.graph.nodes)).toBe(true);
  expect(Object.isFrozen(source.editions)).toBe(true);
  expect(Object.isFrozen(source.snapshot.viewport)).toBe(true);
  const authored = structuredClone(source);
  const captured = captureModelDocumentV2(authored);
  expect(captured.snapshot.graph.nodes).not.toBe(authored.snapshot.graph.nodes);
  expect(Object.isFrozen(authored)).toBe(false);
  expect(Object.isFrozen(authored.snapshot.graph.nodes)).toBe(false);
  const recaptured = captureModelDocumentV2(source);
  expect(recaptured.origin!.edition.snapshot).not.toBe(source.origin!.edition.snapshot);
});

test('edition archives retain each explicit mode and deeply detach without inventing metadata', () => {
  const archive = archiveWire;
  const editions = parseEditionsV2(JSON.stringify(archive));
  assert.deepEqual(editions, archive.editions);
  expect(JSON.parse(serializeEditionsV2(editions))).toEqual(archive);
  expect(captureEditionV2(editions[0]!)).not.toBe(editions[0]);
  expect(Object.isFrozen(editions[0]!.snapshot.graph)).toBe(true);
  expect(() => serializeEditionsV2([editions[0]!, editions[0]!])).toThrow(ZlozError);
});

test('upgrade is explicit and marks every v1 checkpoint strict without changing authored data or pinned origin', () => {
  const source = parseModelDocument(JSON.stringify(legacy));
  const upgraded = upgradeModelDocumentToV2(source);
  expect(upgraded.snapshot).toEqual({ version: 2, connectionMode: 'strict', ...source.snapshot });
  expect(upgraded.editions[0]!.snapshot).toEqual({
    version: 2,
    connectionMode: 'strict',
    ...source.editions[0]!.snapshot,
  });
  expect(upgraded.origin!.edition.snapshot).toEqual({
    version: 2,
    connectionMode: 'strict',
    ...source.origin!.edition.snapshot,
  });
  assert.deepEqual(source, legacy.document);
  expect(upgradeEditionsToV2(source.editions)).toEqual(upgraded.editions);
  expect(() => upgradeModelDocumentToV2(read())).toThrow(ZlozError);
  expect(() => upgradeEditionsToV2(read().editions)).toThrow(ZlozError);
  expect(() => parseModelDocumentV2(JSON.stringify(legacy))).toThrow(ZlozError);
  expect(() => parseEditionsV2(serializeEditions(source.editions))).toThrow(ZlozError);
  expect(() => parseModelDocument(serializeModelDocumentV2(upgraded))).toThrow(ZlozError);
  expect(() => parseEditions(serializeEditionsV2(upgraded.editions))).toThrow(ZlozError);
});

test('loose-only current data retains authored ports, JSON payloads, geometry and ordered endpoints', () => {
  const snapshot = parseConnectionDocument(JSON.stringify(loose));
  const source = captureModelDocumentV2({ ...read(), snapshot });
  assert.deepEqual(source.snapshot, loose);
  expect(source.snapshot.graph.nodes[0]!.ports[0]!.kind).toBe('input');
  expect(source.snapshot.graph.edges[0]!.source.node).toBe('a');
  expect(parseModelDocumentV2(serializeModelDocumentV2(source)).snapshot).toEqual(snapshot);
});

for (const location of ['current', 'edition', 'origin'] as const) {
  test(`downgrade blocks the entire model for loose-only ${location} data, including historical/provenance-only incompatibility`, () => {
    const source = read();
    const snapshot = parseConnectionDocument(JSON.stringify(loose));
    const document: ZlozModelDocumentV2 =
      location === 'current'
        ? { ...source, snapshot }
        : location === 'edition'
          ? { ...source, editions: [{ ...source.editions[0]!, snapshot }] }
          : {
              ...source,
              origin: { ...source.origin!, edition: { ...source.origin!.edition, snapshot } },
            };
    const before = serializeModelDocumentV2(document);
    const plan = planModelDocumentV2Downgrade(document);
    expect(plan.type).toBe('blocked');
    expect('document' in plan).toBe(false);
    expect(plan.findings.find((item) => item.code === 'loose-edges-unrepresentable')).toMatchObject(
      {
        path:
          location === 'current'
            ? '/snapshot'
            : location === 'edition'
              ? '/editions/0/snapshot'
              : '/origin/edition/snapshot',
        edgeIds: ['orders-billing'],
      },
    );
    expect(serializeModelDocumentV2(document)).toBe(before);
    expect(plan.source).toEqual(document);
    expect(Object.isFrozen(plan.findings)).toBe(true);
  });
}

test('strict-compatible loose histories disclose each future-authoring loss before a whole v1 projection is available', () => {
  const source = read();
  const plan = planModelDocumentV2Downgrade(source);
  expect(plan.type).toBe('reviewable');
  expect(plan.findings.map(({ path, code }) => ({ path, code }))).toEqual([
    { path: '/editions/0/snapshot', code: 'loose-mode-removed' },
    { path: '/origin/edition/snapshot', code: 'loose-mode-removed' },
  ]);
  if (plan.type !== 'reviewable') throw new Error('Expected prospective v1 document');
  assert.deepEqual(plan.document, legacy.document);
  assert.deepEqual(parseModelDocument(serializeModelDocument(plan.document)), legacy.document);
  expect(Object.isFrozen(plan.document.origin!.edition.snapshot)).toBe(true);
  const upgraded = upgradeModelDocumentToV2(plan.document);
  const strictPlan = planModelDocumentV2Downgrade(upgraded);
  expect(strictPlan.findings).toEqual([]);
  expect(strictPlan.type).toBe('reviewable');
});

test('edition downgrade is all-or-nothing, path-qualified and deterministic across multiple incompatible checkpoints', () => {
  const snapshot = parseConnectionDocument(JSON.stringify(loose));
  const editions = [
    { id: 'a/~', name: 'First', snapshot },
    { id: 'b', name: 'Second', snapshot },
  ];
  const plan = planEditionsV2Downgrade(editions);
  expect(plan.type).toBe('blocked');
  expect('editions' in plan).toBe(false);
  expect(plan.findings.map(({ path }) => path)).toEqual([
    '/editions/0/snapshot',
    '/editions/1/snapshot',
  ]);
  expect(plan.source[0]!.id).toBe('a/~');
  const compatible = planEditionsV2Downgrade(read().editions);
  expect(compatible.type).toBe('reviewable');
  if (compatible.type === 'reviewable')
    assert.deepEqual(
      parseEditions(serializeEditions(compatible.editions)),
      legacy.document.editions,
    );
});

test('strict v2 boundaries reject missing/future modes, versions, unknown fields and duplicate or corrupt provenance records', () => {
  const invalid = [
    { ...modes, version: 3 },
    { ...modes, extra: true },
    { ...modes, document: { ...modes.document, extra: true } },
    {
      ...modes,
      document: {
        ...modes.document,
        snapshot: { ...modes.document.snapshot, connectionMode: 'future' },
      },
    },
    {
      ...modes,
      document: { ...modes.document, snapshot: { graph: modes.document.snapshot.graph } },
    },
    {
      ...modes,
      document: {
        ...modes.document,
        editions: [modes.document.editions[0], modes.document.editions[0]],
      },
    },
    {
      ...modes,
      document: {
        ...modes.document,
        origin: { ...modes.document.origin, modelId: modes.document.id },
      },
    },
    {
      ...modes,
      document: { ...modes.document, origin: { ...modes.document.origin, extra: true } },
    },
    {
      ...modes,
      document: { ...modes.document, editions: [{ ...modes.document.editions[0], extra: true }] },
    },
    { ...modes, document: { ...modes.document, name: ' ' } },
  ];
  for (const wire of invalid)
    expect(() => parseModelDocumentV2(JSON.stringify(wire))).toThrow(ZlozError);
  expect(() => parseModelDocumentV2('{')).toThrow(ZlozError);
  for (const connectionMode of [undefined, 'future']) {
    const edition = {
      ...modes.document.editions[0]!,
      snapshot: { ...modes.document.editions[0]!.snapshot, connectionMode },
    };
    expect(() =>
      parseModelDocumentV2(
        JSON.stringify({ ...modes, document: { ...modes.document, editions: [edition] } }),
      ),
    ).toThrow(ZlozError);
    expect(() =>
      parseModelDocumentV2(
        JSON.stringify({
          ...modes,
          document: { ...modes.document, origin: { ...modes.document.origin, edition } },
        }),
      ),
    ).toThrow(ZlozError);
  }
  expect(() =>
    parseEditionsV2(JSON.stringify({ format: 'foldkit-zloz-editions', version: 3, editions: [] })),
  ).toThrow(ZlozError);
});

test('typed serializers/captures reject nonfinite authored values before JSON can normalize them', () => {
  const snapshot = parseConnectionDocument(JSON.stringify(loose));
  const corrupt = {
    ...snapshot,
    graph: {
      ...snapshot.graph,
      nodes: snapshot.graph.nodes.map((node) => ({ ...node, data: { value: NaN } })),
    },
  };
  const document = { ...read(), snapshot: corrupt };
  expect(() => captureModelDocumentV2(document)).toThrow(ZlozError);
  expect(() => serializeModelDocumentV2(document)).toThrow(ZlozError);
  expect(() => captureEditionV2({ id: 'bad', name: 'Bad', snapshot: corrupt })).toThrow(ZlozError);
  expect(() => serializeEditionsV2([{ id: 'bad', name: 'Bad', snapshot: corrupt }])).toThrow(
    ZlozError,
  );
});

test('current v1 construction/writers refuse explicit v2 or loose intent while ordinary strict editor saving stays supported', () => {
  const document = read();
  expect(() => captureModelDocument(document)).toThrow(ZlozError);
  expect(() => serializeModelDocument(document)).toThrow(ZlozError);
  expect(() => serializeEditions(document.editions)).toThrow(ZlozError);
  const looseEditor = createEditorFromConnectionDocument(document.editions[0]!.snapshot);
  expect(() => serializeSnapshot(looseEditor)).toThrow(ZlozError);
  expect(() => serializeSnapshot(document.snapshot)).toThrow(ZlozError);
  const strictEditor = createEditor({ nodes: [], edges: [] });
  expect(JSON.parse(serializeSnapshot(strictEditor))).toEqual({
    version: 1,
    graph: { nodes: [], edges: [] },
    viewport: { x: 0, y: 0, zoom: 1 },
  });
});
