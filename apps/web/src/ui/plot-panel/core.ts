import { PlotSpecSchema } from '@opsydyn/foldkit-viz/effect/plot';
import { targetAfter } from '@opsydyn/foldkit-viz/interaction/keyboard';
import { compilePlot, invertAxis, plotTargets, rowsOf } from '@opsydyn/foldkit-viz/plot';
import type {
  Channel,
  MarkSpec,
  PlotGeometry,
  PlotSpec,
  PlotTarget,
  Row,
  Value,
} from '@opsydyn/foldkit-viz/plot';
import { Data, Option, Schema } from 'effect';

/**
 * An interactive chart child over any plot spec. One mark is the target of the
 * pointer and the keyboard: hovering a dot reports the point, hovering a bar or
 * bin reports its range, and dragging across a continuous x axis selects a
 * range. The parent owns everything linked, and passes highlights back as view
 * props.
 */

// MODEL

export type InitConfig = Readonly<{
  spec: PlotSpec;
  /** The index of the mark the pointer and keyboard target. Default 0. */
  mark?: number;
  /** Let the pointer select a range on a continuous x axis. Default false. */
  brush?: boolean;
}>;

export type Model = Readonly<{
  spec: PlotSpec;
  mark: number;
  brush: boolean;
  /** The active target, by its position in x order. */
  active: Option.Option<number>;
  /** Where a brush drag began, in plot pixels. */
  drag: Option.Option<number>;
  /** The brushed band in plot pixels, drawn during and after a drag. */
  band: Option.Option<readonly [number, number]>;
}>;

/** The panel state that can cross an Astro hydration boundary. */
export const PortableModel = Schema.Struct({
  spec: Schema.declare<PlotSpec>(Schema.is(PlotSpecSchema)),
  mark: Schema.Number,
  brush: Schema.Boolean,
  active: Schema.Option(Schema.Number),
  drag: Schema.Option(Schema.Number),
  band: Schema.Option(Schema.Tuple([Schema.Number, Schema.Number])),
});

interface Initial {
  readonly model: Model;
}

export function init(config: InitConfig): Initial {
  return {
    model: {
      spec: config.spec,
      mark: config.mark ?? 0,
      brush: config.brush ?? false,
      active: Option.none(),
      drag: Option.none(),
      band: Option.none(),
    },
  };
}

// MESSAGE

const ChartCommand = Schema.TaggedUnion({
  Step: { by: Schema.Number },
  Jump: { to: Schema.Literals(['first', 'last']) },
  Clear: {},
  Select: {},
});

export const MessageFields = {
  /** A pointer position in plot pixels. */
  MovedPointer: { x: Schema.Number, y: Schema.Number },
  LeftPlot: {},
  PressedPointer: { x: Schema.Number, y: Schema.Number },
  ReleasedPointer: {},
  /** A chart key's command: step, page, jump to an end, clear or select. */
  PressedKeyNav: { command: ChartCommand },
  HoveredTarget: { index: Schema.Number },
  BlurredTarget: {},
  ClearedBrush: {},
  /** The pointer forwarding Mount has attached its listeners. */
  CompletedForwardPointer: {},
  /** New rows for the spec, such as a filtered set of points. */
  ReplacedRows: { rows: Schema.Unknown },
};
const MessageSchema = Schema.TaggedUnion(MessageFields);
export type Message = typeof MessageSchema.Type;
const messageCases = Data.taggedEnum<Message>();
export const Message = Object.assign(MessageSchema, {
  MovedPointer: messageCases.MovedPointer,
  LeftPlot: messageCases.LeftPlot,
  PressedPointer: messageCases.PressedPointer,
  ReleasedPointer: messageCases.ReleasedPointer,
  PressedKeyNav: messageCases.PressedKeyNav,
  HoveredTarget: messageCases.HoveredTarget,
  BlurredTarget: messageCases.BlurredTarget,
  ClearedBrush: messageCases.ClearedBrush,
  CompletedForwardPointer: messageCases.CompletedForwardPointer,
  ReplacedRows: messageCases.ReplacedRows,
});

