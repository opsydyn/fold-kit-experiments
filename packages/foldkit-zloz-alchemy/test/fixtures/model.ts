import * as Domain from '@alchemy.run/domain';
import { Schema } from 'effect';

import { AlchemyAdapterError } from '../../src/descriptor';
// oxlint-disable-next-line foldkit/no-module-level-mutable-state -- Test-only counter proves the synthetic business handlers were never invoked; it is not application state.
let invoked = 0;
export const calls = () => invoked;
export const resetCalls = () => {
  invoked = 0;
};
const unexpected = (): never => {
  invoked++;
  throw new AlchemyAdapterError({
    path: '/fixture',
    code: 'handler-executed',
    reason: 'The declaration spike executed a business handler.',
  });
};
export class MoneyDeposited extends Domain.Event('MoneyDeposited', { amount: Schema.Number }) {}
export class MoneyWithdrawn extends Domain.Event('MoneyWithdrawn', { amount: Schema.Number }) {}
export class DepositMoney extends Domain.Command('DepositMoney', {
  target: Schema.String,
  input: { amount: Schema.Number },
  events: [MoneyDeposited],
}) {}
export class GrantBonus extends Domain.Command('GrantBonus', {
  target: Schema.String,
  input: {},
  events: [MoneyDeposited],
}) {}
export class CreditMoney extends Domain.Command('CreditMoney', {
  target: Schema.String,
  input: { amount: Schema.Number },
  events: [MoneyDeposited],
}) {}
export class WithdrawMoney extends Domain.Command('WithdrawMoney', {
  target: Schema.String,
  input: { amount: Schema.Number },
  events: [MoneyWithdrawn],
}) {}
export class Account extends Domain.Aggregate('Account', {
  read: {},
  id: Schema.String,
  state: Schema.Struct({ balance: Schema.Number }),
  initial: { balance: 0 },
  commands: [DepositMoney, GrantBonus],
  decide: { DepositMoney: unexpected, GrantBonus: unexpected },
  evolve: { MoneyDeposited: unexpected },
}) {}
export class AccountNext extends Domain.Aggregate('Account', {
  read: {},
  id: Schema.String,
  state: Schema.Struct({ balance: Schema.Number }),
  initial: { balance: 0 },
  commands: [DepositMoney, GrantBonus, WithdrawMoney],
  decide: { DepositMoney: unexpected, GrantBonus: unexpected, WithdrawMoney: unexpected },
  evolve: { MoneyDeposited: unexpected, MoneyWithdrawn: unexpected },
}) {}
export class AccountReordered extends Domain.Aggregate('Account', {
  read: {},
  id: Schema.String,
  state: Schema.Struct({ balance: Schema.Number }),
  initial: { balance: 0 },
  commands: [GrantBonus, DepositMoney],
  decide: { GrantBonus: unexpected, DepositMoney: unexpected },
  evolve: { MoneyDeposited: unexpected },
}) {}
export class AccountRenamed extends Domain.Aggregate('Account', {
  read: {},
  id: Schema.String,
  state: Schema.Struct({ balance: Schema.Number }),
  initial: { balance: 0 },
  commands: [CreditMoney, GrantBonus],
  decide: { CreditMoney: unexpected, GrantBonus: unexpected },
  evolve: { MoneyDeposited: unexpected },
}) {}
function members(
  account: typeof Account | typeof AccountNext | typeof AccountReordered | typeof AccountRenamed,
) {
  class AccountSummary extends Domain.View('AccountSummary', {
    from: [account],
    key: account,
    state: Schema.Struct({ balance: Schema.Number }),
    initial: { balance: 0 },
    evolve: { MoneyDeposited: unexpected },
  }) {}
  class Notify extends Domain.Policy('Notify', { from: account, on: [MoneyDeposited] }) {}
  class Ledger extends Domain.Stream('Ledger', { key: account, entries: [MoneyDeposited] }) {}
  return {
    aggregates: [account],
    views: [AccountSummary] as const,
    policies: [Notify],
    streams: [Ledger],
  };
}
export const Bank: Domain.Model.Any = Domain.Model('Bank', members(Account));
export const BankNext: Domain.Model.Any = Domain.Model('Bank', members(AccountNext));
export const BankReordered: Domain.Model.Any = Domain.Model('Bank', members(AccountReordered));
export const BankRenamed: Domain.Model.Any = Domain.Model('Bank', members(AccountRenamed));
export const DuplicateBank: Domain.Model.Any = Domain.Model('Bank', {
  aggregates: [Account, AccountNext],
});
const missingMembers = members(Account);
export const MissingSourceBank: Domain.Model.Any = Domain.Model('Bank', {
  ...missingMembers,
  aggregates: [],
});

const chainMembers = members(Account);
const summary = chainMembers.views[0];
if (!summary)
  throw new AlchemyAdapterError({
    path: '/fixture',
    code: 'invalid-fixture',
    reason: 'Missing summary fixture.',
  });
class Totals extends Domain.View('Totals', {
  from: [summary],
  key: Account,
  state: Schema.Number,
  initial: 0,
}) {}
export const ChainedBank: Domain.Model.Any = Domain.Model('Bank', {
  aggregates: [Account],
  views: [summary, Totals],
});
export const ChainedBankReordered: Domain.Model.Any = Domain.Model('Bank', {
  aggregates: [Account],
  views: [Totals, summary],
});
