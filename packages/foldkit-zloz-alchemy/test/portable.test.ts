import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  decodeAlchemyDescriptor,
  serializeAlchemyDescriptor,
  projectAlchemyDescriptor,
} from '../src/index';
type WireFixture = {
  version: number;
  source: { packageVersion: string; namespace: string };
  declarations: Array<{
    id: string;
    locator: string;
    kind: string;
    name: string;
    viewState?: string;
    handler?: string;
  }>;
  relations: Array<{ id: string; source: string; target: string; kind: string }>;
  graph?: unknown;
  findings?: unknown;
};
const fixture = (): WireFixture =>
  JSON.parse(readFileSync(new URL('fixtures/bank.json', import.meta.url), 'utf8'));
test('literal descriptors decode detached, round-trip canonically and recompute native projections/findings', () => {
  const raw = fixture(),
    decoded = decodeAlchemyDescriptor(raw);
  expect(decoded).not.toBe(raw);
  expect(Object.isFrozen(decoded.declarations)).toBe(true);
  expect(decodeAlchemyDescriptor(JSON.parse(serializeAlchemyDescriptor(decoded)))).toEqual(decoded);
  const plan = projectAlchemyDescriptor(raw);
  expect(plan.type).toBe('reviewable');
  assert(plan.type === 'reviewable');
  expect(plan.nativeReadModels).toHaveLength(1);
  expect(plan.nativeConsumption).toHaveLength(1);
  expect(plan.coverage).toHaveLength(23);
  expect(
    plan.graph.nodes.find((n) => n.id === 'example%2Fbank/Bank/view/AccountSummary')?.architecture,
  ).toEqual({ family: 'ddd', role: 'read-model' });
  expect(
    plan.graph.edges.find(
      (e) =>
        e.source.node === 'example%2Fbank/Bank/aggregate/Account' &&
        e.target.node === 'example%2Fbank/Bank/view/AccountSummary',
    )?.architecture,
  ).toEqual({ family: 'ddd', scope: 'tactical', role: 'feeds' });
  expect(
    plan.graph.nodes.find((n) => n.id === 'example%2Fbank/Bank/stream/Ledger')?.architecture,
  ).toBeUndefined();
  expect(plan.findings.filter((f) => f.code === 'relationship-untyped')).toHaveLength(7);

  expect(plan.findings.some((f) => f.code === 'relationship-untyped')).toBe(true);
  const first = raw.declarations[0];
  assert(first);
  first.name = 'Changed';
  expect(decoded.declarations[0]?.name).not.toBe('Changed');
  const reordered = fixture();
  reordered.declarations.reverse();
  reordered.relations.reverse();
  expect(projectAlchemyDescriptor(reordered)).toEqual(plan);
});
test('invalid versions, identities, bounds and forged fields fail before graph emission', () => {
  const cases = [
    (v: WireFixture) => {
      v.version = 2;
    },
    (v: WireFixture) => {
      v.source.packageVersion = '2.0.0-beta.86';
    },
    (v: WireFixture) => {
      v.source.namespace = '\ud800';
    },
    (v: WireFixture) => {
      const relation = v.relations.find((r) => r.kind !== 'contains');
      const model = v.declarations.find((d) => d.kind === 'model');
      assert(relation && model);
      relation.source = model.id;
      relation.id = JSON.stringify([relation.kind, relation.source, relation.target]);
    },
    (v: WireFixture) => {
      const relation = v.relations[0];
      assert(relation);
      v.relations.push(relation);
    },
    (v: WireFixture) => {
      v.relations = Array(1025).fill(v.relations[0]);
    },
    (v: WireFixture) => {
      v.graph = { nodes: [], edges: [] };
    },
    (v: WireFixture) => {
      v.findings = [];
    },
    (v: WireFixture) => {
      const d = v.declarations[0];
      assert(d);
      v.declarations.push(d);
    },
    (v: WireFixture) => {
      const d = v.declarations[0];
      assert(d);
      d.locator = 'forged';
    },
    (v: WireFixture) => {
      const r = v.relations[0];
      assert(r);
      r.target = 'missing';
    },
    (v: WireFixture) => {
      const r = v.relations[0];
      assert(r);
      r.id = 'forged';
    },
    (v: WireFixture) => {
      v.declarations = Array(257).fill(v.declarations[0]);
    },
    (v: WireFixture) => {
      const d = v.declarations.find((d) => d.kind === 'view');
      assert(d);
      d.viewState = 'verified';
    },
    (v: WireFixture) => {
      const d = v.declarations.find((d) => d.kind === 'view');
      assert(d);
      d.handler = 'run';
    },
    (v: WireFixture) => {
      v.relations = v.relations.filter((r) => r.kind !== 'contains');
    },
  ];
  for (const mutate of cases) {
    const value = fixture();
    mutate(value);
    expect(() => decodeAlchemyDescriptor(value)).toThrow();
    const result = projectAlchemyDescriptor(value);
    expect(result.type).toBe('blocked');
    expect('graph' in result).toBe(false);
  }
});
test('accessor data is rejected without evaluation; stateless claims do not become native read models', () => {
  let calls = 0;
  const value = fixture();
  Object.defineProperty(value.source, 'namespace', {
    get() {
      calls++;
      return 'wrong';
    },
    enumerable: true,
  });
  expect(projectAlchemyDescriptor(value).type).toBe('blocked');
  expect(calls).toBe(0);
  const stateless = fixture();
  const reader = stateless.declarations.find((d) => d.kind === 'view');
  assert(reader);
  reader.viewState = 'absent';
  const plan = projectAlchemyDescriptor(stateless);
  expect(plan.type).toBe('reviewable');
  if (plan.type === 'reviewable') {
    expect(plan.nativeReadModels).toHaveLength(0);
    expect(plan.nativeConsumption).toHaveLength(0);
    expect(plan.findings.some((f) => f.code === 'view-without-state')).toBe(true);
  }
});

test('array accessors, sparse arrays and non-enumerable unknown fields cannot bypass the data boundary', () => {
  let calls = 0;
  const raw = fixture();
  Object.defineProperty(raw.declarations, '0', {
    get() {
      calls++;
      return {};
    },
    enumerable: true,
  });
  expect(projectAlchemyDescriptor(raw).type).toBe('blocked');
  expect(calls).toBe(0);
  const sparse = fixture();
  delete sparse.declarations[0];
  expect(projectAlchemyDescriptor(sparse).type).toBe('blocked');
  const hidden = fixture();
  Object.defineProperty(hidden, 'trusted', { value: true });
  expect(projectAlchemyDescriptor(hidden).type).toBe('blocked');
});
