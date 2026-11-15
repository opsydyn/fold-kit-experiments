import { Match, Option, Predicate } from 'effect';
import { foldChildAt } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import type { Inspection } from '../../ui/shared/inspection';
import { Message } from './message';
import { Linking } from './model';
import type { Model, Panel } from './model';

type ChartUpdaters = Readonly<{
  scatter: typeof PlotPanel.update;
  histogram: typeof PlotPanel.update;
}>;
type ComparisonFolds = Readonly<{
  scatter: (model: Model, id: number, message: PlotPanel.Message) => Return<Model, Message>;
  histogram: (model: Model, id: number, message: PlotPanel.Message) => Return<Model, Message>;
}>;

/** Out-messages a panel kind does not link, such as a scatter's ranges, change nothing. */
const unchanged: Step<Model, Message> = (model) => ({ model });

const inspected =
  (sourceId: number, value: Inspection): Step<Model, Message> =>
  (model) =>
    Linking.match(model.linking, {
      Independent: () => ({ model }),
      Linked: () => ({
        model: {
          ...model,
          linking: Linking.Linked({ inspection: Option.some({ sourceId, value }) }),
        },
      }),
    });

export function clearInspection(model: Model, sourceId: number): Return<Model, Message> {
  const inspection = Linking.match(model.linking, {
    Independent: () => Option.none(),
    Linked: ({ inspection }) => inspection,
  });
  return Option.match(
    Option.filter(inspection, (current) => current.sourceId === sourceId),
    {
      onNone: () => ({ model }),
      onSome: () => ({
        model: { ...model, linking: Linking.Linked({ inspection: Option.none() }) },
      }),
    },
  );
}

function writeScatter(panel: Panel, id: number, chart: PlotPanel.Model): Panel {
  return Match.value(panel).pipe(
    Match.when({ _tag: 'Scatter', id }, (current) => ({ ...current, chart })),
    Match.orElse((current) => current),
  );
}

function writeHistogram(panel: Panel, id: number, chart: PlotPanel.Model): Panel {
  return Match.value(panel).pipe(
    Match.when({ _tag: 'Histogram', id }, (current) => ({ ...current, chart })),
    Match.orElse((current) => current),
  );
}

export function comparisonFolds(updaters: ChartUpdaters): ComparisonFolds {
  const scatter = foldChildAt({
    update: updaters.scatter,
    readAt: (model: Model, id: number) =>
      Option.map(
        Option.filter(
          Option.fromNullishOr(model.panels.find((panel) => panel.id === id)),
          (panel): panel is Extract<Panel, { _tag: 'Scatter' }> =>
            Predicate.isTagged(panel, 'Scatter'),
        ),
        (panel) => panel.chart,
      ),
    writeAt: (model: Model, id: number, chart: PlotPanel.Model): Model => ({
      ...model,
      panels: model.panels.map((panel) => writeScatter(panel, id, chart)),
    }),
    toParentMessage: (id: number, message: PlotPanel.Message) =>
      Message.GotScatterMessage({ id, message }),
    foldOutMessage: (id: number) => (event: PlotPanel.OutMessage) =>
      PlotPanel.OutMessage.match<Step<Model, Message>>(event, {
        InspectedPoint: ({ key }) => inspected(id, { _tag: 'Point', key }),
        InspectedRange: () => unchanged,
        ClearedInspection: () => (model) => clearInspection(model, id),
        SelectedRange: () => unchanged,
        ClearedSelection: () => unchanged,
      }),
  });
  const histogram = foldChildAt({
    update: updaters.histogram,
    readAt: (model: Model, id: number) =>
      Option.map(
        Option.filter(
          Option.fromNullishOr(model.panels.find((panel) => panel.id === id)),
          (panel): panel is Extract<Panel, { _tag: 'Histogram' }> =>
            Predicate.isTagged(panel, 'Histogram'),
        ),
        (panel) => panel.chart,
      ),
    writeAt: (model: Model, id: number, chart: PlotPanel.Model): Model => ({
      ...model,
      panels: model.panels.map((panel) => writeHistogram(panel, id, chart)),
    }),
    toParentMessage: (id: number, message: PlotPanel.Message) =>
      Message.GotHistogramMessage({ id, message }),
    foldOutMessage: (id: number) => (event: PlotPanel.OutMessage) =>
      PlotPanel.OutMessage.match<Step<Model, Message>>(event, {
        InspectedPoint: () => unchanged,
        InspectedRange: ({ domain: [lower, upper], includeEnd }) =>
          inspected(id, { _tag: 'Range', lower, upper, includeEnd }),
        ClearedInspection: () => (model) => clearInspection(model, id),
        SelectedRange: () => unchanged,
        ClearedSelection: () => unchanged,
      }),
  });
  return { scatter, histogram };
}
