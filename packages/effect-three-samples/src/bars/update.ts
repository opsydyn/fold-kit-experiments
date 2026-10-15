import { Match, Option } from 'effect';
import { modifyFields } from 'foldkit/struct';
import type { Return } from 'foldkit/update';

import { barOf } from './layout';
import { Message } from './message';
import {
  type Bar,
  isShown,
  type Model,
  type Order,
  sameBar,
  type Series,
  seriesList,
} from './model';

type AppReturn = Return<Model, Message>;

const keepShown = (model: Model) => (bar: Option.Option<Bar>) =>
  Option.filter(bar, (current) => isShown(model, current.series));

/** Applies a new hidden set, dropping a hover or pin on a series that is now hidden. */
const withHidden = (model: Model, hidden: ReadonlyArray<Series>): Model => {
  const next = { ...model, hidden };
  return modifyFields(next, { hovered: keepShown(next), selected: keepShown(next) });
};

const shownCount = (model: Model): number =>
  seriesList.filter((series) => isShown(model, series)).length;

/** Hides or shows one series, but never hides the last one shown. */
const toggleSeries = (model: Model, series: Series): Model =>
  Match.value({ hidden: !isShown(model, series), last: shownCount(model) === 1 }).pipe(
    Match.when({ hidden: true }, () =>
      withHidden(
        model,
        model.hidden.filter((hidden) => hidden !== series),
      ),
    ),
    Match.when({ last: true }, () => model),
    Match.orElse(() => withHidden(model, [...model.hidden, series])),
  );

/** Shows only `series`, or everything again when it is already the only one shown. */
const isolate = (model: Model, series: Series): Model => {
  const others = seriesList.filter((candidate) => candidate !== series);
  const isolated = others.every((other) => model.hidden.includes(other));
  // Already isolated: hide nothing. Otherwise hide every other series.
  return withHidden(
    model,
    others.filter(() => !isolated),
  );
};

/** Pins a bar, or unpins it when it is already pinned. */
const pin = (model: Model, bar: Bar): Model => {
  const pinned = Option.filter(model.selected, (current) => sameBar(current, bar));
  const selected = Option.match(pinned, {
    onNone: () => Option.some(bar),
    onSome: () => Option.none(),
  });
  return { ...model, selected };
};

const nextOrder = { calendar: 'total', total: 'calendar' } satisfies Record<Order, Order>;

const withBar = (key: string, model: Model, apply: (bar: Bar) => Model): AppReturn => {
  const next = Option.match(Option.fromNullishOr(barOf(key)), {
    onNone: () => model,
    onSome: apply,
  });
  return { model: next };
};

export const update = (model: Model, message: Message): AppReturn =>
  Message.match<AppReturn>(message, {
    HoveredBar: ({ key }) =>
      withBar(key, model, (bar) => modifyFields(model, { hovered: () => Option.some(bar) })),
    LeftBar: ({ key }) =>
      withBar(key, model, (bar) =>
        modifyFields(model, {
          hovered: (hovered) => Option.filter(hovered, (current) => !sameBar(current, bar)),
        }),
      ),
    ClickedBar: ({ key }) => withBar(key, model, (bar) => pin(model, bar)),
    DoubleClickedBar: ({ key }) => withBar(key, model, (bar) => isolate(model, bar.series)),
    ClickedEmptySpace: () => ({ model: modifyFields(model, { selected: () => Option.none() }) }),
    ClickedNewData: () => ({ model: modifyFields(model, { seed: (seed) => seed + 1 }) }),
    ClickedOrder: () => ({ model: modifyFields(model, { order: (order) => nextOrder[order] }) }),
    ClickedSeries: ({ series }) => ({ model: toggleSeries(model, series) }),
    ChangedTheme: ({ theme }) => ({ model: modifyFields(model, { theme: () => theme }) }),
    ReceivedSceneLifecycle: () => ({ model }),
  });
