import { expect, test } from 'bun:test';

import { createOperationDocument, parseGraph } from '@opsydyn/foldkit-zloz';
import { parseCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';

import fixture from '../../foldkit-zloz/test/fixtures/operations-v1.json';
import { decideAssessment, applyAssessment, parseAssessmentRequest } from '../src/assessment';
import assessmentFixture from './fixtures/assessment-v1.json';

const assessment = () => parseCouplingAssessment(JSON.stringify(assessmentFixture));
const document = () =>
  createOperationDocument(parseGraph(JSON.stringify({ version: 1, graph: fixture.graph })));
const request = () => ({
  version: 1 as const,
  operationId: 'assessment-1',
  expectedRevision: 0,
  assessment: assessment(),
});
test('authors partial evidence without changing the graph; competing revision zero cannot overwrite it', () => {
  const graph = document();
  const before = JSON.stringify(graph);
  const saved = decideAssessment('diagram-a', graph, [], 'alice', request());
  expect(saved.status).toBe('accepted');
  if (saved.status !== 'accepted') return;
  expect(saved.record).toEqual({
    revision: 1,
    authoredBy: 'alice',
    operationId: 'assessment-1',
    assessment: assessment(),
  });
  expect(decideAssessment('diagram-a', graph, [saved.record], 'bob', request())).toEqual({
    status: 'rejected',
    code: 'revision-conflict',
    currentRevision: 1,
  });
  const next = decideAssessment('diagram-a', graph, [saved.record], 'bob', {
    ...request(),
    expectedRevision: 1,
    operationId: 'assessment-2',
  });
  expect(next.status).toBe('accepted');
  if (next.status === 'accepted')
    expect(applyAssessment([saved.record], next.record)).toEqual([
      { ...next.record, revision: 2, authoredBy: 'bob' },
    ]);
  expect(JSON.stringify(graph)).toBe(before);
});
test('freshness, document, edge and endpoints are checked against authoritative graph', () => {
  for (const target of [
    { graphVersion: 1 },
    { documentId: 'other' },
    { relationshipId: 'missing' },
    { sourceNodeId: 'b' },
    { targetNodeId: 'a' },
  ])
    expect(
      decideAssessment('diagram-a', document(), [], 'alice', {
        ...request(),
        assessment: { ...assessment(), target: { ...assessment().target, ...target } },
      }),
    ).toEqual({ status: 'rejected', code: 'stale-target', currentRevision: 0 });
});
test('strict request decoding rejects forged authors, extra fields and unsupported model versions', () => {
  expect(parseAssessmentRequest(JSON.stringify(request()))).toEqual(request());
  for (const invalid of [
    { ...request(), authoredBy: 'owner' },
    { ...request(), expectedRevision: -1 },
    { ...request(), assessment: { ...assessment(), modelVersion: 'unknown' } },
  ])
    expect(() => parseAssessmentRequest(JSON.stringify(invalid))).toThrow();
});

test('bounded assessment state refuses overflow without discarding previously authored evidence', () => {
  const record = {
    revision: 1,
    authoredBy: 'alice',
    operationId: 'earlier',
    assessment: assessment(),
  };
  const records = Array.from({ length: 500 }, (_, index) => ({
    ...record,
    assessment: {
      ...record.assessment,
      target: { ...record.assessment.target, relationshipId: `retained-${index}` },
    },
  }));
  expect(decideAssessment('diagram-a', document(), records, 'alice', request())).toEqual({
    status: 'rejected',
    code: 'capacity-exceeded',
    currentRevision: 0,
  });
  const big = Array.from({ length: 100 }, (_, index) => ({
    ...record,
    assessment: {
      ...record.assessment,
      target: { ...record.assessment.target, relationshipId: `retained-${index}` },
      scope: { abstraction: '界'.repeat(2048), horizon: '界'.repeat(2048) },
    },
  }));
  const before = JSON.stringify(big);
  expect(decideAssessment('diagram-a', document(), big, 'alice', request())).toEqual({
    status: 'rejected',
    code: 'capacity-exceeded',
    currentRevision: 0,
  });
  expect(JSON.stringify(big)).toBe(before);
});
