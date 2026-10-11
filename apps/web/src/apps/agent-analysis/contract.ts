import { Schema } from 'effect';

const NonBlank = Schema.String.check(
  Schema.makeFilter((value) => value.trim().length > 0, { message: 'Must not be blank' }),
);
const Measurement = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));

export const Service = Schema.Struct({
  id: NonBlank,
  name: NonBlank,
  series: Schema.Literals(['Core', 'Platform']),
  volume: Measurement,
  latency: Measurement,
});
export type Service = typeof Service.Type;

export const Wire = Schema.Struct({ services: Schema.Array(Service) }).check(
  Schema.makeFilter(
    ({ services }) => new Set(services.map(({ id }) => id)).size === services.length,
    {
      message: 'Service IDs must be unique',
    },
  ),
);
export type Wire = typeof Wire.Type;

export const Scenario = Schema.Literals(['normal', 'invalid', 'slow']);
export type Scenario = typeof Scenario.Type;
export const Filter = Schema.Literals(['All', 'Core', 'Platform']);
export type Filter = typeof Filter.Type;
export const RunRequest = Schema.Struct({ runId: Schema.String, scenario: Scenario });
export type RunRequest = typeof RunRequest.Type;

export const NavigationValue = Schema.Struct({
  phase: Schema.Literals(['coldLoad', 'entered', 'exited', 'stayed']),
  path: Schema.String,
  previousPath: Schema.NullOr(Schema.String),
});
export type NavigationValue = typeof NavigationValue.Type;

// Fixed SDK thread identity required by the demo contract, not a lifecycle status.
// oxlint-disable-next-line linteffect/no-string-sentinel-const
export const THREAD_ID = 'agent-analysis';
