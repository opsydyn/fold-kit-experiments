// Pure collection guards keep impossible transitions as identity returns, without running Effects.
/* oxlint-disable linteffect/no-if-statement */
import { Match, Option } from 'effect';
import type { Return } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { clearInspection, comparisonFolds } from './fold';
import { Message } from './message';
import { Linking, initPanel } from './model';
import type { Model } from './model';
import type { Settings } from './settings';

const folds = comparisonFolds({ scatter: Scatter.update, histogram: Histogram.update });

function add(model: Model, kind: Settings['panels'][number]['kind']): Return<Model, Message> {
  if (model.panels.length >= 4) return { model };
  const child = initPanel(model.nextPanelId, kind);
  return {
    model: {
      ...model,
      panels: [...model.panels, child.model],
      nextPanelId: model.nextPanelId + 1,
    },
    commands: child.commands,
  };
}

function remove(model: Model, id: number): Return<Model, Message> {
  if (!model.panels.some((panel) => panel.id === id)) return { model };
  const cleared = clearInspection(model, id);
  return {
    model: { ...cleared.model, panels: model.panels.filter((panel) => panel.id !== id) },
  };
}

function move(model: Model, id: number, direction: 'earlier' | 'later'): Return<Model, Message> {
  const index = model.panels.findIndex((panel) => panel.id === id);
  const offset = Match.value(direction).pipe(
    Match.when('earlier', () => -1),
    Match.when('later', () => 1),
    Match.exhaustive,
  );
  const target = index + offset;
  const panel = model.panels[index];
  const neighbour = model.panels[target];
  if (panel === undefined || neighbour === undefined) return { model };
  const panels = [...model.panels];
  panels[index] = neighbour;
  panels[target] = panel;
  return { model: { ...model, panels } };
}

function changeLinking(model: Model, enabled: boolean): Return<Model, Message> {
  const wasEnabled = Linking.match(model.linking, {
    Independent: () => false,
    Linked: () => true,
  });
  if (enabled === wasEnabled) return { model };
  const linking = Match.value(enabled).pipe(
    Match.when(true, () => Linking.Linked({ inspection: Option.none() })),
    Match.when(false, () => Linking.Independent()),
    Match.exhaustive,
  );
  return { model: { ...model, linking } };
}

export function update(model: Model, message: Message): Return<Model, Message> {
  return Message.match<Return<Model, Message>>(message, {
    ClickedAddPanel: ({ kind }) => add(model, kind),
    ClickedRemovePanel: ({ id }) => remove(model, id),
    ClickedMovePanel: ({ id, direction }) => move(model, id, direction),
    ChangedLinkInspections: ({ enabled }) => changeLinking(model, enabled),
    GotScatterMessage: ({ id, message: child }) => {
      // SAFETY: GotScatterMessage carries the scatter child's Message.
      return folds.scatter(model, id, child as Scatter.Message);
    },
    GotHistogramMessage: ({ id, message: child }) => {
      // SAFETY: GotHistogramMessage carries the histogram child's Message.
      return folds.histogram(model, id, child as Histogram.Message);
    },
  });
}
