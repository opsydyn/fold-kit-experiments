import { expect, test } from 'bun:test';

import { Schema } from 'effect';

import { CouplingAssessmentSchema, AssessmentRecordsSchema } from '../src/assessment';
import fixture from './fixtures/assessment-v1.json';

const codec = Schema.toCodecJson(CouplingAssessmentSchema);
const encode = Schema.encodeUnknownSync(codec);
const decode = Schema.decodeUnknownSync(codec);

test('JSON assessment encoding validates each evidence leaf once without a generic second traversal', () => {
  const assessment = structuredClone(fixture);
  let reads = 0;
  const rationale = assessment.inputs.distance.rationale;
  Object.defineProperty(assessment.inputs.distance, 'rationale', {
    enumerable: true,
    get: () => {
      reads++;
      return rationale;
    },
  });
  encode(assessment);
  expect(reads).toBe(1);
});

test('JSON codec preserves literal Unicode evidence and rejects malformed values in both directions', () => {
  const assessment = {
    ...structuredClone(fixture),
    scope: { abstraction: '界 🧭 e\u0301', horizon: 'Next\nquarter' },
  };
  expect(JSON.stringify(encode(assessment))).toBe(JSON.stringify(assessment));
  expect<unknown>(decode(JSON.parse(JSON.stringify(assessment)))).toEqual(assessment);
  type CyclicFixture = { self?: CyclicFixture };
  const cycle: CyclicFixture = {};
  cycle.self = cycle;
  const invalid = [
    null,
    [],
    { ...assessment, version: 2 },
    { ...assessment, modelVersion: 'unsupported' },
    { ...assessment, extra: 'not in v1' },
    { ...assessment, extra: () => undefined },
    { ...assessment, target: { ...assessment.target, graphVersion: NaN } },
    { ...assessment, target: { ...assessment.target, graphVersion: Infinity } },
    { ...assessment, target: { ...assessment.target, graphVersion: 1n } },
    { ...assessment, scope: { abstraction: cycle, horizon: 'now' } },
    { ...assessment, inputs: { ...assessment.inputs, strength: { status: 'known' } } },
    {
      ...assessment,
      inputs: {
        ...assessment.inputs,
        distance: { ...assessment.inputs.distance, rationale: Symbol('evidence') },
      },
    },
    {
      ...assessment,
      inputs: {
        ...assessment.inputs,
        integrationType: { ...assessment.inputs.integrationType, value: 'invented' },
      },
    },
    {
      ...assessment,
      inputs: {
        ...assessment.inputs,
        volatility: { status: 'unknown', reason: '  ' },
      },
    },
  ];
  for (const value of invalid) {
    expect(() => encode(value)).toThrow();
    expect(() => decode(value)).toThrow();
  }
});

test('JSON record codec retains unique-ID, count and UTF-8 size limits', () => {
  const records = Array.from({ length: 480 }, (_, index) => ({
    revision: 1,
    authoredBy: 'alice',
    operationId: `assessment-${index}`,
    assessment: {
      ...structuredClone(fixture),
      target: { ...fixture.target, relationshipId: `relationship-${index}` },
    },
  }));
  const recordsCodec = Schema.toCodecJson(AssessmentRecordsSchema);
  const encodeRecords = Schema.encodeUnknownSync(recordsCodec);
  const decodeRecords = Schema.decodeUnknownSync(recordsCodec);
  expect(JSON.stringify(encodeRecords(records))).toBe(JSON.stringify(records));
  expect<unknown>(decodeRecords(JSON.parse(JSON.stringify(records)))).toEqual(records);
  const oversized = records.map((record) => ({
    ...record,
    assessment: {
      ...record.assessment,
      scope: { abstraction: '界'.repeat(2048), horizon: '🧭'.repeat(1024) },
    },
  }));
  expect(new TextEncoder().encode(JSON.stringify(oversized)).byteLength).toBeGreaterThan(1_048_576);
  const tooMany = Array.from({ length: 501 }, (_, index) => ({
    ...records[0]!,
    assessment: {
      ...records[0]!.assessment,
      target: { ...records[0]!.assessment.target, relationshipId: `relationship-${index}` },
    },
  }));
  for (const value of [[records[0], records[0]], tooMany, oversized]) {
    expect(() => encodeRecords(value)).toThrow();
    expect(() => decodeRecords(value)).toThrow();
  }
});
