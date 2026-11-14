import { Match, Option, Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';
import { foldChildInit } from 'foldkit/update';
import type { Return } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import { histogramSpec, scatterSpec } from './data';
import { Message } from './message';
import { initialSettings } from './settings';
import type { Settings } from './settings';

export type Panel =
  | Readonly<{ _tag: 'Scatter'; id: number; chart: PlotPanel.Model }>
  | Readonly<{ _tag: 'Histogram'; id: number; chart: PlotPanel.Model }>;

const Inspection = defineTaggedUnion({
  Point: { key: Schema.String },
  Range: { lower: Schema.Number, upper: Schema.Number, includeEnd: Schema.Boolean },
});
export const Linking = defineTaggedUnion({
  Independent: {},
  Linked: {
    inspection: Schema.Option(Schema.Struct({ sourceId: Schema.Number, value: Inspection })),
  },
});
export type Linking = typeof Linking.Type;

export type Model = Readonly<{
  panels: ReadonlyArray<Panel>;
  nextPanelId: number;
  linking: Linking;
}>;

// Panel is a chart variant, not an access-control context; IDs are numeric by contract.
// oxlint-disable-next-line linteffect/no-domain-meaning-by-folder-only
export function initPanel(
  id: number,
  kind: Settings['panels'][number]['kind'],
): Return<Panel, Message> {
  return Match.value(kind).pipe(
    Match.when('scatter', () =>
      foldChildInit(PlotPanel.init({ spec: scatterSpec }), {
        toParentModel: (chart): Panel => ({ _tag: 'Scatter', id, chart }),
        toParentMessage: (message) => Message.GotScatterMessage({ id, message }),
      }),
    ),
    Match.when('histogram', () =>
      foldChildInit(PlotPanel.init({ spec: histogramSpec }), {
        toParentModel: (chart): Panel => ({ _tag: 'Histogram', id, chart }),
        toParentMessage: (message) => Message.GotHistogramMessage({ id, message }),
      }),
    ),
    Match.exhaustive,
  );
}

export function init(settings: Settings = initialSettings): Return<Model, Message> {
  const children = settings.panels.map(({ id, kind }) => initPanel(id, kind));
  return {
    model: {
      panels: children.map(({ model }) => model),
      nextPanelId: settings.nextPanelId,
      linking: settings.linkInspections
        ? Linking.Linked({ inspection: Option.none() })
        : Linking.Independent(),
    },
    commands: children.flatMap(({ commands }) => commands ?? []),
  };
}
