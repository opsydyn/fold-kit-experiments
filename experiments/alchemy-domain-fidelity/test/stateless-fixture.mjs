import assert from 'node:assert/strict';

// Actual JavaScript Domain declarations qualify the runtime rejection separately
// from the retained upstream strict-optional TypeScript failure for this form.
import * as Domain from '@alchemy.run/domain';

import { Account, MoneyDeposited } from '../dist/fixture.js';
class StatelessSummary extends Domain.View('AccountSummary', {
  from: [Account],
  key: Account,
  events: [MoneyDeposited],
  emit: { MoneyDeposited: () => assert.fail('Stateless emit handler executed') },
}) {}
export const StatelessBank = Domain.Model('Bank', {
  aggregates: [Account],
  views: [StatelessSummary],
});

import { Schema } from 'effect';
class ReadBalance extends Domain.View('ReadBalance', {
  from: [StatelessSummary],
  key: Account,
  state: Schema.Number,
  initial: 0,
  evolve: { MoneyDeposited: () => assert.fail('ReadBalance handler executed') },
}) {}
export const MixedBank = Domain.Model('Bank', {
  aggregates: [Account],
  views: [StatelessSummary, ReadBalance],
});
