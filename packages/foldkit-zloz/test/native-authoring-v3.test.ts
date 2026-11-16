import { expect, test } from 'bun:test';

import {
  captureGroupDocumentV3,
  createGroupEditorV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  captureModellingPatchSourceV3,
  captureModellingPatchV3,
  dryRunModellingPatchV3,
  parseModellingPatchV3,
  resolveModellingPatchReviewV3,
  applyModellingPatchV3,
  parseModellingPatchReceiptV3,
  serializeModellingPatchReceiptV3,
  auditGroupDddRelationshipsV3,
  auditGroupEventStormingRelationshipsV3,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
const init = () =>
  createGroupEditorV3(captureGroupDocumentV3(wire), { sessionId: 'native-authoring-v3' });
function proposal() {
  const editor = init(),
    source = captureModellingPatchSourceV3(editor, 'orders');
  return {
    format: 'foldkit-zloz-patch' as const,
    version: 3 as const,
    id: 'rename',
    source,
    provenance: {
      actor: { kind: 'agent' as const, id: 'test' },
      reason: 'Clarify boundary name',
      references: [],
    },
    operations: [
      {
        id: 'rename-g',
        type: 'node.replace' as const,
        node: { ...source.graph.nodes.find((n) => n.id === 'g')!, label: 'Renamed boundary' },
      },
    ],
  };
}
test('native patches retain complete capability source, recheck policy/consent and publish one Undo with strict receipts', () => {
  const editor = init(),
    input = proposal(),
    patch = captureModellingPatchV3(input),
    preview = dryRunModellingPatchV3(input.source, patch);
  expect(preview.type).toBe('reviewable');
  expect(parseModellingPatchV3(JSON.stringify(input)).status).toBe('parsed');
  const review = resolveModellingPatchReviewV3(editor, 'orders', patch, { consent: null });
  expect(review.canApply).toBe(false);
  expect(review.key).not.toBeNull();
  const consent = { key: review.key!, reviewed: true as const, lossesAccepted: true as const };
  expect(
    applyModellingPatchV3(editor, 'orders', patch, {
      consent,
      policy: { canCommitGroupDocumentV3: () => 'Frozen' },
    }),
  ).toMatchObject({ type: 'blocked', editor, reason: 'Frozen' });
  const result = applyModellingPatchV3(editor, 'orders', patch, { consent });
  expect(result.type).toBe('applied');
  if (result.type !== 'applied') throw new Error('Expected native Apply');
  expect(result.editor.document.graph.nodes.find((n) => n.id === 'g')?.ports[0]?.id).toBe('out');
  expect(result.editor.history.past).toHaveLength(1);
  expect(
    updateGroupEditorV3(result.editor, {
      type: 'UndoPressed',
      source: captureGroupEditorSourceV3(result.editor),
    }).editor.document,
  ).toEqual(editor.document);
  const receipt = parseModellingPatchReceiptV3(serializeModellingPatchReceiptV3(result.receipt));
  expect(receipt.snapshot).toEqual(result.editor.document);
  expect(() =>
    parseModellingPatchReceiptV3(JSON.stringify({ ...receipt, snapshot: editor.document })),
  ).toThrow();
  expect(applyModellingPatchV3(result.editor, 'orders', patch, { consent }).type).toBe('blocked');
});
test('v3 source includes camera/capability/mode; dangling group edits and unreviewed intent are never partial', () => {
  const editor = init(),
    input = proposal();
  for (const source of [
    { ...input.source, viewport: { x: 1, y: 2, zoom: 1 } },
    { ...input.source, connectionMode: 'loose' as const },
    { ...input.source, revision: 1 },
  ])
    expect(dryRunModellingPatchV3(source, input).type).toBe('rejected');
  const broken = {
    ...input,
    operations: [{ id: 'remove', type: 'node.remove' as const, nodeId: 'g' }],
  };
  expect(dryRunModellingPatchV3(input.source, broken).type).toBe('rejected');
  expect(applyModellingPatchV3(editor, 'orders', input, { consent: null }).type).toBe('blocked');
  expect(editor.history.past).toEqual([]);
  expect(parseModellingPatchV3('{"version":3,"version":3}').status).toBe('rejected');
});
test('native audits validate the whole document without dropping group sockets', () => {
  const document = captureGroupDocumentV3(wire),
    before = JSON.stringify(document);
  expect(auditGroupDddRelationshipsV3(document).summary.edges).toBe(1);
  expect(auditGroupEventStormingRelationshipsV3(document).summary.edges).toBe(1);
  expect(() =>
    auditGroupDddRelationshipsV3({ ...document, capabilities: { groupPorts: false } }),
  ).toThrow();
  expect(JSON.stringify(document)).toBe(before);
});

import {
  parseModellingPatch,
  parseModellingPatchV2,
  parseModellingPatchReceiptV2,
} from '../src/index';
import literalReceipt from './fixtures/modelling-patch-receipt-v3.json';
import literalPatch from './fixtures/modelling-patch-v3.json';
test('literal v3 wire records qualify strict readers independently of the writer and old readers remain version-fixed', () => {
  const text = JSON.stringify(literalPatch);
  expect(parseModellingPatchV3(text).status).toBe('parsed');
  expect(parseModellingPatch(text)).toMatchObject({
    status: 'rejected',
    code: 'unsupported-version',
  });
  expect(parseModellingPatchV2(text)).toMatchObject({
    status: 'rejected',
    code: 'unsupported-version',
  });
  expect(parseModellingPatchReceiptV3(JSON.stringify(literalReceipt)).revision).toBe(8);
  expect(() => parseModellingPatchReceiptV2(JSON.stringify(literalReceipt))).toThrow();
  expect(
    parseModellingPatchV3(
      text.replace('"id":"literal-rename"', '"id":"literal-rename","extra":true'),
    ).status,
  ).toBe('rejected');
  expect(parseModellingPatchV3(text, { maxCharacters: 100 }).status).toBe('rejected');
  expect(() =>
    parseModellingPatchReceiptV3(JSON.stringify({ ...literalReceipt, revision: 9 })),
  ).toThrow();
  expect(() =>
    parseModellingPatchReceiptV3(JSON.stringify({ ...literalReceipt, lossesAccepted: false })),
  ).toThrow();
  expect(() =>
    parseModellingPatchReceiptV3(
      JSON.stringify({
        ...literalReceipt,
        snapshot: { ...literalReceipt.snapshot, connectionMode: 'loose' },
      }),
    ),
  ).toThrow();
});
