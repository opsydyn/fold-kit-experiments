import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import * as Domain from '@alchemy.run/domain';
import {
  parseGraph,
  serializeGraph,
  createEditor,
  captureEdition,
  compareEditions,
} from '@opsydyn/foldkit-zloz';

import {
  Bank,
  BankNext,
  BankReordered,
  BankRenamed,
  DuplicateBank,
  MissingSourceBank,
  calls,
  resetCalls,
} from '../dist/fixture.js';
import { extractDeclarations, mapDeclarations, sourceId, SpikeError } from '../dist/index.js';
const options = { namespace: 'example/bank', revision: 'fixture-v1' };
const fixture = (name) =>
  JSON.parse(readFileSync(new URL('../fixtures/' + name, import.meta.url), 'utf8'));
test('actual pinned declarations produce the independently specified manifest and canonical graph without executing handlers', () => {
  resetCalls();
  assert.deepEqual(Domain.verify(Bank), []);
  Object.freeze(Bank.definitions);
  for (const aggregate of Bank.definitions.aggregates) {
    Object.freeze(aggregate.definition);
    Object.freeze(aggregate.definition.commands);
  }

  const source = extractDeclarations(Bank, options),
    result = mapDeclarations(source);
  assert.deepEqual(source, fixture('bank-source.json'));
  assert.deepEqual(result.graph, fixture('bank-graph.json'));
  assert.equal(result.type, 'mapped');
  assert.deepEqual(parseGraph(serializeGraph(result.graph)), result.graph);
  assert.equal(calls(), 0);
  assert.ok(Object.isFrozen(source));
  assert.ok(Object.isFrozen(source.declarations));
  assert.ok(Object.isFrozen(result.graph.nodes[0]));
  assert.equal(
    source.declarations.some((d) => 'handler' in d || 'state' in d || 'payload' in d),
    false,
  );
});
test('reordering and shared event declarations preserve identities and canonical output', () => {
  assert.deepEqual(extractDeclarations(BankReordered, options), extractDeclarations(Bank, options));
  const source = extractDeclarations(Bank, options);
  assert.equal(
    source.declarations.filter((d) => d.kind === 'event' && d.name === 'MoneyDeposited').length,
    1,
  );
});
test('known edition change is visible, while namespaces, renames and explicit aliases retain honest identity', () => {
  const before = extractDeclarations(Bank, options),
    after = extractDeclarations(BankNext, { ...options, revision: 'fixture-v2' });
  const beforeIds = new Set(before.declarations.map((d) => d.id));
  assert.deepEqual(
    after.declarations.filter((d) => !beforeIds.has(d.id)).map((d) => [d.kind, d.name]),
    [
      ['command', 'WithdrawMoney'],
      ['event', 'MoneyWithdrawn'],
    ],
  );
  assert.ok(
    after.relations.some(
      (r) =>
        r.kind === 'handles' &&
        r.target === sourceId(options.namespace, 'Bank', 'command', 'WithdrawMoney'),
    ),
  );
  const renamed = extractDeclarations(BankRenamed, options);
  assert.equal(
    renamed.declarations.some(
      (d) => d.id === sourceId(options.namespace, 'Bank', 'command', 'DepositMoney'),
    ),
    false,
  );
  const aliased = extractDeclarations(BankRenamed, {
    ...options,
    identityOverrides: {
      [sourceId(options.namespace, 'Bank', 'command', 'CreditMoney')]: sourceId(
        options.namespace,
        'Bank',
        'command',
        'DepositMoney',
      ),
    },
  });
  assert.equal(
    aliased.declarations.find((d) => d.name === 'CreditMoney').id,
    sourceId(options.namespace, 'Bank', 'command', 'DepositMoney'),
  );
  assert.notDeepEqual(
    extractDeclarations(Bank, { ...options, namespace: 'other' }).declarations.map((d) => d.id),
    before.declarations.map((d) => d.id),
  );
  const a = mapDeclarations(before),
    b = mapDeclarations(after);
  assert.equal(a.type, 'mapped');
  assert.equal(b.type, 'mapped');
  const delta = compareEditions(
    captureEdition({ id: 'before', name: 'Before', snapshot: { graph: a.graph } }),
    captureEdition({ id: 'after', name: 'After', snapshot: { graph: b.graph } }),
  );
  assert.deepEqual(
    delta.nodes.filter((change) => change.kind === 'added').map((change) => change.id),
    [
      sourceId(options.namespace, 'Bank', 'command', 'WithdrawMoney'),
      sourceId(options.namespace, 'Bank', 'event', 'MoneyWithdrawn'),
    ],
  );
  assert.deepEqual(
    delta.nodes
      .filter((change) => change.kind === 'changed' && change.semanticChanged)
      .map((change) => change.id),
    [],
  );
  assert.equal(createEditor(a.graph).past.length, 0);
});
test('duplicate identities, alias collisions, unknown aliases and source limits reject without mutating declarations', () => {
  const source = extractDeclarations(Bank, options);
  assert.throws(
    () => extractDeclarations(DuplicateBank, options),
    (e) => e instanceof SpikeError && e.code === 'identity-collision',
  );
  const command = sourceId(options.namespace, 'Bank', 'command', 'DepositMoney'),
    event = sourceId(options.namespace, 'Bank', 'event', 'MoneyDeposited');
  assert.throws(
    () => extractDeclarations(Bank, { ...options, identityOverrides: { [event]: command } }),
    (e) => e.code === 'identity-collision',
  );
  assert.throws(
    () => extractDeclarations(Bank, { ...options, identityOverrides: { missing: 'old' } }),
    (e) => e.code === 'unknown-identity-override',
  );
  assert.throws(
    () => extractDeclarations(Bank, { ...options, maxDeclarations: 2 }),
    (e) => e.code === 'declaration-limit',
  );
  assert.throws(
    () => extractDeclarations(Bank, { ...options, maxRelations: 1 }),
    (e) => e.code === 'relation-limit',
  );
  assert.throws(
    () => extractDeclarations(Bank, { ...options, namespace: '' }),
    (e) => e.code === 'invalid-input',
  );
  assert.throws(
    () => extractDeclarations(Bank, { ...options, maxDeclarations: Infinity }),
    (e) => e.code === 'invalid-input',
  );
  assert.deepEqual(extractDeclarations(Bank, options), source);
});
test('unknown vocabulary is retained explicitly and missing references block all graph output', () => {
  const source = extractDeclarations(Bank, options),
    mapped = mapDeclarations(source);
  assert.equal(mapped.type, 'mapped');
  assert.equal(
    mapped.graph.nodes.find((n) => n.label === 'AccountSummary (view; untyped)').architecture,
    undefined,
  );
  assert.ok(
    mapped.findings.some(
      (f) =>
        f.code === 'role-unrepresented' &&
        f.sourceId === sourceId(options.namespace, 'Bank', 'view', 'AccountSummary'),
    ),
  );
  assert.ok(
    mapped.findings.some(
      (f) =>
        f.code === 'role-unrepresented' &&
        f.sourceId === sourceId(options.namespace, 'Bank', 'stream', 'Ledger'),
    ),
  );
  assert.equal(mapped.findings.filter((f) => f.code === 'role-unrepresented').length, 2);
  assert.equal(mapped.findings.filter((f) => f.code === 'relationship-untyped').length, 8);
  for (const edge of mapped.graph.edges) {
    const a = mapped.graph.nodes.find((n) => n.id === edge.source.node),
      b = mapped.graph.nodes.find((n) => n.id === edge.target.node);
    assert.ok(a?.ports.some((p) => p.id === edge.source.port && p.kind === 'output'));
    assert.ok(b?.ports.some((p) => p.id === edge.target.port && p.kind === 'input'));
    assert.equal(edge.architecture, undefined);
  }
  for (const d of source.declarations) assert.ok(mapped.graph.nodes.some((n) => n.id === d.id));
  for (const r of source.relations) assert.ok(mapped.coverage.some((c) => c.sourceId === r.id));
  const missing = mapDeclarations(extractDeclarations(MissingSourceBank, options));
  assert.equal(missing.type, 'blocked');
  assert.equal('graph' in missing, false);
  assert.ok(missing.findings.some((f) => f.code === 'missing-declaration'));
  assert.equal(calls(), 0);
});
