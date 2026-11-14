import { expect, test } from 'bun:test';

import {
  ZlozError,
  captureConnectionDocument,
  captureEditionV2,
  captureModelDocumentV2,
  parseConnectionDocument,
  parseModelDocument,
  parseModelDocumentV2,
  serializeModelDocumentV2,
  createModelEditorV2,
  createHistoryReviewV2,
  updateHistoryReviewV2,
  updateEditor,
  forkEditionV2,
  forkEdition,
  type ZlozConnectionMode,
  type ZlozEditionForkPolicyV2,
} from '../src/index';
import looseWire from './fixtures/connection-v2-loose.json';
import legacyWire from './fixtures/model-v1-strict.json';
import wire from './fixtures/model-v2-modes.json';

const original = () => parseModelDocumentV2(JSON.stringify(wire));
const loose = () => parseConnectionDocument(JSON.stringify(looseWire));
const sourceFor = (currentMode: ZlozConnectionMode, editionMode: ZlozConnectionMode) => {
  const base = original();
  return captureModelDocumentV2({
    ...base,
    snapshot: currentMode === 'loose' ? loose() : base.snapshot,
    editions: [
      captureEditionV2({
        id: 'selected',
        name: 'Selected checkpoint',
        snapshot: editionMode === 'loose' ? loose() : base.snapshot,
      }),
    ],
  });
};

for (const currentMode of ['strict', 'loose'] as const)
  for (const editionMode of ['strict', 'loose'] as const) {
    test(`${currentMode} model forks its ${editionMode} edition with a pinned immediate parent and fresh target session`, () => {
      const source = sourceFor(currentMode, editionMode);
      const before = serializeModelDocumentV2(source);
      let working = createModelEditorV2(source);
      working = updateEditor(working, { type: 'NodeLabelChanged', id: 'a', label: 'Working' });
      working = updateEditor(working, { type: 'NodeLabelChanged', id: 'a', label: 'Later' });
      working = updateEditor(working, { type: 'UndoPressed' });
      working = updateEditor(working, { type: 'NodeSelected', id: 'a', additive: false });
      working = updateEditor(working, { type: 'CopyPressed' });
      working = updateEditor(working, {
        type: 'SurfaceMeasured',
        size: { width: 900, height: 600 },
      });
      const workingBefore = JSON.stringify(working);
      const selected = source.editions[0]!;
      const result = forkEditionV2(source, selected.id, { id: 'alternative', name: 'Alternative' });
      expect(result.type).toBe('forked');
      if (result.type !== 'forked') throw new Error('Expected fork');
      const document = result.document;
      expect(document.id).toBe('alternative');
      expect(document.name).toBe('Alternative');
      expect(document.snapshot).toEqual(selected.snapshot);
      expect(document.snapshot.connectionMode).toBe(editionMode);
      expect(document.editions).toEqual([]);
      expect(document.origin).toEqual({
        modelId: source.id,
        modelName: source.name,
        edition: selected,
      });
      expect(document.snapshot.graph).not.toBe(selected.snapshot.graph);
      expect(document.snapshot.graph).not.toBe(document.origin!.edition.snapshot.graph);
      expect(document.origin!.edition).not.toBe(selected);
      expect(Object.isFrozen(document.origin!.edition.snapshot.graph.nodes[0]!.ports)).toBe(true);
      expect(Object.isFrozen(document.snapshot.graph.edges)).toBe(true);
      expect(document.snapshot.graph.nodes.map(({ id }) => id)).toEqual(
        selected.snapshot.graph.nodes.map(({ id }) => id),
      );
      expect(parseModelDocumentV2(serializeModelDocumentV2(document))).toEqual(document);
      const target = createModelEditorV2(document);
      expect(target.connectionMode).toBe(editionMode);
      expect(target.graph).toEqual(selected.snapshot.graph);
      expect(target.graph).not.toBe(document.snapshot.graph);
      expect(target.viewport).toEqual(selected.snapshot.viewport!);
      expect(target.readOnly).toBe(false);
      expect(target.revision).toBe(0);
      expect(target.past).toEqual([]);
      expect(target.future).toEqual([]);
      expect(target.clipboard).toBeNull();
      expect(target.selectedNodes).toEqual([]);
      expect(target.surface).toBeNull();
      expect(target.gesture).toEqual({ type: 'idle' });
      const edited = updateEditor(target, {
        type: 'NodeLabelChanged',
        id: 'a',
        label: 'Fork edit',
      });
      expect(edited.past).toEqual([target.graph]);
      expect(updateEditor(edited, { type: 'UndoPressed' }).graph).toBe(target.graph);
      expect(edited.connectionMode).toBe(editionMode);
      expect(document.origin!.edition.snapshot).toEqual(selected.snapshot);
      expect(serializeModelDocumentV2(source)).toBe(before);
      expect(JSON.stringify(working)).toBe(workingBefore);
      expect(working.past).toHaveLength(1);
      expect(working.future).toHaveLength(1);
      expect(() => forkEdition(source, selected.id, { id: 'v1', name: 'V1' })).toThrow(ZlozError);
    });
  }

