import { expect, test } from 'bun:test';

import {
  captureModelDocumentV3,
  parseModelDocumentV3,
  serializeModelDocumentV3,
  captureEditionV3,
  parseEditionsV3,
  serializeEditionsV3,
  upgradeModelDocumentV3,
  planModelDocumentDowngradeV3,
  createModelEditorV3,
  createHistoryReviewV3,
  compareEditionsV3,
  mergeEditionsV3,
  forkModelDocumentV3,
  restoreModelEditionV3,
  captureWorkingModelV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  parseModelDocument,
  parseModelDocumentV2,
} from '../src/index';
import legacy from './fixtures/group-document-v1-portless.json';
import wire from './fixtures/model-v3.json';
const model = () => parseModelDocumentV3(JSON.stringify(wire));

test('literal v3 model retains each checkpoint capability/mode/camera and rejects old readers', () => {
  const document = model();
  expect(document.snapshot.capabilities.groupPorts).toBe(true);
  expect(document.editions[0]?.snapshot.capabilities.groupPorts).toBe(false);
  expect(Object.isFrozen(document.editions[0]?.snapshot.graph.nodes)).toBe(true);
  expect(parseModelDocumentV3(serializeModelDocumentV3(document))).toEqual(document);
  expect(parseEditionsV3(serializeEditionsV3(document.editions))).toEqual(document.editions);
  expect(() => parseModelDocumentV2(JSON.stringify(wire))).toThrow();
  expect(() => parseModelDocument(JSON.stringify(wire))).toThrow();
  const mutable = structuredClone(wire);
  const captured = captureModelDocumentV3(mutable.document);
  mutable.document.snapshot.graph.nodes[0]!.label = 'Mutated';
  expect(captured.snapshot.graph.nodes[0]?.label).toBe('Child');
});

test('model/edition decoding rejects duplicate keys, unknown fields, budget excess and unowned accessors', () => {
  expect(() =>
    parseModelDocumentV3('{"format":"foldkit-zloz-model","version":3,"version":3,"document":{}}'),
  ).toThrow();
  expect(() => captureModelDocumentV3({ ...model(), unrecognised: true })).toThrow();
  expect(() =>
    captureModelDocumentV3({ ...model(), editions: [model().editions[0]!, model().editions[0]!] }),
  ).toThrow();
  let observed = false;
  const input = {
    ...model(),
    get snapshot() {
      observed = true;
      return model().snapshot;
    },
  };
  expect(() => captureModelDocumentV3(input)).toThrow();
  expect(observed).toBe(false);
  expect(() => parseModelDocumentV3(' '.repeat(16000001))).toThrow();
});

test('upgrade is explicit and full-model downgrade refuses any ported checkpoint with no partial target', () => {
  const old = {
    id: 'old',
    name: 'Old',
    snapshot: { graph: legacy.graph, viewport: legacy.viewport },
    editions: [],
    origin: null,
  };
  const upgraded = upgradeModelDocumentV3(old);
  expect(upgraded.snapshot.version).toBe(3);
  expect(upgraded.snapshot.capabilities.groupPorts).toBe(false);
  const plan = planModelDocumentDowngradeV3(model());
  expect(plan.type).toBe('blocked');
  expect('document' in plan).toBe(false);
  const clean = planModelDocumentDowngradeV3(upgraded);
  expect(clean.type).toBe('reviewable');
  if (clean.type !== 'reviewable') throw new Error('Expected reviewable');
  expect(clean.document.snapshot.connectionMode).toBe('strict');
  expect(() => upgradeModelDocumentV3(model())).toThrow();
});

test('model initialization and detached read-only history never share working Undo state', () => {
  const document = model(),
    editor = createModelEditorV3(document, { sessionId: 'working' }),
    edition = document.editions[0];
  if (!edition) throw new Error('Missing literal edition');
  const review = createHistoryReviewV3(edition, 'review');
  expect(review.editor.readOnly).toBe(true);
  expect(review.editor.historyLimit).toBe(0);
  expect(review.editor.document).toEqual(edition.snapshot);
  expect(editor.document).toEqual(document.snapshot);
  expect(editor.history.past).toEqual([]);
  expect(editor.document.capabilities.groupPorts).toBe(true);
  expect(review.editor.sessionId).not.toBe(editor.sessionId);
});

test('v3 comparison reports mode/capability-only meaning without inventing graph differences', () => {
  const base = captureEditionV3({ id: 'a', name: 'A', snapshot: model().editions[0]!.snapshot });
  const target = captureEditionV3({
    id: 'b',
    name: 'B',
    snapshot: { ...base.snapshot, connectionMode: 'loose', capabilities: { groupPorts: true } },
  });
  const diff = compareEditionsV3(base, target);
  expect(diff.nodes).toEqual([]);
  expect(diff.edges).toEqual([]);
  expect(diff.modeChange.changed).toBe(true);
  expect(diff.capabilityChange.changed).toBe(true);
  expect(diff.semanticChanged).toBe(true);
});

test('edition merge is additive/idempotent and conflicting IDs leave the entire collection intact', () => {
  const editions = model().editions,
    extra = captureEditionV3({ ...editions[0]!, id: 'later' });
  const merged = mergeEditionsV3(editions, [extra]);
  expect(merged.type).toBe('merged');
  if (merged.type === 'blocked') throw new Error('Unexpected conflict');
  expect(merged.editions.map((e) => e.id)).toEqual(['baseline', 'later']);
  expect(mergeEditionsV3(merged.editions, [extra]).type).toBe('unchanged');
  expect(mergeEditionsV3(editions, [{ ...editions[0]!, name: 'Conflict' }]).type).toBe('blocked');
});

test('fork pins the exact immediate-parent edition and rejects identity reuse', () => {
  const source = model(),
    edition = source.editions[0];
  if (!edition) throw new Error('Missing edition');
  const fork = forkModelDocumentV3(source, edition.id, { id: 'fork', name: 'Fork' });
  expect(fork.origin).toEqual({ modelId: source.id, modelName: source.name, edition });
  expect(fork.snapshot).toEqual(edition.snapshot);
  expect(fork.editions).toEqual([]);
  expect(() =>
    forkModelDocumentV3(source, edition.id, { id: source.id, name: 'Same ID' }),
  ).toThrow();
});

test('restore publishes graph/mode/capability/camera in one Undo, rechecking source and protections', () => {
  const document = model(),
    editor = createModelEditorV3(document, { sessionId: 'restore' }),
    source = captureGroupEditorSourceV3(editor);
  const result = restoreModelEditionV3(document, editor, {
    source,
    modelId: document.id,
    edition: document.editions[0]!,
  });
  expect(result.type).toBe('applied');
  expect(result.editor.document).toEqual(document.editions[0]!.snapshot);
  expect(result.editor.history.past).toHaveLength(1);
  const updated = captureWorkingModelV3(document, result.editor);
  expect(updated.snapshot).toEqual(result.editor.document);
  expect(updated.editions).toEqual(document.editions);
  const undo = updateGroupEditorV3(result.editor, {
    type: 'UndoPressed',
    source: captureGroupEditorSourceV3(result.editor),
  });
  expect(undo.editor.document).toEqual(document.snapshot);
  expect(
    restoreModelEditionV3(document, result.editor, {
      source,
      modelId: document.id,
      edition: document.editions[0]!,
    }).type,
  ).toBe('blocked');
  expect(
    restoreModelEditionV3(
      document,
      editor,
      { source, modelId: document.id, edition: document.editions[0]! },
      { canDelete: () => 'Protected removal.' },
    ).type,
  ).toBe('blocked');
});
