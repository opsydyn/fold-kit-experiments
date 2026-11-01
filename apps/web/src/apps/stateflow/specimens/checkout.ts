/**
 * A checkout, written for the observatory: guards that loop a state back on itself, a card
 * charge as a Command, and a Refunded state nothing leads to, left so on purpose so the
 * coverage view has an unreachable state and a dead transition to find.
 */
import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';
import { Machine } from 'foldkit/experimental';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';

import { defineSpecimen } from '../specimen';

export const CheckoutState = defineTaggedUnion({
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

export const CheckoutMessage = defineMessageUnion({
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
const ChargeCard = Command.define('ChargeCard', {
  args: { last4: Schema.String },
  messages: [CheckoutMessage.SettledCharge],
  execute: () => Effect.succeed(CheckoutMessage.SettledCharge({ approved: true })),
});

export const checkoutMachine = Machine.define({
  state: CheckoutState,
  message: CheckoutMessage,
})({
  initial: CheckoutState.Browsing(),
  states: {
    Browsing: {
      on: {
        AddedItem: Machine.to('Cart', () => ({ model: CheckoutState.Cart({ items: 1 }) })),
      },
    },
    Cart: {
      on: {
        AddedItem: Machine.to('Cart', ({ state }) => ({
          model: CheckoutState.Cart({ items: state.items + 1 }),
        })),
        RemovedItem: [
          Machine.when(
            (state) => state.items > 1,
            'Cart',
            ({ state }) => ({ model: CheckoutState.Cart({ items: state.items - 1 }) }),
          ),
          Machine.otherwise(Machine.to('Browsing', () => ({ model: CheckoutState.Browsing() }))),
        ],
        ClickedCheckout: Machine.to('Address', ({ state }) => ({
          model: CheckoutState.Address({ items: state.items }),
        })),
      },
    },
    Address: {
      on: {
        SubmittedAddress: [
          Machine.when(
            (_state, message) => message.valid,
            'Paying',
            ({ state }) => ({ model: CheckoutState.Paying({ items: state.items }) }),
          ),
          Machine.otherwise(
            Machine.to('Address', ({ state }) => ({
              model: CheckoutState.Address({ items: state.items }),
            })),
          ),
        ],
        ClickedBack: Machine.to('Cart', ({ state }) => ({
          model: CheckoutState.Cart({ items: state.items }),
        })),
      },
    },
    Paying: {
      on: {
        SubmittedCard: Machine.to('Charging', ({ state, message }) => ({
          model: CheckoutState.Charging({ items: state.items }),
          commands: [ChargeCard({ last4: message.last4 })],
        })),
      },
    },
    Charging: {
      on: {
        SettledCharge: [
          Machine.when(
            (_state, message) => message.approved,
            'Confirmed',
            ({ state }) => ({ model: CheckoutState.Confirmed({ items: state.items }) }),
          ),
          Machine.otherwise(
            Machine.to('Declined', ({ state }) => ({
              model: CheckoutState.Declined({ items: state.items }),
            })),
          ),
        ],
      },
    },
    Declined: {
      on: {
        ClickedRetry: Machine.to('Paying', ({ state }) => ({
          model: CheckoutState.Paying({ items: state.items }),
        })),
      },
    },
    Confirmed: {
      on: {
        ClickedContinue: Machine.to('Browsing', () => ({ model: CheckoutState.Browsing() })),
      },
    },
    Refunded: {
      on: {
        ClickedContinue: Machine.to('Browsing', () => ({ model: CheckoutState.Browsing() })),
      },
    },
  },
});

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