export const OutMessageFields = {
  InspectedPoint: { key: Schema.String, x: Schema.Number, y: Schema.Number },
  InspectedRange: {
    domain: Schema.Tuple([Schema.Number, Schema.Number]),
    includeEnd: Schema.Boolean,
  },
  ClearedInspection: {},
  SelectedRange: { domain: Schema.Tuple([Schema.Number, Schema.Number]) },
  ClearedSelection: {},
};
const OutMessageSchema = Schema.TaggedUnion(OutMessageFields);
export type OutMessage = typeof OutMessageSchema.Type;
const outMessageCases = Data.taggedEnum<OutMessage>();
export const OutMessage = Object.assign(OutMessageSchema, {
  InspectedPoint: outMessageCases.InspectedPoint,
  InspectedRange: outMessageCases.InspectedRange,
  ClearedInspection: outMessageCases.ClearedInspection,
  SelectedRange: outMessageCases.SelectedRange,
  ClearedSelection: outMessageCases.ClearedSelection,
});

// TARGETS

export type Target = PlotTarget;

type Compiled = Readonly<{ geometry: PlotGeometry; targets: ReadonlyArray<Target> }>;

const compiledSpecs = new WeakMap<
  PlotSpec,
  {
    geometry: PlotGeometry;
    targetsByMark: Map<number, ReadonlyArray<Target>>;
  }
>();

/** Ten significant figures, so bin edges inverted from pixels read as their values. */
const tidy = (n: number): number => Number(n.toPrecision(10));

const markOf = (spec: PlotSpec, index: number): MarkSpec | undefined => spec.marks[index];

export function compile(spec: PlotSpec, markIndex: number): Compiled {
  const cached = compiledSpecs.get(spec) ?? {
    geometry: compilePlot(spec),
    targetsByMark: new Map(),
  };
  compiledSpecs.set(spec, cached);
  const mark = markOf(spec, markIndex);
  const options =
    mark?.mark === 'rect'
      ? {
          mark: markIndex,
          inset: mark.inset ?? 0,
          finalIntervalClosed: mark.transform !== undefined,
        }
      : { mark: markIndex };
  const targets = cached.targetsByMark.get(markIndex) ?? plotTargets(cached.geometry, options);
  cached.targetsByMark.set(markIndex, targets);
  return { geometry: cached.geometry, targets };
}

/** The interactive targets, in x order, with their data ranges. */
export const targetsOf = (model: Model): ReadonlyArray<Target> =>
  compile(model.spec, model.mark).targets;

/** The rows a mark draws, its own or the plot's, as row objects. */
const markRows = (spec: PlotSpec, mark: MarkSpec | undefined): ReadonlyArray<Row> =>
  rowsOf(mark?.data ?? spec.data ?? []);

/** A field-name channel, as opposed to a constant. */
const isFieldName = (channel: Channel | undefined): channel is string =>
  typeof channel === 'string';

const fieldValue = (row: Row | undefined, channel: Channel | undefined): number => {
  if (row === undefined || !isFieldName(channel)) return Number.NaN;
  const value: Value | undefined = row[channel];
  return Number(value ?? Number.NaN);
};

/** The row a dot was drawn from: by its key field, or by its position. */
function rowOf(spec: PlotSpec, markIndex: number, key: string): Row | undefined {
  const mark = markOf(spec, markIndex);
  const rows = markRows(spec, mark);
  const keyField = mark?.key;
  if (keyField !== undefined) return rows.find((row) => String(row[keyField]) === key);
  const position = Number(key.split(':')[1]);
  return Number.isInteger(position) ? rows[position] : undefined;
}

// UPDATE

export type Transition = Readonly<{ model: Model; outMessage?: OutMessage }>;

function withOutMessage({ model }: Pick<Transition, 'model'>, outMessage: OutMessage): Transition {
  return { model, outMessage };
}

/** Within this many pixels a dot is under the pointer. */
const HOVER_RADIUS = 16;
/** A drag shorter than this is a click, which clears the selection. */
const CLICK_SLOP = 3;

const plotOf = (model: Model) => compile(model.spec, model.mark).geometry.facets[0]?.plot;

