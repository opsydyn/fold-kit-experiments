import { expect, test } from 'bun:test';

import {
  createModelEditorV2,
  captureModelDocumentV2,
  updateEditor,
  createEventStormingC4ConversionPlanV2,
  applyEventStormingC4ConversionV2,
  serializeEventStormingC4ConversionV2,
  parseEventStormingC4ConversionV2,
  parseEventStormingC4Conversion,
  createEventStormingDddConversionPlanV2,
  applyEventStormingDddConversionV2,
  serializeEventStormingDddConversionV2,
  parseEventStormingDddConversionV2,
  parseEventStormingDddConversion,
  type ZlozEventStormingC4ConversionOptions,
} from '../src/index';
import looseWire from './fixtures/connection-v2-loose.json';
function fixture() {
  const graph = {
    nodes: looseWire.graph.nodes.map((n) => ({
      ...n,
      ports: [{ id: 'shared', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
      architecture: { family: 'event-storming' as const, role: 'domain-event' as const },
    })),
    edges: looseWire.graph.edges,
  };
  const snapshot = {
    version: 2 as const,
    connectionMode: 'loose' as const,
    graph,
    viewport: looseWire.viewport,
  };
  const document = captureModelDocumentV2({
    id: 'm',
    name: 'M',
    snapshot,
    editions: [
      {
        id: 'base',
        name: 'Base',
        snapshot: { version: 2, connectionMode: 'strict', graph: { nodes: [], edges: [] } },
      },
    ],
    origin: null,
  });
  const editor = createModelEditorV2(document);
  return { editor, source: { document, sessionId: 's', revision: editor.revision } };
}
test('native C4 conversion retains all checkpoint modes, ordered ports, provenance and one Undo', () => {
  const { source, editor } = fixture();
  const conversion: ZlozEventStormingC4ConversionOptions = {
    mappings: {
      nodes: source.document.snapshot.graph.nodes.map((n) => ({
        nodeId: n.id,
        architecture: { family: 'c4', role: 'software-system' },
      })),
      edges: [{ edgeId: 'orders-billing', relationship: { label: 'Uses' } }],
    },
    memberships: ['a', 'b'].map((nodeId) => ({ nodeId, placement: { type: 'root' } })),
  };
  const plan = createEventStormingC4ConversionPlanV2(source, conversion);
  expect(plan.type).toBe('reviewable');
  const options = { conversion, consent: { planKey: plan.key, accepted: true as const } };
  const applied = applyEventStormingC4ConversionV2(editor, source, options);
  expect(applied.type).toBe('applied');
  if (applied.type !== 'applied') throw new Error('Apply failed');
  const json = serializeEventStormingC4ConversionV2(applied.conversion);
  expect(parseEventStormingC4ConversionV2(json)).toEqual(applied.conversion);
  expect(() => parseEventStormingC4Conversion(json)).toThrow();
  expect(applied.conversion.document.editions[0]?.snapshot.connectionMode).toBe('strict');
  expect(applied.editor.connectionMode).toBe('loose');
  expect(applied.editor.graph.edges[0]?.source).toEqual(editor.graph.edges[0]?.source);
  expect(updateEditor(applied.editor, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
  expect(
    applyEventStormingC4ConversionV2(editor, source, {
      ...options,
      policy: { canChangeNodeArchitecture: () => 'Protected' },
    }).type,
  ).toBe('blocked');
  const tampered = JSON.parse(json);
  tampered.document.snapshot.connectionMode = 'strict';
  expect(() => parseEventStormingC4ConversionV2(JSON.stringify(tampered))).toThrow();
});
test('native DDD conversion recomputes strict v2 receipts and cannot use stale consent', () => {
  const { source, editor } = fixture();
  const mappings = { edges: [{ edgeId: 'orders-billing', architecture: null }] };
  const plan = createEventStormingDddConversionPlanV2(source, mappings);
  expect(plan.type).toBe('reviewable');
  const options = { mappings, consent: { planKey: plan.key, accepted: true as const } };
  const applied = applyEventStormingDddConversionV2(editor, source, options);
  expect(applied.type).toBe('applied');
  if (applied.type !== 'applied') throw new Error('Apply failed');
  const json = serializeEventStormingDddConversionV2(applied.conversion);
  expect(parseEventStormingDddConversionV2(json)).toEqual(applied.conversion);
  expect(() => parseEventStormingDddConversion(json)).toThrow();
  expect(updateEditor(applied.editor, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
  expect(applyEventStormingDddConversionV2(applied.editor, source, options).type).toBe('blocked');
});

test('literal v2 conversion receipts reopen, reject v1 readers, duplicate fields and forged acceptance', async () => {
  for (const [name, read, old] of [
    ['c4', parseEventStormingC4ConversionV2, parseEventStormingC4Conversion],
    ['ddd', parseEventStormingDddConversionV2, parseEventStormingDddConversion],
  ] as const) {
    const text = await Bun.file(
      new URL(`./fixtures/${name}-conversion-v2.json`, import.meta.url),
    ).text();
    expect(read(text).source.document.snapshot.connectionMode).toBe('loose');
    expect(() => old(text)).toThrow();
    const forged = JSON.parse(text);
    forged.lossesAccepted = false;
    expect(() => read(JSON.stringify(forged))).toThrow();
    expect(() => read(text.replace('"version": 2', '"version": 2,"version": 2'))).toThrow();
    expect(() => read('x'.repeat(2_000_001))).toThrow();
  }
});
