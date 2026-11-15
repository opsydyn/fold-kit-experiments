import { auditDddRelationships, isDddEdgeArchitecture } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';

import { readJsonInput } from './io';
import { CliInputError } from './protocol';

const Role = Schema.Literals([
  'entity',
  'value-object',
  'aggregate-root',
  'aggregate',
  'domain-event',
  'domain-service',
  'repository',
  'read-model',
  'bounded-context',
]);
const Rule = Schema.Struct({
  architecture: Schema.declare(isDddEdgeArchitecture),
  sources: Schema.Array(Role),
  targets: Schema.Array(Role),
  label: Schema.String,
  direction: Schema.Literals(['directed', 'symmetric']),
});
const File = Schema.Struct({ version: Schema.Literal(1), rules: Schema.Array(Rule) });
const FilePath = Schema.declare(
  (value): value is string => typeof value === 'string' && value.length > 0 && value !== '-',
);
const invalid = (input: string, message: string) =>
  new CliInputError({ code: 'invalid-rules', message, dimension: 'semantics', subject: input });
/** ADR 0079: bounded data-only transport; all DDD convention meaning remains in core. */
export function readDddRelationshipRules(input: string) {
  const reading = Effect.gen(function* () {
    const readingPath = Schema.decodeUnknownEffect(FilePath)(input).pipe(
      Effect.mapError(() =>
        invalid(input, 'DDD rules must be a JSON file; stdin is reserved for model input.'),
      ),
    );
    const file = yield* readingPath;
    const { value } = yield* readJsonInput(file);
    const decoding = Schema.decodeUnknownEffect(File, { onExcessProperty: 'error' })(value).pipe(
      Effect.mapError(() =>
        invalid(
          input,
          'DDD rules must contain version 1 and a data-only catalogue of DDD descriptors, participant roles, labels and directions.',
        ),
      ),
    );
    const decoded = yield* decoding;
    return yield* Effect.try({
      try: () => {
        const options = { rules: decoded.rules };
        auditDddRelationships({ nodes: [], edges: [] }, options);
        return options;
      },
      catch: (cause) => invalid(input, String(cause)),
    });
  });
  return reading.pipe(Effect.withSpan('zloz.cli.readDddRelationshipRules'));
}
