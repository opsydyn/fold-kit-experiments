import { Command, UiSchema } from '@effect/ui';
/**
 * A checkout, written for the observatory: guards that loop a state back on itself, a card
 * charge as a Command, and a Refunded state nothing leads to, left so on purpose so the
 * coverage view has an unreachable state and a dead transition to find.
 */
import { Effect, Schema } from 'effect';

import { defineReplayMachine, edgeFor, type EdgeGuard } from '../machine-contract';
import { defineSpecimen } from '../specimen';

export const CheckoutState = UiSchema.TaggedEnum({
  Browsing: {},
  Cart: { items: Schema.Number },
  Address: { items: Schema.Number },
  Paying: { items: Schema.Number },
  Charging: { items: Schema.Number },
  Confirmed: { items: Schema.Number },
  Declined: { items: Schema.Number },
  Refunded: {},
});
export type CheckoutState = typeof CheckoutState.Type;

export const CheckoutMessage = UiSchema.TaggedEnum({
  AddedItem: {},
  RemovedItem: {},
  ClickedCheckout: {},
  ClickedBack: {},
  SubmittedAddress: { valid: Schema.Boolean },
  SubmittedCard: { last4: Schema.String },
  SettledCharge: { approved: Schema.Boolean },
  ClickedRetry: {},
  ClickedContinue: {},
});
export type CheckoutMessage = typeof CheckoutMessage.Type;

/** Charges the card. The observatory never runs it: replay only records that it was asked. */
const ChargeCard = Command.make('ChargeCard', { args: { last4: Schema.String } }, () =>
  Effect.succeed(CheckoutMessage.SettledCharge({ approved: true })),
);

type Charge = ReturnType<typeof ChargeCard.make>;
const edge = edgeFor<CheckoutState, CheckoutMessage, Charge>();
const guarded: EdgeGuard = { _tag: 'When', position: 0 };
const fallback: EdgeGuard = { _tag: 'Otherwise', position: 1 };

export const checkoutMachine = defineReplayMachine<CheckoutState, CheckoutMessage, Charge>(
  CheckoutState.Browsing(),
  ['Browsing', 'Cart', 'Address', 'Paying', 'Charging', 'Confirmed', 'Declined', 'Refunded'],
  [
    edge('Browsing', 'AddedItem', 'Cart', () => ({ state: CheckoutState.Cart({ items: 1 }) })),
    edge('Cart', 'AddedItem', 'Cart', ({ items }) => ({
      state: CheckoutState.Cart({ items: items + 1 }),
    })),
    edge(
      'Cart',
      'RemovedItem',
      'Cart',
      ({ items }) => (items > 1 ? { state: CheckoutState.Cart({ items: items - 1 }) } : undefined),
      guarded,
    ),
    edge('Cart', 'RemovedItem', 'Browsing', () => ({ state: CheckoutState.Browsing() }), fallback),
    edge('Cart', 'ClickedCheckout', 'Address', ({ items }) => ({
      state: CheckoutState.Address({ items }),
    })),
    edge(
      'Address',
      'SubmittedAddress',
      'Paying',
      ({ items }, { valid }) => (valid ? { state: CheckoutState.Paying({ items }) } : undefined),
      guarded,
    ),
    edge(
      'Address',
      'SubmittedAddress',
      'Address',
      ({ items }) => ({ state: CheckoutState.Address({ items }) }),
      fallback,
    ),
    edge('Address', 'ClickedBack', 'Cart', ({ items }) => ({
      state: CheckoutState.Cart({ items }),
    })),
    edge('Paying', 'SubmittedCard', 'Charging', ({ items }, { last4 }) => ({
      state: CheckoutState.Charging({ items }),
      commands: [ChargeCard.make({ last4 })],
    })),
    edge(
      'Charging',
      'SettledCharge',
      'Confirmed',
      ({ items }, { approved }) =>
        approved ? { state: CheckoutState.Confirmed({ items }) } : undefined,
      guarded,
    ),
    edge(
      'Charging',
      'SettledCharge',
      'Declined',
      ({ items }) => ({ state: CheckoutState.Declined({ items }) }),
      fallback,
    ),
    edge('Declined', 'ClickedRetry', 'Paying', ({ items }) => ({
      state: CheckoutState.Paying({ items }),
    })),
    edge('Confirmed', 'ClickedContinue', 'Browsing', () => ({ state: CheckoutState.Browsing() })),
    edge('Refunded', 'ClickedContinue', 'Browsing', () => ({ state: CheckoutState.Browsing() })),
  ],
);

/** The messages the coverage search combines, named as a test would name them. */
export const checkoutExamples = {
  added: CheckoutMessage.AddedItem(),
  removed: CheckoutMessage.RemovedItem(),
  checkout: CheckoutMessage.ClickedCheckout(),
  back: CheckoutMessage.ClickedBack(),
  goodAddress: CheckoutMessage.SubmittedAddress({ valid: true }),
  badAddress: CheckoutMessage.SubmittedAddress({ valid: false }),
  card: CheckoutMessage.SubmittedCard({ last4: '4242' }),
  approved: CheckoutMessage.SettledCharge({ approved: true }),
  declined: CheckoutMessage.SettledCharge({ approved: false }),
  retry: CheckoutMessage.ClickedRetry(),
  continued: CheckoutMessage.ClickedContinue(),
} as const;

export const checkoutSpecimen = defineSpecimen({
  id: 'checkout',
  label: 'Checkout',
  summary: 'A cart to a charged card, with guards that loop back and a state nothing reaches.',
  machineName: 'checkoutMachine',
  examplesName: 'checkoutExamples',
  machine: checkoutMachine,
  message: CheckoutMessage,
  errorStates: ['Declined'],
  transientStates: ['Charging'],
  examples: checkoutExamples,
  sample: [
    CheckoutMessage.AddedItem(),
    CheckoutMessage.AddedItem(),
    CheckoutMessage.RemovedItem(),
    CheckoutMessage.ClickedCheckout(),
    CheckoutMessage.SubmittedAddress({ valid: false }),
    CheckoutMessage.SubmittedAddress({ valid: true }),
    CheckoutMessage.SubmittedCard({ last4: '0002' }),
    CheckoutMessage.SettledCharge({ approved: false }),
    CheckoutMessage.ClickedRetry(),
    CheckoutMessage.SubmittedCard({ last4: '4242' }),
    CheckoutMessage.ClickedBack(),
    CheckoutMessage.SettledCharge({ approved: true }),
    CheckoutMessage.ClickedContinue(),
  ],
});
