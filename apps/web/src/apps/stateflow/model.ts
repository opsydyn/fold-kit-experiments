import { HighlightedSource, Highlighting, SourceKey } from '@opsydyn/dataset-explorer/highlighting';
import { Schema } from 'effect';

import { ExplorerState } from '../request-diagnostics/model';
import { TransitionRecorded } from './ports';
import type { TransitionRecorded as TransitionRecordedValue } from './ports';

export type TransitionFact = TransitionRecordedValue;

export type Model = Readonly<{
  highlighting?: 'ready' | 'failed';
  highlightedSource?: import('@opsydyn/dataset-explorer/highlighting').HighlightedSource;
  requestedSource?: import('@opsydyn/dataset-explorer/highlighting').SourceKey;
  explorer: ExplorerState;
  playback: 'paused' | 'playing';
  reducedMotion: boolean;
  replayIndex: number;
  replayElapsedMs: number;
  trace: ReadonlyArray<TransitionFact>;
  selectedSequence: number | null;
  selectedNode: string | null;
  selectedEdge: string | null;
  lastTelemetrySequence: number | null;
}>;

export const Model = Schema.Struct({
  highlighting: Highlighting,
  highlightedSource: Schema.optional(HighlightedSource),
  requestedSource: Schema.optional(SourceKey),
  explorer: ExplorerState,
  playback: Schema.Literals(['paused', 'playing']),
  reducedMotion: Schema.Boolean,
  replayIndex: Schema.Number,
  replayElapsedMs: Schema.Number,
  trace: Schema.Array(TransitionRecorded),
  selectedSequence: Schema.NullOr(Schema.Number),
  selectedNode: Schema.NullOr(Schema.String),
  selectedEdge: Schema.NullOr(Schema.String),
  lastTelemetrySequence: Schema.NullOr(Schema.Number),
});

export const initModel: Model = {
  explorer: ExplorerState.Loading(),
  playback: 'paused',
  reducedMotion: false,
  replayIndex: 0,
  replayElapsedMs: 0,
  trace: [],
  selectedSequence: null,
  selectedNode: null,
  selectedEdge: null,
  lastTelemetrySequence: null,
};
