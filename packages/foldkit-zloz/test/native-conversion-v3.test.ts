import { expect, test } from 'bun:test';

import {
  captureGroupDocumentV3,
  captureModelDocumentV3,
  createGroupEditorV3,
  updateGroupEditorV3,
  captureGroupEditorSourceV3,
  createEventStormingDddConversionPlanV3,
  applyEventStormingDddConversionV3,
  serializeEventStormingDddConversionV3,
  parseEventStormingDddConversionV3,
  createEventStormingC4ConversionPlanV3,
  applyEventStormingC4ConversionV3,
  serializeEventStormingC4ConversionV3,
  parseEventStormingC4ConversionV3,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
function initial() {
  const snapshot = captureGroupDocumentV3({
    ...wire,
    graph: {
      ...wire.graph,
      nodes: wire.graph.nodes.map((n) =>
        n.id === 'child'
          ? { ...n, architecture: { family: 'event-storming', role: 'command' } }
          : n,
      ),
    },
  });
  const old = captureGroupDocumentV3({
    version: 3,
    coordinateSpace: 'world',
    connectionMode: 'loose',
    capabilities: { groupPorts: false },
    graph: { nodes: [], edges: [] },
  });
  const document = captureModelDocumentV3({
    id: 'workshop-v3',
    name: 'Native workshop',
    snapshot,
    editions: [{ id: 'old', name: 'Before group capability', snapshot: old }],
    origin: null,
  });
  const editor = createGroupEditorV3(snapshot, { sessionId: 'conversion-v3' });
  return { editor, source: { document, sessionId: editor.sessionId, revision: editor.revision } };
}
test('native DDD mapping/Apply keeps group sockets, archives and full source provenance in strict portable receipts', () => {
  const { editor, source } = initial(),
    mappings = {
      nodes: [
        {
          nodeId: 'child',
          architecture: { family: 'ddd' as const, role: 'domain-service' as const },
        },
      ],
    };
  const plan = createEventStormingDddConversionPlanV3(source, mappings);
  expect(plan.type).toBe('reviewable');
  expect(applyEventStormingDddConversionV3(editor, source, { mappings, consent: null }).type).toBe(
    'blocked',
  );
  const options = { mappings, consent: { planKey: plan.key, accepted: true as const } };
  const blocked = applyEventStormingDddConversionV3(editor, source, {
    ...options,
    policy: { canChangeNodeArchitecture: () => 'Role protected.' },
  });
  expect(blocked).toMatchObject({ type: 'blocked', editor, reason: 'Role protected.' });
  const result = applyEventStormingDddConversionV3(editor, source, options);
  expect(result.type).toBe('applied');
  if (result.type !== 'applied') throw new Error('Expected DDD conversion');
  expect(result.editor.document.graph.nodes.find((n) => n.id === 'g')?.ports[0]?.id).toBe('out');
  expect(result.conversion.document.editions).toEqual(source.document.editions);
  expect(result.editor.history.past).toHaveLength(1);
  expect(
    updateGroupEditorV3(result.editor, {
      type: 'UndoPressed',
      source: captureGroupEditorSourceV3(result.editor),
    }).editor.document,
  ).toEqual(editor.document);
  const receipt = parseEventStormingDddConversionV3(
    serializeEventStormingDddConversionV3(result.conversion),
  );
  expect(receipt.source.document).toEqual(source.document);
  expect(() =>
    parseEventStormingDddConversionV3(JSON.stringify({ ...receipt, document: source.document })),
  ).toThrow();
});
test('native C4 explicit placement and receipt recomputation preserve capabilities without a legacy editor', () => {
  const { editor, source } = initial(),
    conversion = {
      mappings: {
        nodes: [
          {
            nodeId: 'child',
            architecture: { family: 'c4' as const, role: 'software-system' as const },
          },
        ],
      },
      memberships: [{ nodeId: 'child', placement: { type: 'root' as const } }],
    };
  const plan = createEventStormingC4ConversionPlanV3(source, conversion);
  expect(plan.type).toBe('reviewable');
  const result = applyEventStormingC4ConversionV3(editor, source, {
    conversion,
    consent: { planKey: plan.key, accepted: true },
  });
  expect(result.type).toBe('applied');
  if (result.type !== 'applied') throw new Error('Expected C4 conversion');
  expect(
    result.editor.document.graph.nodes.find((n) => n.id === 'child')?.parentId,
  ).toBeUndefined();
  expect(result.editor.document.graph.nodes.find((n) => n.id === 'g')?.ports[0]?.id).toBe('out');
  const text = serializeEventStormingC4ConversionV3(result.conversion),
    receipt = parseEventStormingC4ConversionV3(text);
  expect(receipt.document.editions).toEqual(source.document.editions);
  expect(receipt.source.document.snapshot.capabilities.groupPorts).toBe(true);
  expect(() =>
    parseEventStormingC4ConversionV3(text.replace('"version":3', '"version":2')),
  ).toThrow();
  expect(
    applyEventStormingC4ConversionV3({ ...editor, sessionId: 'replacement' }, source, {
      conversion,
      consent: { planKey: plan.key, accepted: true },
    }).type,
  ).toBe('blocked');
});
