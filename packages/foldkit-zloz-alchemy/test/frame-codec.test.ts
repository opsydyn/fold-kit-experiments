import { expect, test } from 'bun:test';

import { createOperationDocument } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

import { DiagramFrameSchema } from '../src/session';
import assessment from './fixtures/assessment-v1.json';

const frame = () => ({
  target: { teamId: 'team-a', diagramId: 'diagram-a' },
  sourceVersion: 1,
  document: createOperationDocument({ nodes: [], edges: [] }),
  coverage: [],
  assessments: [
    {
      revision: 1,
      authoredBy: 'alice',
      operationId: 'assessment-1',
      assessment: structuredClone(assessment),
    },
  ],
});

test('typed frame JSON encoding validates and measures evidence without a generic full-frame traversal', () => {
  const input = frame();
  let reads = 0;
  const rationale = input.assessments[0]!.assessment.inputs.distance.rationale;
  Object.defineProperty(input.assessments[0]!.assessment.inputs.distance, 'rationale', {
    enumerable: true,
    get: () => {
      reads++;
      return rationale;
    },
  });
  Schema.encodeUnknownSync(Schema.toCodecJson(DiagramFrameSchema))(input);
  // One domain validation and one exact byte-cap serialization are both retained.
  expect(reads).toBe(2);
});

test('frame JSON codec preserves JSON extension properties at every loose boundary', () => {
  const base = frame();
  const input = {
    ...base,
    extension: { future: ['界', null, true] },
    target: { ...base.target, extension: { future: 2 } },
    assessments: base.assessments.map((record) => ({ ...record, extension: { future: 3 } })),
    coverage: [
      {
        actorId: 'alice',
        operationId: 'edit',
        requestHash: 'hash',
        documentVersion: 0,
        status: 'accepted',
        extension: { future: 4 },
      },
    ],
  };
  Object.defineProperty(input, '__proto__', { value: { retained: true }, enumerable: true });
  const codec = Schema.toCodecJson(DiagramFrameSchema);
  const encoded = Schema.encodeUnknownSync(codec)(input);
  expect<unknown>(encoded).toEqual(input);
  expect<unknown>(Schema.decodeUnknownSync(codec)(JSON.parse(JSON.stringify(input)))).toEqual(
    input,
  );
  expect(Object.hasOwn(Object(encoded), '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(Object(encoded))).toBe(Object.prototype);
});

test('frame JSON codec rejects non-JSON extensions and retains all frame/record guards', () => {
  const base = frame();
  type CyclicFixture = { self?: CyclicFixture };
  const cycle: CyclicFixture = {};
  cycle.self = cycle;
  const invalid: unknown[] = [
    { ...base, sourceVersion: -1 },
    { ...base, undoResetVersion: 1 },
    { ...base, assessments: [base.assessments[0], base.assessments[0]] },
    { ...base, assessments: [{ ...base.assessments[0], revision: 0 }] },
    {
      ...base,
      assessments: [{ ...base.assessments[0], assessment: { ...assessment, version: 2 } }],
    },
    { ...base, document: { ...base.document, version: -1 } },
    {
      ...base,
      coverage: Array.from({ length: 129 }, () => ({
        actorId: 'alice',
        operationId: 'edit',
        requestHash: 'hash',
        documentVersion: 0,
        status: 'accepted',
      })),
    },
    {
      ...base,
      assessments: Array.from({ length: 501 }, (_, index) => ({
        ...base.assessments[0],
        assessment: {
          ...assessment,
          target: { ...assessment.target, relationshipId: `edge-${index}` },
        },
      })),
    },
    {
      ...base,
      assessments: Array.from({ length: 200 }, (_, index) => ({
        ...base.assessments[0],
        assessment: {
          ...assessment,
          target: { ...assessment.target, relationshipId: `edge-${index}` },
          scope: { abstraction: '界'.repeat(2048), horizon: '界'.repeat(2048) },
        },
      })),
    },
  ];
  const classValue = <T>(value: T) => Object.assign(Object.create({ custom: true }), value);
  const nonJsonPrototypes = [
    classValue(base),
    { ...base, target: classValue(base.target) },
    { ...base, assessments: [classValue(base.assessments[0]!)] },
    {
      ...base,
      coverage: [
        classValue({
          actorId: 'alice',
          operationId: 'edit',
          requestHash: 'hash',
          documentVersion: 0,
          status: 'accepted',
        }),
      ],
    },
  ];
  for (const extension of [undefined, () => undefined, Symbol('extra'), 1n, NaN, Infinity, cycle]) {
    invalid.push({ ...base, extension });
    invalid.push({ ...base, target: { ...base.target, extension } });
    invalid.push({ ...base, assessments: [{ ...base.assessments[0], extension }] });
    invalid.push({
      ...base,
      coverage: [
        {
          actorId: 'alice',
          operationId: 'edit',
          requestHash: 'hash',
          documentVersion: 0,
          status: 'accepted',
          extension,
        },
      ],
    });
  }
  const codec = Schema.toCodecJson(DiagramFrameSchema);
  // Encoding must never emit an unvalidated class instance. Decoding a known
  // struct normalises its container; real RPC input has already been JSON-parsed.
  for (const input of nonJsonPrototypes)
    expect(() => Schema.encodeUnknownSync(codec)(input)).toThrow();
  for (const input of invalid) {
    expect(() => Schema.encodeUnknownSync(codec)(input)).toThrow();
    expect(() => Schema.decodeUnknownSync(codec)(input)).toThrow();
  }
});

test('typed frame JSON codec still reads legacy frames without authored assessments', () => {
  const { assessments: _assessments, ...legacy } = frame();
  const codec = Schema.toCodecJson(DiagramFrameSchema);
  expect<unknown>(Schema.encodeUnknownSync(codec)(legacy)).toEqual(legacy);
  expect<unknown>(Schema.decodeUnknownSync(codec)(legacy)).toEqual(legacy);
});
