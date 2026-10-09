import { Match, Option, Schema } from 'effect';
import { defineTaggedUnion } from 'foldkit/schema';
import { foldChildInit } from 'foldkit/update';
import type { Return } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { points } from './data';
import { Message } from './message';
import { initialSettings } from './settings';
import type { Settings } from './settings';

export type Panel =
  | Readonly<{ _tag: 'Scatter'; id: number; chart: Scatter.Model }>
  | Readonly<{ _tag: 'Histogram'; id: number; chart: Histogram.Model }>;

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
      foldChildInit(
        Scatter.init({
          points,
          config: {
            color: '#6366f1',
            activeColor: '#4338ca',
            xLabel: 'Years experience',
            yLabel: 'Salary ($)',
          },
          dims: { width: 380, height: 260 },
        }),
        {
          toParentModel: (chart): Panel => ({ _tag: 'Scatter', id, chart }),
          toParentMessage: (message) => Message.GotScatterMessage({ id, message }),
        },
      ),
    ),
    Match.when('histogram', () =>
      foldChildInit(
        Histogram.init({
          data: points.map((point) => ({ value: point.y })),
          binCount: 8,
          color: '#6366f1',
          xLabel: 'Salary ($)',
          dims: { width: 360, height: 260 },
        }),
        {
          toParentModel: (chart): Panel => ({ _tag: 'Histogram', id, chart }),
          toParentMessage: (message) => Message.GotHistogramMessage({ id, message }),
        },
      ),
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
