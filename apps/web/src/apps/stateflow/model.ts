import { HighlightedSource, Highlighting, SourceKey } from '@opsydyn/dataset-explorer/highlighting';
import { Schema } from 'effect';

import type { TransitionRecorded as TransitionRecordedValue } from './ports';
import { defaultSpecimen } from './specimens';

export type TransitionFact = TransitionRecordedValue;

/**
 * Where the events came from: the specimen's sample, a recording (live or through the
 * inbound Port), or a shared link. A received event starts a fresh recording over a sample
 * or a link, and extends one already running.
 */
export const EventSource = Schema.Literals(['sample', 'recording', 'link']);
export type EventSource = typeof EventSource.Type;

export const LayoutChoice = Schema.Literals(['layered', 'force']);

export type Model = Readonly<{
  highlighting?: 'ready' | 'failed';
  highlightedSource?: import('@opsydyn/dataset-explorer/highlighting').HighlightedSource;
  requestedSource?: import('@opsydyn/dataset-explorer/highlighting').SourceKey;
  /** The machine being watched. */
  specimen: string;
  /** Its events, each encoded as JSON by the machine's own Message schema. */
  events: ReadonlyArray<string>;
  source: EventSource;
  /** How many events have been replayed: the scrubber's place, 0 before the first. */
  cursor: number;
  playback: 'paused' | 'playing';
  reducedMotion: boolean;
  replayElapsedMs: number;
  selectedSequence: number | null;
  selectedNode: string | null;
  selectedEdge: string | null;
  lastTelemetrySequence: number | null;
  /** Whether the page listens for apps reporting their machine's messages. */
  live: boolean;
  /** A phone-width page: the graph's ranks run down instead of across. */
  narrow: boolean;
  layout: 'layered' | 'force';
  /** What became of the last copy, said once. */
  notice: string | null;
}>;

export const Model = Schema.Struct({
  highlighting: Highlighting,
  highlightedSource: Schema.optional(HighlightedSource),
  requestedSource: Schema.optional(SourceKey),
  specimen: Schema.String,
  events: Schema.Array(Schema.String),
  source: EventSource,
  cursor: Schema.Number,
  playback: Schema.Literals(['paused', 'playing']),
  reducedMotion: Schema.Boolean,
  replayElapsedMs: Schema.Number,
  selectedSequence: Schema.NullOr(Schema.Number),
  selectedNode: Schema.NullOr(Schema.String),
  selectedEdge: Schema.NullOr(Schema.String),
  lastTelemetrySequence: Schema.NullOr(Schema.Number),
  live: Schema.Boolean,
  narrow: Schema.Boolean,
  layout: LayoutChoice,
  notice: Schema.NullOr(Schema.String),
});

export const initModel: Model = {
  specimen: defaultSpecimen.id,
  events: defaultSpecimen.sample,
  source: 'sample',
  cursor: 0,
  playback: 'paused',
  reducedMotion: false,
  replayElapsedMs: 0,
  selectedSequence: null,
  selectedNode: null,
  selectedEdge: null,
  lastTelemetrySequence: null,
  live: false,
  narrow: false,
  layout: 'layered',
  notice: null,
};
