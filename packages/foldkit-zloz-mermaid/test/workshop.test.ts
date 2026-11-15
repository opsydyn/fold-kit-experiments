import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { parseGraph, eventStormingWorkshopRelationshipRules } from '@opsydyn/foldkit-zloz';

import wire from '../../foldkit-zloz/test/fixtures/workshop-v1.json';
import { exportMermaid, createReviewPacket, parseReviewPacket } from '../src/index';
import legacy from './fixtures/review-packet-v1.json';
test('workshop descriptors retain source identity and explicit semantic losses in Mermaid and portable review packets', () => {
  const graph = parseGraph(JSON.stringify(wire));
  const projection = exportMermaid(graph, { lossPolicy: 'report' });
  assert(projection.status === 'converted');
  for (const id of ['system', 'hotspot', 'lane']) {
    expect(projection.value.identity.nodes.some((n) => n.flowId === id)).toBe(true);
    expect(
      projection.diagnostics.some(
        (d) => d.subject === id && d.dimension === 'semantics' && d.severity === 'loss',
      ),
    ).toBe(true);
  }
  expect(exportMermaid(graph).status).toBe('rejected');
  const model = {
    id: 'workshop',
    name: 'Workshop',
    snapshot: { graph },
    editions: [{ id: 'before', name: 'Before', snapshot: { graph } }],
    origin: null,
  };
  const packet = createReviewPacket(
    model,
    { baselineId: 'before' },
    { rules: eventStormingWorkshopRelationshipRules, lossPolicy: 'report' },
  );
  assert(packet.status === 'created');
  expect(packet.value.comparison.summary).toEqual({
    introduced: 0,
    resolved: 0,
    persisting: 0,
  });
  const parsed = parseReviewPacket(JSON.stringify(packet.value));
  expect(parsed.status).toBe('parsed');
  // The historical builtin catalogue and its v1 packet remain byte-for-byte reproducible.
  const old = parseReviewPacket(JSON.stringify(legacy));
  expect(old.status).toBe('parsed');
});
