import { Option } from 'effect';
import { Machine } from 'foldkit/experimental';
import type { Return as UpdateReturn } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { diagnosticsMachine } from './machine';
import { Message } from './message';
import type { ExplorerState, Model } from './model';
import { isEnteringDiagnostics, parseDiagnosticsPath } from './navigation';

type LoadedMetricsMessage = Extract<Message, { readonly _tag: 'LoadedMetrics' }>;
type NavigationMessage = Extract<Message, { readonly _tag: 'Navigated' }>;

type Return = UpdateReturn<Model, Message>;

const transitionLabel = (result: Machine.TransitionResult<ExplorerState, Message>): string =>
  result._tag === 'Transitioned'
    ? `${result.from} -> ${result.target} on ${result.messageTag}`
    : `${result.messageTag} ignored in ${result.stateTag}`;

const applyStateToScatter = (
  model: Model,
  points: ReadonlyArray<import('./model').Point>,
): Model => {
  const { model: scatter } = Scatter.update(
    model.scatter,
    Scatter.Message.UpdatedPoints({ points }),
  );
  return { ...model, scatter };
};

const runMachine = (model: Model, message: Message): Return => {
  const result = diagnosticsMachine.step(model.explorer, message);
  const nextModel = {
    ...model,
    explorer: result.state,
    lastTransition: transitionLabel(result),
  };
  const withCharts =
    result._tag === 'Transitioned' &&
    (result.state._tag === 'Ready' || result.state._tag === 'Filtered')
      ? applyStateToScatter(nextModel, result.state.points)
      : nextModel;
  return { model: withCharts, commands: result._tag === 'Transitioned' ? result.commands : [] };
};

const selectionMessage = (
  childTag: Histogram.Message['_tag'],
  domain: Option.Option<readonly [number, number]>,
): Option.Option<Message> => {
  if (childTag === 'ClearedHistogramBrush') return Option.some(Message.ClearedSelection());
  if (childTag === 'StartedHistogramBrush') return Option.some(Message.StartedSelection());
  return Option.map(domain, (value) => Message.ChangedSelection({ domain: value }));
};

const updateHistogram = (model: Model, rawMessage: unknown): Return => {
  const child = rawMessage as Histogram.Message;
  const { model: histogram } = Histogram.update(model.histogram, child);
  const nextModel = { ...model, histogram };
  const maybeSelection = selectionMessage(child._tag, Histogram.getBrushDomain(histogram));
  return Option.match(maybeSelection, {
    onNone: () => ({ model: nextModel }),
    onSome: (selection) => runMachine(nextModel, selection),
  });
};

const updateScatter = (model: Model, rawMessage: unknown): Return => {
  const child = rawMessage as Scatter.Message;
  const { model: scatter } = Scatter.update(model.scatter, child);
  return { model: { ...model, scatter } };
};

const updateLoadedMetrics = (model: Model, message: LoadedMetricsMessage): Return => {
  const { model: nextModel, commands } = runMachine(model, message);
  if (model.explorer._tag !== 'Loading' || nextModel.explorer._tag !== 'Ready')
    return { model: nextModel, commands };
  return {
    model: {
      ...nextModel,
      histogram: Histogram.init({
        data: message.points.map(({ x }) => ({ value: x })),
        binCount: 10,
        color: '#38bdf8',
        xLabel: 'Response time (ms)',
        dims: { width: 480, height: 265 },
        enableBrush: true,
      }).model,
    },
    commands,
  };
};

const updateNavigation = (model: Model, message: NavigationMessage): Return => {
  const { model: nextModel, commands } = runMachine(model, message);
  const navigation = {
    phase: message.phase,
    path: message.path,
    previousPath: message.previousPath,
  };
  const route = parseDiagnosticsPath(navigation.path);
  const routeEntry = isEnteringDiagnostics(message.phase, model.route, route);

  return {
    model: {
      ...nextModel,
      navigation,
      route,
      lastTransition: `${navigation.phase} ${navigation.path}${routeEntry ? ' (route entry)' : ''}`,
    },
    commands,
  };
};

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    GotHistogramMessage: ({ message: rawMessage }) => updateHistogram(model, rawMessage),
    GotScatterMessage: ({ message: rawMessage }) => updateScatter(model, rawMessage),
    LoadedMetrics: (loadedMessage) => updateLoadedMetrics(model, loadedMessage),
    CompletedCancelFetchMetrics: () => runMachine(model, message),
    ClickedReload: () => runMachine(model, message),
    FailedLoad: () => runMachine(model, message),
    StartedSelection: () => runMachine(model, message),
    ChangedSelection: () => runMachine(model, message),
    ClearedSelection: () => runMachine(model, message),
    Navigated: (navigationMessage) => updateNavigation(model, navigationMessage),
  });
