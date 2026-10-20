/**
 * A game as a record (ADR-011, on the timeline of ADR-014): every throw and rebuild at the
 * step it landed, how far the game ran, and the world's checksum at its last checks. It
 * travels in the page's address, `#replay=…`, decoded and checked before use; replaying
 * runs the same throws at the same steps, and compares the world with the record.
 */
import { Option, Schema } from 'effect';

import type { Model } from './model';
import { Play } from './wire';

export const Record = Schema.Struct({
  inputs: Schema.Array(Schema.Struct({ step: Schema.Int, input: Play })),
  /** The last step the record covers: a check step the world reached. */
  until: Schema.Int,
  checks: Schema.Array(Schema.Struct({ step: Schema.Int, checksum: Schema.String })),
});
export type Record = typeof Record.Type;

const prefix = '#replay=';

const RecordText = Schema.fromJsonString(Record);
const encodeRecord = Schema.encodeSync(RecordText);
const decodeRecord = Schema.decodeUnknownOption(RecordText);

/** Base64 for an address: `-` and `_` for `+` and `/`, no padding. */
const toAddress = (text: string): string =>
  btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

const fromAddress = (text: string): Option.Option<string> =>
  /^[\w-]*$/.test(text)
    ? Option.liftThrowable(atob)(text.replaceAll('-', '+').replaceAll('_', '/'))
    : Option.none();

/** The game so far as a record, once the world has reached a check; none before. */
export const recordOf = (model: Model): Option.Option<Record> =>
  Option.map(Option.fromNullishOr(model.checksums.at(-1)), ({ step: until }) => ({
    inputs: model.timeline.inputs.filter((scheduled) => scheduled.step <= until),
    until,
    checks: model.checksums.filter((check) => check.step <= until),
  }));

/** A record as an address fragment. */
export const fragmentOf = (record: Record): string => prefix + toAddress(encodeRecord(record));

/** A fragment back into a record, or nothing if it is not a well-formed one. */
export const recordIn = (fragment: string): Option.Option<Record> =>
  fragment.startsWith(prefix)
    ? Option.flatMap(fromAddress(fragment.slice(prefix.length)), decodeRecord)
    : Option.none();
