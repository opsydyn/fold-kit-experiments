import { Match, Option, Predicate } from 'effect';
import { foldChildAt } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import type { Inspection } from '../../ui/shared/inspection';
import { Message } from './message';
import { Linking } from './model';
import type { Model, Panel } from './model';

type ChartUpdaters = Readonly<{
  scatter: typeof Scatter.update;
  histogram: typeof Histogram.update;
}>;
type ComparisonFolds = Readonly<{
  scatter: (model: Model, id: number, message: Scatter.Message) => Return<Model, Message>;
  histogram: (model: Model, id: number, message: Histogram.Message) => Return<Model, Message>;
}>;

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

function writeScatter(panel: Panel, id: number, chart: Scatter.Model): Panel {
  return Match.value(panel).pipe(
    Match.when({ _tag: 'Scatter', id }, (current) => ({ ...current, chart })),
    Match.orElse((current) => current),
  );
}

function writeHistogram(panel: Panel, id: number, chart: Histogram.Model): Panel {
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
    writeAt: (model: Model, id: number, chart: Scatter.Model): Model => ({
      ...model,
      panels: model.panels.map((panel) => writeScatter(panel, id, chart)),
    }),
    toParentMessage: (id: number, message: Scatter.Message) =>
      Message.GotScatterMessage({ id, message }),
    foldOutMessage: (id: number) => (event: Scatter.OutMessage) =>
      Scatter.OutMessage.match<Step<Model, Message>>(event, {
        InspectedPoint: ({ key }) => inspected(id, { _tag: 'Point', key }),
        ClearedInspection: () => (model) => clearInspection(model, id),
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
    writeAt: (model: Model, id: number, chart: Histogram.Model): Model => ({
      ...model,
      panels: model.panels.map((panel) => writeHistogram(panel, id, chart)),
    }),
    toParentMessage: (id: number, message: Histogram.Message) =>
      Message.GotHistogramMessage({ id, message }),
    foldOutMessage: (id: number) => (event: Histogram.OutMessage) =>
      Histogram.OutMessage.match<Step<Model, Message>>(event, {
        InspectedRange: ({ domain: [lower, upper], includeEnd }) =>
          inspected(id, { _tag: 'Range', lower, upper, includeEnd }),
        ClearedInspection: () => (model) => clearInspection(model, id),
      }),
  });
  return { scatter, histogram };
}
