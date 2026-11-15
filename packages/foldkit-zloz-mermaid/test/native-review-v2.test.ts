import { expect, test } from 'bun:test';

import {
  captureModelDocumentV2,
  createModelEditorV2,
  parseConnectionDocument,
} from '@opsydyn/foldkit-zloz';

import wire from '../../foldkit-zloz/test/fixtures/connection-v2-loose.json';
import {
  createReviewPacketV2,
  parseReviewPacketV2,
  parseReviewPacket,
  openReviewPacketV2,
} from '../src/index';
test('v2 packets reproduce mixed-mode audit/projections and reopen read-only without touching working history', () => {
  const snapshot = parseConnectionDocument(JSON.stringify(wire));
  const baseline = {
    version: 2 as const,
    connectionMode: 'strict' as const,
    graph: { ...snapshot.graph, edges: [] },
  };
  const document = captureModelDocumentV2({
    id: 'm',
    name: 'M',
    snapshot,
    editions: [{ id: 'base', name: 'Base', snapshot: baseline }],
    origin: null,
  });
  const result = createReviewPacketV2(document, { baselineId: 'base' }, { lossPolicy: 'report' });
  expect(result.status).toBe('created');
  if (result.status !== 'created') throw new Error('Expected packet');
  const text = JSON.stringify(result.value);
  expect(parseReviewPacket(text)).toMatchObject({
    status: 'rejected',
    code: 'unsupported-version',
  });
  expect(parseReviewPacketV2(text)).toEqual({ status: 'parsed', value: result.value });
  const editor = createModelEditorV2(document),
    before = JSON.stringify(editor);
  const opened = openReviewPacketV2(text, 'baseline', editor);
  expect(opened.status).toBe('opened');
  if (opened.status === 'opened') {
    expect(opened.review.editor.readOnly).toBe(true);
    expect(opened.review.editor.connectionMode).toBe('strict');
    expect(opened.review.editor.past).toHaveLength(0);
  }
  expect(JSON.stringify(editor)).toBe(before);
  const forged = JSON.parse(text);
  forged.projections.selected.connectionMode = 'strict';
  expect(parseReviewPacketV2(JSON.stringify(forged))).toMatchObject({
    status: 'rejected',
    code: 'inconsistent-packet',
  });
  expect(parseReviewPacketV2(text.replace('"version":2', '"version":2,"version":2'))).toMatchObject(
    { status: 'rejected', code: 'invalid-json' },
  );
});

test('native packet creation rejects evidence beyond its default reopening budgets', () => {
  const graph = {
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'p', kind: 'input' as const, side: 'left' as const, offset: 0.5 }],
        data: { large: 'x'.repeat(1_990_000) },
      },
    ],
    edges: Array.from({ length: 300 }, (_, i) => ({
      id: 'e' + i,
      source: { node: 'a', port: 'p' },
      target: { node: 'a', port: 'p' },
    })),
  };
  const result = createReviewPacketV2(
    {
      id: 'large',
      name: 'Large',
      snapshot: { version: 2, connectionMode: 'loose', graph },
      editions: [
        {
          id: 'base',
          name: 'Base',
          snapshot: { version: 2, connectionMode: 'strict', graph: { nodes: [], edges: [] } },
        },
      ],
      origin: null,
    },
    { baselineId: 'base' },
    { lossPolicy: 'report' },
  );
  expect(result).toMatchObject({
    status: 'rejected',
    reason: 'projection',
    diagnostics: [{ code: 'packet-limit' }],
  });
});
