import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { captureEdition, compareEditions } from '@opsydyn/foldkit-zloz';

import { inspectAlchemyModel, projectAlchemyModel } from '../src/domain';
import { projectAlchemyDescriptor, serializeAlchemyDescriptor } from '../src/index';
import {
  Bank,
  BankNext,
  BankReordered,
  BankRenamed,
  DuplicateBank,
  MissingSourceBank,
  ChainedBank,
  ChainedBankReordered,
  calls,
  resetCalls,
} from './fixtures/model';
const options = {
  namespace: 'example/bank',
  revision: 'fixture-v1',
  declaredPackageVersion: '2.0.0-beta.85',
};
test('SDK inspection emits the literal portable descriptor and produces the same native projection through either entry', () => {
  resetCalls();
  Object.freeze(Bank.definitions);
  const inspected = inspectAlchemyModel(Bank, options);
  assert(inspected.type === 'inspected');
  expect(inspected.descriptor).toEqual(
    JSON.parse(readFileSync(new URL('fixtures/bank.json', import.meta.url), 'utf8')),
  );
  expect(projectAlchemyModel(Bank, options)).toEqual(
    projectAlchemyDescriptor(JSON.parse(serializeAlchemyDescriptor(inspected.descriptor))),
  );
  expect(calls()).toBe(0);
});
test('version checks precede inspection; collisions, aliases and missing sources cannot publish partial data', () => {
  const inaccessible = new Proxy(Bank, {
    get() {
      assert.fail('Unsupported version inspected source');
    },
  });
  const blocked = inspectAlchemyModel(inaccessible, {
    ...options,
    declaredPackageVersion: 'wrong',
  });
  expect(blocked.type).toBe('blocked');
  expect('descriptor' in blocked).toBe(false);
  for (const [model, extra] of [
    [DuplicateBank, {}],
    [MissingSourceBank, {}],
    [Bank, { identityOverrides: { missing: 'alias' } }],
  ] as const) {
    const result = inspectAlchemyModel(model, { ...options, ...extra });
    expect(result.type).toBe('blocked');
    expect('descriptor' in result).toBe(false);
  }
  const failed = projectAlchemyModel(
    new Proxy(Bank, {
      get() {
        throw new Error('PRIVATE DETAIL');
      },
    }),
    options,
  );
  expect(failed.type).toBe('blocked');
  expect(JSON.stringify(failed)).not.toContain('PRIVATE DETAIL');
});
test('reorder, chains and revision comparisons retain identity and keep source revision out of node meaning', () => {
  expect(projectAlchemyModel(BankReordered, options)).toEqual(projectAlchemyModel(Bank, options));
  const chain = projectAlchemyModel(ChainedBank, options);
  assert(chain.type === 'reviewable');
  expect(chain.nativeConsumption).toHaveLength(2);
  expect(projectAlchemyModel(ChainedBankReordered, options)).toEqual(chain);
  const a = projectAlchemyModel(Bank, options),
    b = projectAlchemyModel(BankNext, { ...options, revision: 'next' });
  assert(a.type === 'reviewable' && b.type === 'reviewable');
  const delta = compareEditions(
    captureEdition({ id: 'a', name: 'Before', snapshot: { graph: a.graph } }),
    captureEdition({ id: 'b', name: 'After', snapshot: { graph: b.graph } }),
  );
  expect(delta.nodes.filter((n) => n.kind === 'added').map((n) => n.id)).toEqual([
    'example%2Fbank/Bank/command/WithdrawMoney',
    'example%2Fbank/Bank/event/MoneyWithdrawn',
  ]);
  expect(delta.nodes.filter((n) => n.kind === 'changed' && n.semanticChanged)).toEqual([]);
  const renamed = projectAlchemyModel(BankRenamed, {
    ...options,
    identityOverrides: {
      'example%2Fbank/Bank/command/CreditMoney': 'example%2Fbank/Bank/command/DepositMoney',
    },
  });
  assert(renamed.type === 'reviewable');
  expect(renamed.graph.nodes.find((n) => n.label === 'CreditMoney')?.id).toBe(
    'example%2Fbank/Bank/command/DepositMoney',
  );
  expect(calls()).toBe(0);
});
