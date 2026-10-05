import { Option, Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';
import type { Return } from 'foldkit/update';

import { Props, SignalRecord, SourceSnapshot, SignalThreshold, validSignalProps } from './quality';
export { Props } from './quality';
export type { Props as SignalProps } from './quality';
import { Baseline } from './baseline';
import { EventFeed, normaliseEventFeed } from './events';
import type { Message } from './message';
export const ChartRole = Schema.Literals(['overview', 'latency', 'errors']);
export type ChartRole = typeof ChartRole.Type;
const Domain = Schema.Tuple([Schema.Number, Schema.Number]);
const Selection = defineTaggedUnion({
  None: {},
  Interval: { axis: Schema.Literals(['x', 'y']), domain: Domain },
  Keys: { keys: Schema.Array(Schema.String) },
});
export const Inspection = defineTaggedUnion({
  Following: { key: Schema.NullOr(Schema.String) },
  Pinned: { key: Schema.String },
});
const active = {
  pointerId: Schema.Number,
  role: ChartRole,
  anchorX: Schema.Number,
  anchorTime: Schema.Number,
  startViewport: Domain,
  startSelection: Selection,
  currentTime: Schema.Number,
};
export const Gesture = defineTaggedUnion({ Idle: {}, Brushing: active, Panning: active });
const Status = Schema.Literals(['Ready', 'Unavailable']);
export const Model = defineTaggedUnion({
  Empty: { records: Schema.Array(SignalRecord) },
  Invalid: { error: Schema.String },
  Ready: {
    records: Schema.Array(SignalRecord),
    snapshot: SourceSnapshot,
    baseline: Baseline,
    events: EventFeed,
    maxGapMs: Schema.Number,
    thresholds: Schema.Array(SignalThreshold),
    scenarioAsOf: Schema.Struct({ Fresh: Schema.Number, Stale: Schema.Number }),
    bounds: Domain,
    viewport: Domain,
    selection: Selection,
    inspection: Inspection,
    gesture: Gesture,
    widths: Schema.Struct({
      overview: Schema.Number,
      latency: Schema.Number,
      errors: Schema.Number,
    }),
    inputStatus: Schema.Struct({ overview: Status, latency: Status, errors: Status }),
  },
});
export type Model = typeof Model.Type;
export type ReadyModel = Extract<Model, { _tag: 'Ready' }>;
export const init = (props: Props): Return<Model, Message> =>
  Option.match(Schema.decodeUnknownOption(Props)(props), {
    onNone: () => ({ model: Model.Invalid({ error: 'Provide a valid observation array.' }) }),
    onSome: (props) => {
      const { data } = props;
      if (!validSignalProps(props))
        return {
          model: Model.Invalid({
            error:
              'Provide unique IDs/times, valid quality readings, intervals, source metadata and references.',
          }),
        };
      if (data.length === 0) return { model: Model.Empty({ records: [] }) };
      const records = [...data].sort(
        (a, b) => a.time - b.time || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      );
      const first = records[0],
        last = records.at(-1);
      if (!first || !last) return { model: Model.Empty({ records: [] }) };
      const padding = Math.max(0, (1000 - (last.time - first.time)) / 2);
      const bounds: readonly [number, number] = [first.time - padding, last.time + padding];
      if (
        !Number.isFinite(bounds[1] - bounds[0]) ||
        bounds[1] - bounds[0] < 1000 ||
        Math.abs(bounds[0]) > 8.64e15 ||
        Math.abs(bounds[1]) > 8.64e15
      )
        return {
          model: Model.Invalid({
            error: 'Time extent cannot support a representable UTC viewport.',
          }),
        };
      return {
        model: Model.Ready({
          records,
          snapshot: props.snapshot,
          baseline: Baseline.None(),
          events: normaliseEventFeed(props.events),
          maxGapMs: props.maxGapMs,
          thresholds: props.thresholds,
          scenarioAsOf: props.scenarioAsOf,
          bounds,
          viewport: bounds,
          selection: Selection.None(),
          inspection: Inspection.Following({ key: null }),
          gesture: Gesture.Idle(),
          widths: { overview: 700, latency: 700, errors: 700 },
          inputStatus: { overview: 'Unavailable', latency: 'Unavailable', errors: 'Unavailable' },
        }),
      };
    },
  });
