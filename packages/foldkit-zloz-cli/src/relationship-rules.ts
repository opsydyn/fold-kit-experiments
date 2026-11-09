import { auditEventStormingRelationships, isEdgeArchitecture } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';

import { readJsonInput } from './io';
import { CliInputError } from './protocol';
const Role = Schema.Literals(['actor', 'command', 'aggregate', 'domain-event', 'policy']);
const Rule = Schema.Struct({
  architecture: Schema.declare(isEdgeArchitecture),
  sources: Schema.Array(Role),
  targets: Schema.Array(Role),
  label: Schema.String,
});
const File = Schema.Struct({ version: Schema.Literal(1), rules: Schema.Array(Rule) });
const invalid = (input: string, message: string) =>
  new CliInputError({ code: 'invalid-rules', message, dimension: 'semantics', subject: input });
const FilePath = Schema.declare(
  (value): value is string => typeof value === 'string' && value.length > 0 && value !== '-',
);
/** Data-only configuration; callbacks and unknown fields are not accepted or executed. */
export function readRelationshipRules(input: string) {
  const reading = Effect.gen(function* () {
    const readingPath = Schema.decodeUnknownEffect(FilePath)(input).pipe(
      Effect.mapError(() =>
        invalid(input, 'Rules must be a JSON file; stdin is reserved for model input.'),
      ),
    );
    const file = yield* readingPath;
    const { value } = yield* readJsonInput(file);
    const decoding = Schema.decodeUnknownEffect(File, { onExcessProperty: 'error' })(value).pipe(
      Effect.mapError(() =>
        invalid(
          input,
          'Rules must contain version 1 and a data-only catalogue of valid relationship rules.',
        ),
      ),
    );
    const decoded = yield* decoding;
    return yield* Effect.try({
      try: () => {
        const options = { rules: decoded.rules };
        auditEventStormingRelationships({ nodes: [], edges: [] }, options);
        return options;
      },
      catch: (cause) => invalid(input, String(cause)),
    });
  });
  return reading.pipe(Effect.withSpan('zloz.cli.readRelationshipRules'));
}