test('policy receives a detached frozen owned checkpoint and target identity and is reevaluated on every call', () => {
  const source = structuredClone(sourceFor('strict', 'loose'));
  const before = JSON.stringify(source);
  const target = { id: ' alternative ', name: ' Alternative ' };
  let protectedNow = false;
  let calls = 0;
  const policy: ZlozEditionForkPolicyV2 = {
    canForkEdition: (checked, edition, identity) => {
      calls++;
      expect(checked).not.toBe(source);
      expect(checked).toEqual(source);
      expect(checked.editions[0]).toBe(edition);
      expect(edition.snapshot.connectionMode).toBe('loose');
      expect(identity).toEqual(target);
      expect(identity).not.toBe(target);
      expect(Object.isFrozen(checked)).toBe(true);
      expect(Object.isFrozen(edition.snapshot.graph.nodes)).toBe(true);
      expect(Object.isFrozen(identity)).toBe(true);
      return protectedNow ? 'Forking is protected now.' : null;
    },
  };
  const first = forkEditionV2(source, 'selected', target, policy);
  expect(first.type).toBe('forked');
  if (first.type === 'forked') {
    expect(first.document.id).toBe(target.id);
    expect(first.document.name).toBe(target.name);
  }
  protectedNow = true;
  const blocked = forkEditionV2(source, 'selected', target, policy);
  expect(blocked).toEqual({ type: 'blocked', reason: 'Forking is protected now.' });
  expect('document' in blocked).toBe(false);
  expect(calls).toBe(2);
  expect(JSON.stringify(source)).toBe(before);
  expect(Object.isFrozen(source)).toBe(false);
  expect(Object.isFrozen(target)).toBe(false);
});

test('invalid target or unavailable edition blocks before policy and never falls back to current or origin', () => {
  const source = sourceFor('strict', 'loose');
  const before = serializeModelDocumentV2(source);
  let calls = 0;
  const policy: ZlozEditionForkPolicyV2 = {
    canForkEdition: () => {
      calls++;
      return null;
    },
  };
  for (const target of [
    { id: source.id, name: 'Same' },
    { id: '', name: 'Empty' },
    { id: ' ', name: 'Blank' },
    { id: 'target', name: '' },
    { id: 'target', name: ' ' },
  ]) {
    expect(forkEditionV2(source, 'selected', target, policy)).toEqual({
      type: 'blocked',
      reason: 'Choose a nonempty, distinct model identity and name.',
    });
  }
  for (const editionId of ['missing', source.id, source.origin!.edition.id]) {
    expect(forkEditionV2(source, editionId, { id: 'target', name: 'Target' }, policy)).toEqual({
      type: 'blocked',
      reason: 'The source edition is unavailable in this model.',
    });
  }
  expect(
    forkEditionV2(
      captureModelDocumentV2({ ...source, editions: [] }),
      'selected',
      { id: 'target', name: 'Target' },
      policy,
    ).type,
  ).toBe('blocked');
  expect(calls).toBe(0);
  expect(serializeModelDocumentV2(source)).toBe(before);
});

test('empty protection reasons remain vetoes and thrown policy failures cannot publish a result', () => {
  const source = sourceFor('strict', 'loose');
  const before = serializeModelDocumentV2(source);
  for (const reason of ['', '   '])
    expect(
      forkEditionV2(
        source,
        'selected',
        { id: 'target', name: 'Target' },
        { canForkEdition: () => reason },
      ),
    ).toEqual({ type: 'blocked', reason: 'Edition forking is protected.' });
  const failure = new Error('Policy unavailable');
  expect(() =>
    forkEditionV2(
      source,
      'selected',
      { id: 'target', name: 'Target' },
      {
        canForkEdition: () => {
          throw failure;
        },
      },
    ),
  ).toThrow(failure);
  expect(serializeModelDocumentV2(source)).toBe(before);
});

