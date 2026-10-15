/**
 * Property-testing harness over `effect/Arbitrary` (ADR-004). Properties are written in
 * assertion style (`expect`), and a failing assertion falsifies the property. Failures
 * report the shrunk input and a replay token: pass it back as `replay` to reproduce.
 */
import { Arbitrary, Data, Effect, Option } from 'effect';

import { holds, raise } from './support/holds.ts';

export class PropertyAssertionFailed extends Data.TaggedError('PropertyAssertionFailed')<{
  readonly cause: unknown;
}> {}

export class PropertyFalsified extends Data.TaggedError('PropertyFalsified')<{
  readonly report: string;
}> {}

export type PropertyOptions = {
  readonly runs?: number;
  readonly seed?: string | number;
  readonly replay?: string;
};

const defaultRuns = 200;

const evaluate =
  <A>(property: (value: A) => void) =>
  (value: A) =>
    Effect.try({
      try: () => holds(property, value),
      catch: (cause) => new PropertyAssertionFailed({ cause }),
    });

const reportOf = <A, E>(result: Arbitrary.CheckResult<A, E>) =>
  Option.fromNullishOr(Arbitrary.formatCheckFailure(result));

/** Checks `property` against values from `arbitrary`; rejects with the shrunk counterexample. */
export const assertProperty = async <A>(
  arbitrary: Arbitrary.Arbitrary<A>,
  property: (value: A) => void,
  options: PropertyOptions = {},
): Promise<void> => {
  const check = Arbitrary.checkEffect(arbitrary, evaluate(property), {
    runs: options.runs ?? defaultRuns,
    seed: options.seed,
    replay: options.replay,
  });
  Option.match(reportOf(await Effect.runPromise(check)), {
    onNone: () => undefined,
    onSome: (report) => raise(new PropertyFalsified({ report })),
  });
};
