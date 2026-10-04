import { Schema } from 'effect';

import { ExplorerState } from '../request-diagnostics/model';
import { TransitionRecorded } from './ports';
import type { TransitionRecorded as TransitionRecordedValue } from './ports';

export type TransitionFact = TransitionRecordedValue;

export type Model = Readonly<{
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