test('whole-source validation rejects legacy, duplicate and invalid unselected/origin checkpoints before policy', () => {
  const source = sourceFor('strict', 'loose');
  const target = { id: 'target', name: 'Target' };
  let calls = 0;
  const policy: ZlozEditionForkPolicyV2 = {
    canForkEdition: () => {
      calls++;
      return null;
    },
  };
  const legacy = parseModelDocument(JSON.stringify(legacyWire));
  // @ts-expect-error V1 source models require explicit v2 upgrade.
  expect(() => forkEditionV2(legacy, 'first', target, policy)).toThrow(ZlozError);
  expect(() =>
    forkEditionV2(
      { ...source, editions: [source.editions[0]!, source.editions[0]!] },
      'selected',
      target,
      policy,
    ),
  ).toThrow(ZlozError);
  const future = {
    ...source.editions[0]!,
    id: 'unselected',
    snapshot: { ...source.editions[0]!.snapshot, connectionMode: 'future' },
  };
  const unselected = { ...source, editions: [...source.editions, future] };
  // @ts-expect-error Invalid unselected checkpoint mode cannot be ignored.
  const forkUnselected = () => forkEditionV2(unselected, 'selected', target, policy);
  expect(forkUnselected).toThrow(ZlozError);
  const origin = { ...source, origin: { ...source.origin!, edition: future } };
  // @ts-expect-error Invalid pinned-origin mode cannot be ignored.
  const forkOrigin = () => forkEditionV2(origin, 'selected', target, policy);
  expect(forkOrigin).toThrow(ZlozError);
  expect(calls).toBe(0);
});

test('fork-of-fork pins only its immediate parent and preserves selected mode without inheriting model history', () => {
  const source = sourceFor('strict', 'loose');
  const parent = forkEditionV2(source, 'selected', { id: 'parent-fork', name: 'Parent fork' });
  if (parent.type !== 'forked') throw new Error('Expected parent');
  const edition = captureEditionV2({
    id: 'child-source',
    name: 'Child source',
    snapshot: parent.document.snapshot,
  });
  const parentDocument = captureModelDocumentV2({ ...parent.document, editions: [edition] });
  const before = serializeModelDocumentV2(parentDocument);
  const child = forkEditionV2(parentDocument, edition.id, { id: 'child-fork', name: 'Child fork' });
  if (child.type !== 'forked') throw new Error('Expected child');
  expect(child.document.origin).toEqual({
    modelId: parentDocument.id,
    modelName: parentDocument.name,
    edition,
  });
  expect(child.document.origin!.modelId).not.toBe(source.id);
  expect(child.document.snapshot.connectionMode).toBe('loose');
  expect(child.document.editions).toEqual([]);
  expect(parseModelDocumentV2(serializeModelDocumentV2(child.document))).toEqual(child.document);
  expect(serializeModelDocumentV2(parentDocument)).toBe(before);
});

test('fork retains checkpoint camera rather than review navigation, and absent cameras stay absent', () => {
  const source = sourceFor('strict', 'loose');
  const working = createModelEditorV2(source, { viewport: { x: 90, y: 100, zoom: 2 } });
  const review = createHistoryReviewV2(source.editions[0]!, working);
  const navigated = updateHistoryReviewV2(review, {
    type: 'ViewportNudged',
    delta: { x: 500, y: 0 },
  });
  const result = forkEditionV2(source, navigated.editionId, {
    id: 'camera-fork',
    name: 'Camera fork',
  });
  if (result.type !== 'forked') throw new Error('Expected fork');
  expect(result.document.snapshot.viewport).toEqual(loose().viewport!);
  expect(result.document.snapshot.viewport).not.toEqual(navigated.editor.viewport);
  const cameraLess = captureEditionV2({
    id: 'no-camera',
    name: 'No camera',
    snapshot: captureConnectionDocument({ graph: loose().graph, connectionMode: 'loose' }),
  });
  const noCameraSource = captureModelDocumentV2({ ...source, editions: [cameraLess] });
  const noCameraFork = forkEditionV2(noCameraSource, cameraLess.id, {
    id: 'default-camera',
    name: 'Default camera',
  });
  if (noCameraFork.type !== 'forked') throw new Error('Expected camera-less fork');
  expect('viewport' in noCameraFork.document.snapshot).toBe(false);
  expect('viewport' in noCameraFork.document.origin!.edition.snapshot).toBe(false);
  expect(createModelEditorV2(noCameraFork.document).viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(working.viewport).toEqual({ x: 90, y: 100, zoom: 2 });
});
