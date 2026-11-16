import { expect, test } from 'bun:test';

import { captureModelDocumentV3, captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

import wire from '../../foldkit-zloz/test/fixtures/group-document-v3-ported.json';
import {
  createReviewPacketV3,
  parseReviewPacketV3,
  openReviewPacketV3,
  parseReviewPacketV2,
} from '../src/index';
test('native packets recompute full checkpoints, capability-aware audit deltas and group Mermaid projections before independent reopening', () => {
  const snapshot = captureGroupDocumentV3(wire),
    document = captureModelDocumentV3({
      id: 'packet-native',
      name: 'Native',
      snapshot,
      editions: [
        { id: 'base', name: 'Baseline', snapshot: { ...snapshot, connectionMode: 'loose' } },
      ],
      origin: null,
    });
  const result = createReviewPacketV3(document, { baselineId: 'base' }, { lossPolicy: 'report' });
  expect(result.status).toBe('created');
  if (result.status !== 'created') throw new Error('Expected native packet');
  expect(result.value.projections.selected.protocol).toBe('foldkit-zloz-mermaid/v3');
  expect(result.value.baseline.snapshot.connectionMode).toBe('loose');
  expect(result.value.comparison.selected.capabilities.groupPorts).toBe(true);
  const text = JSON.stringify(result.value),
    parsed = parseReviewPacketV3(text);
  expect(parsed.status).toBe('parsed');
  expect(parseReviewPacketV2(text).status).toBe('rejected');
  const opened = openReviewPacketV3(text, 'baseline', 'packet-review-session');
  expect(opened.status).toBe('opened');
  if (opened.status !== 'opened') throw new Error('Expected read-only review');
  expect(opened.review.editor.readOnly).toBe(true);
  expect(opened.review.editor.history.past).toEqual([]);
  expect(opened.review.editor.document.capabilities.groupPorts).toBe(true);
  const forged = JSON.parse(text);
  forged.projections.selected.source += ' changed';
  expect(parseReviewPacketV3(JSON.stringify(forged)).status).toBe('rejected');
  expect(parseReviewPacketV3('{"version":3,"version":3}').status).toBe('rejected');
});
