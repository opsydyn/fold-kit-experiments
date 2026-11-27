import { UiSchema } from '@effect/ui';
import { Option, Schema } from 'effect';

import * as PlotPanel from '../../ui/plot-panel/core';
import { histogramSpec, scatterSpec } from './data';
import { initialSettings } from './initial-settings';
import type { Settings } from './settings';

const Inspection = Schema.TaggedUnion({
  Point: { key: Schema.String },
  Range: { lower: Schema.Number, upper: Schema.Number, includeEnd: Schema.Boolean },
});

export const Linking = UiSchema.TaggedEnum({
  Independent: {},
  Linked: {
    inspection: Schema.Option(Schema.Struct({ sourceId: Schema.Number, value: Inspection })),
  },
});

const Panel = Schema.TaggedUnion({
  Scatter: { id: Schema.Number, chart: PlotPanel.PortableModel },
  Histogram: { id: Schema.Number, chart: PlotPanel.PortableModel },
});
export type Panel = typeof Panel.Type;

export const Model = Schema.Struct({
  panels: Schema.Array(Panel),
  nextPanelId: Schema.Number,
  linking: Linking,
});
export type Model = typeof Model.Type;

export const Move = { id: Schema.Number, direction: Schema.Literals(['earlier', 'later']) };
type Move = Readonly<{ id: number; direction: typeof Move.direction.Type }>;

export const Message = UiSchema.TaggedEnum({
  ClickedAddPanel: { kind: Schema.Literals(['scatter', 'histogram']) },
  ClickedRemovePanel: { id: Schema.Number },
  ClickedMovePanel: Move,
  ObservedPanelMove: Move,
  ChangedLinkInspections: { enabled: Schema.Boolean },
  ReceivedPanelMessage: {
    id: Schema.Number,
    kind: Schema.Literals(['Scatter', 'Histogram']),
    message: PlotPanel.Message,
  },
});
export type Message = typeof Message.Type;

type Transition = Readonly<{
  model: Model;
  focus?:
    | { readonly _tag: 'Panel'; readonly id: number }
    | { readonly _tag: 'Add' }
    | ({ readonly _tag: 'Move' } & Move);
}>;

// Panel identifies a chart variant, and all hosts use the same numeric IDs.
// oxlint-disable-next-line linteffect/no-domain-meaning-by-folder-only
function makePanel(id: number, kind: Settings['panels'][number]['kind']): Panel {
  return kind === 'scatter'
    ? { _tag: 'Scatter', id, chart: PlotPanel.init({ spec: scatterSpec }).model }
    : { _tag: 'Histogram', id, chart: PlotPanel.init({ spec: histogramSpec }).model };
}

const linked = () => Linking.Linked({ inspection: Option.none() });

export function init(settings: Settings = initialSettings): Model {
  return {
    panels: settings.panels.map(({ id, kind }) => makePanel(id, kind)),
    nextPanelId: settings.nextPanelId,
    linking: settings.linkInspections ? linked() : Linking.Independent(),
  };
}

export const canAdd = (model: Model): boolean =>
  model.panels.length < 4 && Number.isSafeInteger(model.nextPanelId + 1);

function clearInspection(linking: Model['linking'], id: number): Model['linking'] {
  return linking._tag === 'Linked' && Option.exists(linking.inspection, (x) => x.sourceId === id)
    ? linked()
    : linking;
}

function updatePanel(
  model: Model,
  { id, kind, message }: Extract<Message, { _tag: 'ReceivedPanelMessage' }>,
): Model {
  const panel = model.panels.find((candidate) => candidate.id === id && candidate._tag === kind);
  if (panel === undefined) return model;
  const { model: chart, outMessage } = PlotPanel.update(panel.chart, message);
  let linking = model.linking;
  if (linking._tag === 'Linked') {
    if (outMessage?._tag === 'ClearedInspection') linking = clearInspection(linking, id);
    if (outMessage?._tag === 'InspectedPoint' && kind === 'Scatter') {
      linking = Linking.Linked({
        inspection: Option.some({ sourceId: id, value: { _tag: 'Point', key: outMessage.key } }),
      });
    }
    if (outMessage?._tag === 'InspectedRange' && kind === 'Histogram') {
      const {
        domain: [lower, upper],
        includeEnd,
      } = outMessage;
      linking = Linking.Linked({
        inspection: Option.some({
          sourceId: id,
          value: { _tag: 'Range', lower, upper, includeEnd },
        }),
      });
    }
  }
  if (chart === panel.chart && linking === model.linking) return model;
  return {
    ...model,
    linking,
    panels: model.panels.map((candidate) =>
      candidate === panel ? { ...panel, chart } : candidate,
    ),
  };
}

function moveIndices(model: Model, { id, direction }: Move) {
  const index = model.panels.findIndex((panel) => panel.id === id);
  const target = index + (direction === 'earlier' ? -1 : 1);
  return index < 0 || target < 0 || target >= model.panels.length ? undefined : { index, target };
}

export function update(model: Model, message: Message): Transition {
  return Message.match(message, {
    ClickedAddPanel: ({ kind }): Transition => {
      if (!canAdd(model)) return { model };
      const id = model.nextPanelId;
      return {
        model: { ...model, nextPanelId: id + 1, panels: [...model.panels, makePanel(id, kind)] },
        focus: { _tag: 'Panel', id },
      };
    },
    ClickedRemovePanel: ({ id }): Transition => {
      const index = model.panels.findIndex((panel) => panel.id === id);
      if (index === -1) return { model };
      const next = model.panels[index + 1] ?? model.panels[index - 1];
      return {
        model: {
          ...model,
          panels: model.panels.filter((panel) => panel.id !== id),
          linking: clearInspection(model.linking, id),
        },
        focus: next === undefined ? { _tag: 'Add' } : { _tag: 'Panel', id: next.id },
      };
    },
    ClickedMovePanel: ({ id, direction }): Transition =>
      moveIndices(model, { id, direction }) === undefined
        ? { model }
        : { model, focus: { _tag: 'Move', id, direction } },
    ObservedPanelMove: ({ id, direction }): Transition => {
      const move = moveIndices(model, { id, direction });
      if (move === undefined) return { model };
      const { index, target } = move;
      const panel = model.panels[index];
      const neighbour = model.panels[target];
      if (panel === undefined || neighbour === undefined) return { model };
      const panels = [...model.panels];
      panels[index] = neighbour;
      panels[target] = panel;
      return { model: { ...model, panels } };
    },
    ChangedLinkInspections: ({ enabled }) => ({
      model:
        enabled === (model.linking._tag === 'Linked')
          ? model
          : { ...model, linking: enabled ? linked() : Linking.Independent() },
    }),
    ReceivedPanelMessage: (message) => ({ model: updatePanel(model, message) }),
  });
}
