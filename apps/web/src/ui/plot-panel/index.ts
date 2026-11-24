import { chartKeyDown } from '@opsydyn/foldkit-viz/foldkit/keyboard';
import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import type { PlotOverlay } from '@opsydyn/foldkit-viz/foldkit/plot';
import { targetAfter } from '@opsydyn/foldkit-viz/interaction/keyboard';
import type { ChartCommand } from '@opsydyn/foldkit-viz/interaction/keyboard';
import {
  compilePlot,
  invertAxis,
  plotTables,
  plotTargets,
  plotValueFormatter,
  pointerToPlot,
  rowsOf,
} from '@opsydyn/foldkit-viz/plot';
import type {
  Channel,
  Highlight,
  MarkSpec,
  PlotGeometry,
  PlotSpec,
  PlotTarget,
  Row,
  Value,
} from '@opsydyn/foldkit-viz/plot';
import { Effect, Option, Schema } from 'effect';
import { CustomElement, Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { withOutMessage } from 'foldkit/update';
import type { Return as UpdateReturn, ReturnWithOutMessage } from 'foldkit/update';

import { withAriaLive } from '../shared';

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

export function init(config: InitConfig): UpdateReturn<Model, Message> {
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

export const Message = defineMessageUnion({
  /** A pointer position in plot pixels. */
  MovedPointer: { x: Schema.Number, y: Schema.Number },
  LeftPlot: {},
  PressedPointer: { x: Schema.Number, y: Schema.Number },
  ReleasedPointer: {},
  /** A chart key's command: step, page, jump to an end, clear or select. */
  PressedKeyNav: { command: Schema.Unknown },
  HoveredTarget: { index: Schema.Number },
  BlurredTarget: {},
  ClearedBrush: {},
  /** The pointer forwarding Mount has attached its listeners. */
  CompletedForwardPointer: {},
  /** New rows for the spec, such as a filtered set of points. */
  ReplacedRows: { rows: Schema.Unknown },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  InspectedPoint: { key: Schema.String, x: Schema.Number, y: Schema.Number },
  InspectedRange: {
    domain: Schema.Tuple([Schema.Number, Schema.Number]),
    includeEnd: Schema.Boolean,
  },
  ClearedInspection: {},
  SelectedRange: { domain: Schema.Tuple([Schema.Number, Schema.Number]) },
  ClearedSelection: {},
});
export type OutMessage = typeof OutMessage.Type;

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

function compile(spec: PlotSpec, markIndex: number): Compiled {
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

type Return = ReturnWithOutMessage<Model, Message, OutMessage>;

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

function inspect(model: Model, active: Option.Option<number>): Return {
  if (Option.isSome(active) && Option.isSome(model.active) && active.value === model.active.value)
    return { model };
  const next = { ...model, active };
  const target = Option.isNone(active) ? undefined : targetsOf(model)[active.value];
  if (target === undefined)
    return Option.isNone(model.active)
      ? { model: next }
      : withOutMessage<Model, Message, OutMessage>(
          { model: { ...next, active: Option.none() } },
          OutMessage.ClearedInspection(),
        );
  if (target.isBar)
    return withOutMessage<Model, Message, OutMessage>(
      { model: next },
      OutMessage.InspectedRange({ domain: target.domain, includeEnd: target.includeEnd }),
    );
  const mark = markOf(model.spec, model.mark);
  const row = rowOf(model.spec, model.mark, target.key);
  return withOutMessage<Model, Message, OutMessage>(
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

function endBrush(model: Model): Return {
  const from = Option.getOrUndefined(model.drag);
  const band = Option.getOrUndefined(model.band);
  const settled = { ...model, drag: Option.none<number>() };
  if (from === undefined) return { model };
  const axis = compile(model.spec, model.mark).geometry.facets[0]?.x ?? null;
  if (band === undefined || axis === null || Math.abs(band[1] - band[0]) < CLICK_SLOP)
    return withOutMessage<Model, Message, OutMessage>(
      { model: { ...settled, band: Option.none() } },
      OutMessage.ClearedSelection(),
    );
  const lo = Math.min(band[0], band[1]),
    hi = Math.max(band[0], band[1]);
  const domain = [tidy(Number(invertAxis(axis, lo))), tidy(Number(invertAxis(axis, hi)))] as const;
  return withOutMessage<Model, Message, OutMessage>(
    { model: { ...settled, band: Option.some([lo, hi]) } },
    OutMessage.SelectedRange({ domain }),
  );
}

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    MovedPointer: ({ x, y }) => {
      if (Option.isSome(model.drag))
        return {
          model: { ...model, band: Option.some([model.drag.value, clampToPlot(model, x)]) },
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
      return { model: { ...model, drag: Option.some(x), band: Option.some([x, x]) } };
    },
    ReleasedPointer: () => endBrush(model),
    CompletedForwardPointer: () => ({ model }),
    PressedKeyNav: ({ command }) => {
      const count = targetsOf(model).length;
      if (count === 0) return { model };
      // SAFETY: PressedKeyNav is built only from chartKeyDown's ChartCommand, in view.
      const next = targetAfter(count, Option.getOrUndefined(model.active), command as ChartCommand);
      return inspect(model, next === undefined ? Option.none() : Option.some(next));
    },
    HoveredTarget: ({ index }) => inspect(model, Option.some(index)),
    BlurredTarget: () => inspect(model, Option.none()),
    ClearedBrush: () =>
      withOutMessage<Model, Message, OutMessage>(
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

// POINTER

/** A pointer move or press, already in plot pixels. */
const PointerFact = Schema.Struct({ x: Schema.Number, y: Schema.Number, pressed: Schema.Boolean });

const POINTER_EVENT = 'plot-panel-pointer';

/** The panel's own DOM event, so pointer facts reach the dispatcher as typed messages. */
const panelEvents = CustomElement.define({
  tag: 'foldkit-plot-panel',
  properties: {},
  events: { [POINTER_EVENT]: PointerFact },
});

/**
 * Re-dispatches pointer moves and presses on the panel as plot-pixel facts,
 * synchronously, so they enter the dispatcher in order with key presses and
 * leaves rather than through a queue that later input could overtake. The
 * drawing scales to its box, so positions convert through the rendered SVG.
 */
export const ForwardPointer = Mount.define('ForwardPlotPanelPointer', {
  args: { width: Schema.Number, height: Schema.Number },
  messages: [Message.CompletedForwardPointer],
  execute: ({ element, width, height }) => {
    const listen = Effect.sync(() => {
      const listener = (event: Event) => {
        if (!(event instanceof PointerEvent)) return;
        const drawn = element.querySelector('svg') ?? element;
        const { x, y } = pointerToPlot(
          { x: event.clientX, y: event.clientY },
          drawn.getBoundingClientRect(),
          { width, height },
        );
        const pressed = event.type === 'pointerdown';
        // Keep receiving moves while a brush drags outside the panel.
        if (pressed && element instanceof HTMLElement && event.pointerId !== undefined)
          element.setPointerCapture?.(event.pointerId);
        element.dispatchEvent(new CustomEvent(POINTER_EVENT, { detail: { x, y, pressed } }));
      };
      element.addEventListener('pointermove', listener);
      element.addEventListener('pointerdown', listener);
      return listener;
    });
    return Effect.acquireRelease(listen, (listener) =>
      Effect.sync(() => {
        element.removeEventListener('pointermove', listener);
        element.removeEventListener('pointerdown', listener);
      }),
    ).pipe(
      Effect.map(() => Message.CompletedForwardPointer()),
      Effect.withSpan('ForwardPlotPanelPointer'),
    );
  },
});

// VIEW

export type ViewConfig<M> = Readonly<{
  model: Model;
  toParentMessage: (message: Message) => M;
  ariaLabel: string;
  /** Rows of the target mark to keep bright, such as the points in a hovered bin. */
  highlight?: Highlight;
  /** Targets to emphasise by their position in x order, such as the bin holding a point. */
  emphasis?: ReadonlyArray<number>;
}>;

/** The spec with a highlight on the target mark. */
function highlighted(spec: PlotSpec, markIndex: number, highlight: Highlight): PlotSpec {
  return {
    ...spec,
    marks: spec.marks.map((mark, i) => (i === markIndex ? { ...mark, highlight } : mark)),
  };
}

/** Dim the target mark's other graphics so the emphasised ones stand out. */
function emphasise(
  geometry: PlotGeometry,
  markIndex: number,
  graphics: ReadonlySet<number>,
): PlotGeometry {
  if (graphics.size === 0) return geometry;
  return {
    ...geometry,
    facets: geometry.facets.map((facet) => ({
      ...facet,
      marks: facet.marks.map((mark) =>
        mark.index !== markIndex
          ? mark
          : {
              ...mark,
              graphics: mark.graphics.map((g, i) =>
                graphics.has(i) ? g : { ...g, opacity: g.opacity * 0.35 },
              ),
            },
      ),
    })),
  };
}

const BRUSH_COLOUR = '#f59e0b';

type Ring = Readonly<{ x: number; y: number; r: number }>;
type Band = Readonly<{ x0: number; x1: number }>;

/** The overlay for a hovered dot's ring and a brushed band, each when present. */
function overlayOf(ring: Option.Option<Ring>, brush: Option.Option<Band>): PlotOverlay {
  const color = BRUSH_COLOUR;
  if (Option.isSome(ring) && Option.isSome(brush))
    return { ring: ring.value, brush: brush.value, color };
  if (Option.isSome(ring)) return { ring: ring.value, color };
  if (Option.isSome(brush)) return { brush: brush.value, color };
  return { color };
}

export const view = <M>(config: ViewConfig<M>, h: HtmlBuilder<M>): Html => {
  const { model, toParentMessage, ariaLabel } = config;
  const panel = panelEvents.withMessage(h);
  const { targets } = compile(model.spec, model.mark);
  const spec =
    config.highlight === undefined
      ? model.spec
      : highlighted(model.spec, model.mark, config.highlight);
  const base = compile(spec, model.mark).geometry;
  const active = Option.flatMap(model.active, (i): Option.Option<Target> => {
    const target = targets[i];
    return target === undefined ? Option.none() : Option.some(target);
  });
  const emphasised = new Set<number>([
    ...(config.emphasis ?? []).flatMap((i) => {
      const t = targets[i];
      return t === undefined ? [] : [t.graphic];
    }),
    // A hovered bar stands out by dimming the rest; a hovered dot has its ring instead,
    // so the parent's linked highlights stay as they are.
    ...Option.match(active, { onNone: () => [], onSome: (t) => (t.isBar ? [t.graphic] : []) }),
  ]);
  const geometry = emphasise(base, model.mark, emphasised);
  const ring = Option.flatMap(active, (t) =>
    t.isBar ? Option.none() : Option.some({ x: t.cx, y: t.cy, r: 7 }),
  );
  const brush = Option.map(model.band, ([x0, x1]) => ({ x0, x1 }));
  const chart = plotChart(h, geometry, {
    overlay: overlayOf(ring, brush),
    summary: true,
    tables: plotTables(spec, base),
  });
  const formatX = spec.x?.format === undefined ? String : plotValueFormatter(spec.x.format);
  const liveText = Option.match(active, {
    onNone: () => '',
    onSome: (t) =>
      t.isBar ? `${formatX(t.domain[0])} to ${formatX(t.domain[1])}, ${t.title}` : t.title,
  });
  const handleKeyDown = chartKeyDown((command) =>
    toParentMessage(Message.PressedKeyNav({ command })),
  );
  return h.div(
    [
      h.Class('plot-panel'),
      h.Role('application'),
      h.AriaLabel(ariaLabel),
      h.Attribute('aria-roledescription', 'interactive chart'),
      h.Tabindex(0),
      h.OnKeyDownPreventDefault(handleKeyDown),
      h.Style({ cursor: model.brush ? 'crosshair' : 'pointer', 'touch-action': 'none' }),
      h.OnMount(
        Mount.mapMessage(
          ForwardPointer({ width: geometry.width, height: geometry.height }),
          toParentMessage,
        ),
      ),
      panel.OnPlotPanelPointer(({ x, y, pressed }) =>
        toParentMessage(
          pressed ? Message.PressedPointer({ x, y }) : Message.MovedPointer({ x, y }),
        ),
      ),
      h.OnPointerLeave(() => Option.some(toParentMessage(Message.LeftPlot()))),
      h.OnPointerUp(() => Option.some(toParentMessage(Message.ReleasedPointer()))),
    ],
    [withAriaLive(h, chart, liveText)],
  );
};
