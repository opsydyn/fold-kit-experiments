import { Option, Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';

import { SourceSnapshot, validSourceSnapshot } from './quality';

const EventStyle = Schema.Struct({
  stroke: Schema.optional(Schema.String),
  fill: Schema.optional(Schema.String),
  dashPattern: Schema.optional(Schema.String),
  symbol: Schema.optional(
    Schema.Literals(['circle', 'cross', 'diamond', 'square', 'star', 'triangle', 'wye']),
  ),
});
export const SignalEvent = Schema.Struct({
  id: Schema.String,
  time: Schema.Number,
  label: Schema.String,
  kind: Schema.String,
  description: Schema.NullOr(Schema.String),
  sourceRef: Schema.NullOr(Schema.String),
  style: EventStyle,
});
export type SignalEvent = typeof SignalEvent.Type;
export const EventDataset = Schema.Struct({
  records: Schema.Array(SignalEvent),
  snapshot: SourceSnapshot,
});
export type EventDataset = typeof EventDataset.Type;
export const EventInspection = defineTaggedUnion({ None: {}, Selected: { key: Schema.String } });
export type EventInspection = typeof EventInspection.Type;
export const EventFeed = defineTaggedUnion({
  NotSupplied: {},
  Invalid: { error: Schema.String },
  Ready: {
    records: Schema.Array(SignalEvent),
    snapshot: SourceSnapshot,
    inspection: EventInspection,
  },
});
export type EventFeed = typeof EventFeed.Type;
const nonempty = (text: string): boolean => text.trim().length > 0;
const invalid = (): EventFeed =>
  EventFeed.Invalid({
    error:
      'Provide unique event IDs, exact recorded UTC times, non-empty metadata, valid styles and independent source metadata.',
  });
/** Optional context is decoded independently of observation validity. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- This is the schema-decoding boundary for optional untrusted event data.
export function normaliseEventFeed(input: unknown): EventFeed {
  if (input === undefined) return EventFeed.NotSupplied();
  return Option.match(Schema.decodeUnknownOption(EventDataset)(input), {
    onNone: invalid,
    onSome: ({ records, snapshot }) => {
      if (!validSourceSnapshot(snapshot)) return invalid();
      const ids = new Set<string>();
      for (const event of records) {
        if (
          !nonempty(event.id) ||
          ids.has(event.id) ||
          !nonempty(event.label) ||
          !nonempty(event.kind) ||
          !Number.isSafeInteger(event.time) ||
          Math.abs(event.time) > 8.64e15 ||
          event.time > snapshot.asOf ||
          (event.description !== null && !nonempty(event.description)) ||
          (event.sourceRef !== null && !nonempty(event.sourceRef))
        )
          return invalid();
        ids.add(event.id);
      }
      return EventFeed.Ready({
        records: records
          .map((event) => ({ ...event, style: { ...event.style } }))
          .sort((a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        snapshot: { ...snapshot },
        inspection: EventInspection.None(),
      });
    },
  });
}
