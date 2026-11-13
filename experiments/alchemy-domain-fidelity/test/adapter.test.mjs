import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { captureEdition, compareEditions, parseGraph, serializeGraph } from '@opsydyn/foldkit-zloz';

import { projectAlchemyModel, supportedAlchemyDomainVersion } from '../dist/adapter.js';
import {
  Bank,
  BankNext,
  BankReordered,
  BankRenamed,
  DuplicateBank,
  MissingSourceBank,
  calls,
  resetCalls,
  ChainedBank,
  ChainedBankReordered,
} from '../dist/fixture.js';
import { StatelessBank, MixedBank } from './stateless-fixture.mjs';
const options = {
  namespace: 'example/bank',
  revision: 'fixture-v1',
  declaredPackageVersion: '2.0.0-beta.85',
};
const prefix = 'example%2Fbank/Bank/';
test('the read-only adapter uses native read-model/feeds contracts and preserves every other finding and source fact', () => {
  resetCalls();
  Object.freeze(Bank.definitions);
  const result = projectAlchemyModel(Bank, options);
  assert.equal(result.type, 'reviewable');
  assert.equal(supportedAlchemyDomainVersion, '2.0.0-beta.85');
  const reader = result.graph.nodes.find((n) => n.id === prefix + 'view/AccountSummary');
  assert.equal(reader.label, 'AccountSummary');
  assert.deepEqual(reader.architecture, { family: 'ddd', role: 'read-model' });
  const feed = result.graph.edges.find((e) => e.label === 'feeds');
  assert.deepEqual(feed.architecture, { family: 'ddd', scope: 'tactical', role: 'feeds' });
  const golden = JSON.parse(
    readFileSync(new URL('../fixtures/bank-graph.json', import.meta.url), 'utf8'),
  );
  golden.nodes = golden.nodes.map((n) =>
    n.id === reader.id
      ? { ...n, label: 'AccountSummary', architecture: { family: 'ddd', role: 'read-model' } }
      : n,
  );
  golden.edges = golden.edges.map((e) =>
    e.label === 'feeds'
      ? { ...e, architecture: { family: 'ddd', scope: 'tactical', role: 'feeds' } }
      : e,
  );
  assert.deepEqual(result.graph, golden);
  assert.deepEqual(result.nativeReadModels, [
    { sourceId: reader.id, basis: 'declared-state-schema' },
  ]);
  assert.deepEqual(result.nativeConsumption, [feed.id]);
  assert.equal(result.findings.filter((f) => f.code === 'role-unrepresented').length, 1);
  assert.equal(result.findings.filter((f) => f.code === 'relationship-untyped').length, 7);
  assert.ok(result.findings.some((f) => f.code === 'behaviour-unrepresented'));
  assert.equal(result.coverage.length, 23);
  for (const source of [...result.source.declarations, ...result.source.relations])
    assert.ok(result.coverage.some((c) => c.sourceId === source.id));
  assert.deepEqual(parseGraph(serializeGraph(result.graph)), result.graph);
  assert.ok(Object.isFrozen(result.graph.nodes[0]));
  assert.ok(Object.isFrozen(result.nativeReadModels[0]));
  assert.equal(calls(), 0);
});
test('unsupported versions reject before any model inspection; identity and missing-definition failures never return partial graphs', () => {
  const inaccessible = new Proxy(
    {},
    {
      get() {
        assert.fail('Version rejection inspected the model');
      },
    },
  );
  for (const version of ['', '2.0.0-beta.84', '2.0.0-beta.86']) {
    const blocked = projectAlchemyModel(inaccessible, {
      ...options,
      declaredPackageVersion: version,
    });
    assert.equal(blocked.type, 'blocked');
    assert.equal(blocked.findings[0].code, 'unsupported-version');
    assert.equal('graph' in blocked, false);
  }
  for (const [model, extra, code] of [
    [DuplicateBank, {}, 'identity-collision'],
    [MissingSourceBank, {}, 'invalid-model'],
    [Bank, { identityOverrides: { missing: 'alias' } }, 'unknown-identity-override'],
  ]) {
    const result = projectAlchemyModel(model, { ...options, ...extra });
    assert.equal(result.type, 'blocked');
    assert.equal(result.findings[0].code, code);
    assert.equal('graph' in result, false);
  }
  const failed = projectAlchemyModel(
    new Proxy(
      {},
      {
        get() {
          throw new Error('PRIVATE EXCEPTION DATA');
        },
      },
    ),
    options,
  );
  assert.equal(failed.type, 'blocked');
  assert.equal(failed.findings[0].code, 'inspection-failed');
  assert.equal(JSON.stringify(failed).includes('PRIVATE EXCEPTION DATA'), false);
});
test('stateless views remain explicitly untyped and cannot acquire native feed meaning from their name', () => {
  const result = projectAlchemyModel(StatelessBank, options);
  assert.equal(result.type, 'reviewable');
  assert.equal(result.nativeReadModels.length, 0);
  assert.equal(result.nativeConsumption.length, 0);
  assert.ok(
    result.graph.nodes.some(
      (n) => n.label === 'AccountSummary (view; untyped)' && n.architecture === undefined,
    ),
  );
  assert.ok(result.findings.some((f) => f.code === 'view-without-state'));
  assert.equal(calls(), 0);
});
test('reordering, explicit aliases and revision changes preserve identity without false semantic edition changes', () => {
  const before = projectAlchemyModel(Bank, options),
    reordered = projectAlchemyModel(BankReordered, options);
  assert.deepEqual(reordered, before);
  const after = projectAlchemyModel(BankNext, { ...options, revision: 'fixture-v2' });
  assert.equal(before.type, 'reviewable');
  assert.equal(after.type, 'reviewable');
  const delta = compareEditions(
    captureEdition({ id: 'a', name: 'Before', snapshot: { graph: before.graph } }),
    captureEdition({ id: 'b', name: 'After', snapshot: { graph: after.graph } }),
  );
  assert.deepEqual(
    delta.nodes.filter((c) => c.kind === 'added').map((c) => c.id),
    [prefix + 'command/WithdrawMoney', prefix + 'event/MoneyWithdrawn'],
  );
  assert.deepEqual(
    delta.nodes.filter((c) => c.kind === 'changed' && c.semanticChanged),
    [],
  );
  const renamed = projectAlchemyModel(BankRenamed, {
    ...options,
    identityOverrides: { [prefix + 'command/CreditMoney']: prefix + 'command/DepositMoney' },
  });
  assert.equal(renamed.type, 'reviewable');
  assert.equal(
    renamed.graph.nodes.find((n) => n.label === 'CreditMoney').id,
    prefix + 'command/DepositMoney',
  );
});

test('multiple read-model bindings and chained feeds remain deterministic under reordered declarations', () => {
  const a = projectAlchemyModel(ChainedBank, options),
    b = projectAlchemyModel(ChainedBankReordered, options);
  assert.equal(a.type, 'reviewable');
  assert.deepEqual(b, a);
  assert.equal(a.nativeReadModels.length, 2);
  assert.equal(a.nativeConsumption.length, 2);
  assert.equal(calls(), 0);
});

test('a native consumer cannot make a stateless producer into a declared consumption source', () => {
  const result = projectAlchemyModel(MixedBank, options);
  assert.equal(result.type, 'reviewable');
  assert.equal(result.nativeReadModels.length, 1);
  assert.equal(result.nativeConsumption.length, 0);
  const feed = result.graph.edges.find((edge) => edge.target.node.endsWith('/view/ReadBalance'));
  assert.ok(feed);
  assert.equal(feed.architecture, undefined);
  assert.ok(
    result.findings.some((f) => f.code === 'relationship-untyped' && f.sourceId === feed.id),
  );
  assert.equal(calls(), 0);
});