/** The target under a plot pixel: the bar spanning its x, or the nearest dot. */
function targetAt(model: Model, x: number, y: number): Option.Option<number> {
  const { targets } = compile(model.spec, model.mark);
  const bar = targets.findIndex((t) => t.isBar && x >= t.left && x <= t.right);
  if (bar >= 0) return Option.some(bar);
  let best = -1,
    bestDistance = HOVER_RADIUS;
  targets.forEach((t, i) => {
    if (t.isBar) return;
    const distance = Math.hypot(t.cx - x, t.cy - y);
    if (distance <= bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best < 0 ? Option.none() : Option.some(best);
}

function inspect(model: Model, active: Option.Option<number>): Transition {
  if (Option.isSome(active) && Option.isSome(model.active) && active.value === model.active.value)
    return { model };
  const next = { ...model, active };
  const target = Option.isNone(active) ? undefined : targetsOf(model)[active.value];
  if (target === undefined)
    return Option.isNone(model.active)
      ? { model: next }
      : withOutMessage(
          { model: { ...next, active: Option.none() } },
          OutMessage.ClearedInspection(),
        );
  if (target.isBar)
    return withOutMessage(
      { model: next },
      OutMessage.InspectedRange({ domain: target.domain, includeEnd: target.includeEnd }),
    );
  const mark = markOf(model.spec, model.mark);
  const row = rowOf(model.spec, model.mark, target.key);
  return withOutMessage(
    { model: next },
    OutMessage.InspectedPoint({
      key: target.key,
      x: fieldValue(row, mark !== undefined && 'x' in mark ? mark.x : undefined),
      y: fieldValue(row, mark !== undefined && 'y' in mark ? mark.y : undefined),
    }),
  );
}

const clampToPlot = (model: Model, x: number): number => {
  const plot = plotOf(model);
  return plot === undefined ? x : Math.min(plot.right, Math.max(plot.left, x));
};

function endBrush(model: Model): Transition {
  const from = Option.getOrUndefined(model.drag);
  const band = Option.getOrUndefined(model.band);
  const settled = { ...model, drag: Option.none<number>() };
  if (from === undefined) return { model };
  const axis = compile(model.spec, model.mark).geometry.facets[0]?.x ?? null;
  if (band === undefined || axis === null || Math.abs(band[1] - band[0]) < CLICK_SLOP)
    return withOutMessage(
      { model: { ...settled, band: Option.none() } },
      OutMessage.ClearedSelection(),
    );
  const lo = Math.min(band[0], band[1]),
    hi = Math.max(band[0], band[1]);
  const domain = [tidy(Number(invertAxis(axis, lo))), tidy(Number(invertAxis(axis, hi)))] as const;
  return withOutMessage(
    { model: { ...settled, band: Option.some([lo, hi]) } },
    OutMessage.SelectedRange({ domain }),
  );
}

export const update = (model: Model, message: Message): Transition =>
  Message.match(message, {
    MovedPointer: ({ x, y }) => {
      if (Option.isSome(model.drag))
        return {
          model: {
            ...model,
            band: Option.some([model.drag.value, clampToPlot(model, x)] as const),
          },
        };
      return inspect(model, targetAt(model, x, y));
    },
    LeftPlot: () => (Option.isSome(model.drag) ? { model } : inspect(model, Option.none())),
    PressedPointer: ({ x, y }) => {
      const plot = plotOf(model);
      const inside =
        plot !== undefined &&
        x >= plot.left &&
        x <= plot.right &&
        y >= plot.top &&
        y <= plot.bottom;
      if (!model.brush || !inside) return { model };
      return { model: { ...model, drag: Option.some(x), band: Option.some([x, x] as const) } };
    },
    ReleasedPointer: () => endBrush(model),
    CompletedForwardPointer: () => ({ model }),
    PressedKeyNav: ({ command }) => {
      const count = targetsOf(model).length;
      if (count === 0) return { model };
      const next = targetAfter(count, Option.getOrUndefined(model.active), command);
      return inspect(model, next === undefined ? Option.none() : Option.some(next));
    },
    HoveredTarget: ({ index }) => inspect(model, Option.some(index)),
    BlurredTarget: () => inspect(model, Option.none()),
    ClearedBrush: () =>
      withOutMessage(
        { model: { ...model, drag: Option.none(), band: Option.none() } },
        OutMessage.ClearedSelection(),
      ),
    ReplacedRows: ({ rows }) => ({
      model: {
        ...model,
        // SAFETY: ReplacedRows carries rows for this panel's spec, from its parent.
        spec: { ...model.spec, data: rows as ReadonlyArray<Row> },
        active: Option.none(),
      },
    }),
  });
