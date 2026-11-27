import { plotTables, plotValueFormatter } from '@opsydyn/foldkit-viz/plot';
import type { Highlight, PlotGeometry, PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Option } from 'effect';

import { compile, type Message, type Model, type Target } from './core';

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
function overlayOf(ring: Option.Option<Ring>, brush: Option.Option<Band>) {
  const color = BRUSH_COLOUR;
  if (Option.isSome(ring) && Option.isSome(brush))
    return { ring: ring.value, brush: brush.value, color };
  if (Option.isSome(ring)) return { ring: ring.value, color };
  if (Option.isSome(brush)) return { brush: brush.value, color };
  return { color };
}

export function presentationOf(
  config: Pick<ViewConfig<never>, 'model' | 'highlight' | 'emphasis'>,
) {
  const { model } = config;
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
  const options = {
    overlay: overlayOf(ring, brush),
    summary: true,
    tables: plotTables(spec, base),
  };
  const formatX = spec.x?.format === undefined ? String : plotValueFormatter(spec.x.format);
  const liveText = Option.match(active, {
    onNone: () => '',
    onSome: (t) =>
      t.isBar ? `${formatX(t.domain[0])} to ${formatX(t.domain[1])}, ${t.title}` : t.title,
  });
  return { geometry, options, liveText };
}
