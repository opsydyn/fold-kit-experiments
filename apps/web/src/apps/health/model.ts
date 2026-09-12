import { Optic, Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

export const HealthData = Schema.Struct({
  status: Schema.String,
  uptimeSeconds: Schema.Number,
  startedAt: Schema.String,
  timestamp: Schema.String,
});
export type HealthData = typeof HealthData.Type;

export const Model = defineTaggedUnion({
  Loading: {},
  Failed: { error: Schema.String },
  Loaded: {
    data: HealthData,
    elapsedMs: Schema.Number,
    sinceLabel: Schema.String,
  },
});
export type Model = typeof Model.Type;
export type Loaded = typeof Model.Loaded.Type;

export const init: Model = Model.Loading();

export const _elapsedMs = Optic.id<Loaded>().key('elapsedMs');
