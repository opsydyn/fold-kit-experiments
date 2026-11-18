import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument } from '@opsydyn/foldkit-zloz';
import { AssessmentRecordsSchema } from '@opsydyn/foldkit-zloz-alchemy/assessment';
import { isDiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Schema } from 'effect';

import { projectCoupling } from '../src/editor/coupling-projection';
import { makeCouplingStressFixture, matchesAssessmentEvidence } from './coupling-load';

test('the declared stress fixture crosses real record/frame guards and the independent eight-case oracle', () => {
  const { graph, records } = makeCouplingStressFixture('qualification-diagram');
  expect(graph.nodes).toHaveLength(250);
  expect(graph.edges).toHaveLength(500);
  expect(records).toHaveLength(480);
  expect(Schema.is(AssessmentRecordsSchema)(records)).toBe(true);
  const frame = {
    target: { teamId: 'qualification-team', diagramId: 'qualification-diagram' },
    sourceVersion: 480,
    document: createOperationDocument(graph),
    coverage: [],
    assessments: records,
  };
  expect(isDiagramFrame(frame)).toBe(true);
  const projection = projectCoupling(frame);
  expect(projection.status).toBe('ready');
  assert(projection.status === 'ready', 'Missing projection');
  expect(projection.readiness).toEqual({
    total: 500,
    'complementary-balance': 240,
    'low-volatility-balance': 120,
    imbalance: 120,
    unknown: 0,
    stale: 0,
    'invalid-binding': 0,
    'not-started': 20,
  });
  const combinations = new Map<string, number>();
  for (const { assessment } of records) {
    const { strength, distance, volatility } = assessment.inputs;
    const key = JSON.stringify([strength, distance, volatility]);
    combinations.set(key, (combinations.get(key) ?? 0) + 1);
  }
  expect([...combinations.values()]).toEqual(Array.from({ length: 8 }, () => 60));
});

test('a DOM acknowledgement requires exact rendered revision, rationale, state and source; graph version alone is insufficient', () => {
  const expected = { revision: 2, marker: 'assessment-load:17!', state: 'imbalance' };
  const rendered = {
    sourceVersion: 500,
    state: 'imbalance',
    text: 'Author alice · revision 2 · assessed graph version 0 rationale assessment-load:17!',
  };
  expect(matchesAssessmentEvidence(rendered, expected, 500)).toBe(true);
  expect(matchesAssessmentEvidence({ ...rendered, sourceVersion: 499 }, expected, 500)).toBe(false);
  expect(matchesAssessmentEvidence({ ...rendered, state: 'stale' }, expected, 500)).toBe(false);
  expect(
    matchesAssessmentEvidence({ ...rendered, text: 'assessment-load:17!' }, expected, 500),
  ).toBe(false);
  expect(
    matchesAssessmentEvidence(
      { ...rendered, text: rendered.text.replace('revision 2 ', 'revision 20 ') },
      expected,
      500,
    ),
  ).toBe(false);
  expect(
    matchesAssessmentEvidence(
      { ...rendered, text: rendered.text.replace('17!', '170!') },
      expected,
      500,
    ),
  ).toBe(false);
});
