import { Option, Schema } from 'effect';

/** The three series, back row to front row. */
export const Series = Schema.Literals(['search', 'social', 'direct']);
export type Series = typeof Series.Type;
export const seriesList: ReadonlyArray<Series> = Series.literals;

export const seriesLabel = {
  search: 'Search',
  social: 'Social',
  direct: 'Direct',
} satisfies Record<Series, string>;

export const Month = Schema.Literals(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
export type Month = typeof Month.Type;
export const months: ReadonlyArray<Month> = Month.literals;

/** The page theme, so series colours match the validated step for its surface. */
export const Theme = Schema.Literals(['light', 'dark']);
export type Theme = typeof Theme.Type;

/** Months in calendar order, or by the total of the visible series, largest first. */
export const Order = Schema.Literals(['calendar', 'total']);
export type Order = typeof Order.Type;

export const Bar = Schema.Struct({ month: Month, series: Series });
export type Bar = typeof Bar.Type;

export const Model = Schema.Struct({
  /** Seeds the sample data; "New data" moves to the next seed. */
  seed: Schema.Int,
  hidden: Schema.Array(Series),
  order: Order,
  hovered: Schema.Option(Bar),
  /** Pinned by a click, cleared by a click on empty space. */
  selected: Schema.Option(Bar),
  theme: Theme,
});
export type Model = typeof Model.Type;

export const init = () => ({
  model: {
    seed: 1,
    hidden: [],
    order: 'calendar',
    hovered: Option.none(),
    selected: Option.none(),
    theme: 'light',
  } satisfies Model,
});

export const isShown = (model: Model, series: Series): boolean => !model.hidden.includes(series);

export const sameBar = (a: Bar, b: Bar): boolean => a.month === b.month && a.series === b.series;
