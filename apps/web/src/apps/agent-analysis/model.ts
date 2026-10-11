import { Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import { Filter, RunRequest, Scenario, Wire } from './contract';
import type { Service } from './contract';

export const Session = defineTaggedUnion({
  Idle: {},
  Connecting: { request: RunRequest },
  AwaitingSnapshot: { request: RunRequest },
  Streaming: { request: RunRequest },
  Completed: { runId: Schema.String },
  Cancelled: { runId: Schema.String, cause: Schema.Literals(['User', 'RouteExit']) },
  Failed: {
    runId: Schema.String,
    failure: defineTaggedUnion({
      Protocol: { reason: Schema.String },
      Transport: { reason: Schema.String },
    }),
  },
});
export type Session = typeof Session.Type;

export const Model = Schema.Struct({
  session: Session,
  wire: Schema.NullOr(Wire),
  filter: Filter,
  selectedId: Schema.NullOr(Schema.String),
  generation: Schema.Number,
  accepted: Schema.Number,
  activity: Schema.Array(Schema.String),
  scenario: Scenario,
});
export type Model = typeof Model.Type;

export const initModel: Model = {
  session: Session.Idle(),
  wire: null,
  filter: 'All',
  selectedId: null,
  generation: 0,
  accepted: 0,
  activity: [],
  scenario: 'normal',
};

export const activeRun = (model: Model): RunRequest | null =>
  Session.match(model.session, {
    Idle: () => null,
    Connecting: ({ request }) => request,
    AwaitingSnapshot: ({ request }) => request,
    Streaming: ({ request }) => request,
    Completed: () => null,
    Cancelled: () => null,
    Failed: () => null,
  });

export const visibleServices = (model: Model): ReadonlyArray<Service> =>
  (model.wire?.services ?? []).filter(
    ({ series }) => model.filter === 'All' || series === model.filter,
  );
