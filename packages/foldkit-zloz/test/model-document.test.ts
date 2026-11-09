import { expect, test } from 'bun:test';

import {
  ZlozError,
  captureEdition,
  captureModelDocument,
  serializeModelDocument,
  parseModelDocument,
  forkEdition,
  createModelEditor,
  serializeSnapshot,
  parseSnapshot,
  updateEditor,
  type ZlozSnapshot,
} from '../src/index';
const snapshot: ZlozSnapshot = {
  graph: {
    nodes: [
      {
        id: 'n',
        label: 'Original',
        position: { x: 1, y: 2 },
        size: { width: 100, height: 80 },
        parentId: 'group',
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        data: { nested: ['source'] },
      },
      {
        id: 'group',
        kind: 'group',
        label: 'Boundary',
        position: { x: 0, y: 0 },
        size: { width: 600, height: 300 },
        ports: [],
      },
      {
        id: 'm',
        parentId: 'group',
        label: 'Target',
        position: { x: 250, y: 20 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [{ id: 'e', source: { node: 'n', port: 'out' }, target: { node: 'm', port: 'in' } }],
  },
  viewport: { x: 12, y: 34, zoom: 1 },
};
const edition = captureEdition({ id: 'first', name: 'First', snapshot });
const source = () =>
  captureModelDocument({
    id: 'source',
    name: 'Source',
    snapshot,
    editions: [edition],
    origin: null,
  });
test('fork preserves immutable source and scoped IDs with a fresh editable Undo history', () => {
  const original = source();
  const before = serializeModelDocument(original);
  const result = forkEdition(original, 'first', { id: 'alternative', name: 'Alternative' });
  expect(result.type).toBe('forked');
  if (result.type !== 'forked') return;
  expect(result.document.id).toBe('alternative');
  expect(result.document.origin).toEqual({ modelId: 'source', modelName: 'Source', edition });
  expect(result.document.editions).toEqual([]);
  expect(result.document.snapshot.graph.edges).toEqual(snapshot.graph.edges);
  expect(result.document.snapshot.graph.nodes[0]!.parentId).toBe('group');
  expect(result.document.snapshot).toEqual(edition.snapshot);
  expect(result.document.snapshot.graph).not.toBe(original.snapshot.graph);
  expect(result.document.snapshot.graph).not.toBe(result.document.origin!.edition.snapshot.graph);
  expect(Object.isFrozen(result.document.origin!.edition.snapshot.graph.nodes[0]!.data)).toBe(true);
  const editor = createModelEditor(result.document);
  expect(editor.past).toEqual([]);
  expect(editor.future).toEqual([]);
  expect(editor.revision).toBe(0);
  expect(editor.readOnly).toBe(false);
  expect(editor.viewport).toEqual({ x: 12, y: 34, zoom: 1 });
  const changed = updateEditor(editor, { type: 'NodeLabelChanged', id: 'n', label: 'Alternative' });
  expect(changed.graph.nodes[0]!.label).toBe('Alternative');
  expect(updateEditor(changed, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
  expect(serializeModelDocument(original)).toBe(before);
  expect(result.document.origin!.edition.snapshot.graph.nodes[0]!.label).toBe('Original');
});
test('model codec is strict, round-trips pinned origin, and does not change snapshot v1', () => {
  const original = source();
  const fork = forkEdition(original, 'first', { id: 'fork', name: 'Fork' });
  if (fork.type !== 'forked') throw new Error('Expected fork');
  const encoded = serializeModelDocument(fork.document);
  expect(parseModelDocument(encoded)).toEqual(fork.document);
  expect(parseSnapshot(serializeSnapshot(snapshot))).toEqual(snapshot);
  expect(() => parseSnapshot(encoded)).toThrow(ZlozError);
  const wire = JSON.parse(encoded);
  for (const invalid of [
    { ...wire, version: 2 },
    { ...wire, extra: true },
    { ...wire, document: { ...wire.document, extra: true } },
    { ...wire, document: { ...wire.document, origin: { ...wire.document.origin, extra: true } } },
    {
      ...wire,
      document: { ...wire.document, origin: { ...wire.document.origin, modelId: 'fork' } },
    },
  ])
    expect(() => parseModelDocument(JSON.stringify(invalid))).toThrow(ZlozError);
  expect(() => parseModelDocument('{bad')).toThrow(ZlozError);
  expect(() => captureModelDocument({ ...original, id: ' ' })).toThrow(ZlozError);
});
test('missing edition, invalid target identity and policy veto cannot publish a fork', () => {
  const original = source();
  for (const [id, identity] of [
    ['missing', { id: 'fork', name: 'Fork' }],
    ['first', { id: 'source', name: 'Same' }],
    ['first', { id: ' ', name: 'Blank' }],
    ['first', { id: 'fork', name: ' ' }],
  ] as const)
    expect(forkEdition(original, id, identity).type).toBe('blocked');
  expect(
    forkEdition(original, 'first', { id: 'fork', name: 'Fork' }, { canForkEdition: () => '' }),
  ).toEqual({ type: 'blocked', reason: 'Edition forking is protected.' });
  const blocked = forkEdition(
    original,
    'first',
    { id: 'fork', name: 'Fork' },
    { canForkEdition: () => 'No copies' },
  );
  expect(blocked).toEqual({ type: 'blocked', reason: 'No copies' });
});

test('fork-of-fork pins its immediate parent and fresh editor preferences remain host-owned', () => {
  const result = forkEdition(source(), 'first', { id: 'fork', name: 'Fork' });
  if (result.type !== 'forked') throw new Error('Expected fork');
  const parent = captureModelDocument({ ...result.document, editions: [edition] });
  const child = forkEdition(parent, 'first', { id: 'child', name: 'Child' });
  if (child.type !== 'forked') throw new Error('Expected child');
  expect(child.document.origin!.modelId).toBe('fork');
  expect(parseModelDocument(serializeModelDocument(child.document))).toEqual(child.document);
  expect(
    createModelEditor(child.document, { readOnly: true, viewport: { x: 1, y: 1, zoom: 2 } })
      .readOnly,
  ).toBe(true);
  expect(
    createModelEditor(child.document, { viewport: { x: 1, y: 1, zoom: 2 } }).viewport.zoom,
  ).toBe(2);
});
