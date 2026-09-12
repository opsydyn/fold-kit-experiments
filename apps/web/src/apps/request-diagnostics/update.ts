import { Option } from 'effect';
import { Machine } from 'foldkit/experimental';
import type { Return as UpdateReturn } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { FetchMetrics } from './command';
import { Message } from './message';
import { ExplorerState, type ExplorerState as ExplorerStateType, type Model } from './model';
import { isEnteringDiagnostics, parseDiagnosticsPath } from './navigation';

type LoadedMetricsMessage = Extract<Message, { readonly _tag: 'LoadedMetrics' }>;
type NavigationMessage = Extract<Message, { readonly _tag: 'Navigated' }>;

const cancelling = (reason: import('./model').CancellationReason) =>
  ExplorerState.Cancelling({ reason });

const interruptMetrics = () => [
  FetchMetrics.Interrupt((outcome) => Message.CompletedCancelFetchMetrics({ outcome })),
];

const filterPoints = (
  points: ReadonlyArray<import('./model').Point>,
  domain: readonly [number, number],
): ReadonlyArray<import('./model').Point> =>
  points.filter(({ x }) => x >= domain[0] && x <= domain[1]);

export const diagnosticsMachine = Machine.define({
  state: ExplorerState,
  message: Message,
})({
  initial: ExplorerState.Loading(),
  states: {
    Loading: {
      on: {
        ClickedReload: Machine.to('Cancelling', () => cancelling('Reload'), interruptMetrics),
        Navigated: [
          Machine.when(
            (_state, message) => message.phase === 'exited',
            'Cancelling',
            () => cancelling('RouteExit'),
            interruptMetrics,
          ),
        ],
        LoadedMetrics: Machine.to('Ready', ({ message }) =>
          ExplorerState.Ready({ points: message.points }),
        ),
        FailedLoad: Machine.to('Failed', ({ message }) =>
          ExplorerState.Failed({ error: message.error }),
        ),
      },
    },
    Ready: {
      on: {
        ClickedReload: Machine.to('Cancelling', () => cancelling('Reload'), interruptMetrics),
        StartedSelection: Machine.to('Selecting', ({ state }) =>
          ExplorerState.Selecting({ points: state.points, allPoints: state.points }),
        ),
        ChangedSelection: [
          Machine.when(
            (_state, message) =>
              message.domain[1] - message.domain[0] > 2
                ? Option.some(message.domain)
                : Option.none(),
            'Filtered',
            ({ state, guardValue }) =>
              ExplorerState.Filtered({
                points: filterPoints(state.points, guardValue),
                allPoints: state.points,
                domain: guardValue,
              }),
          ),
        ],
      },
    },
    Selecting: {
      on: {
        ChangedSelection: [
          Machine.when(
            (_state, message) =>
              message.domain[1] - message.domain[0] > 2
                ? Option.some(message.domain)
                : Option.none(),
            'Filtered',
            ({ state, guardValue }) =>
              ExplorerState.Filtered({
                points: filterPoints(state.points, guardValue),
                allPoints: state.points,
                domain: guardValue,
              }),
          ),
        ],
        ClearedSelection: Machine.to('Ready', ({ state }) =>
          ExplorerState.Ready({ points: state.allPoints }),
        ),
      },
    },
    Filtered: {
      on: {
        ClearedSelection: Machine.to('Ready', ({ state }) =>
          ExplorerState.Ready({ points: state.allPoints }),
        ),
        ClickedReload: Machine.to('Cancelling', () => cancelling('Reload'), interruptMetrics),
      },
    },
    Failed: {
      on: {
        ClickedReload: Machine.to('Cancelling', () => cancelling('Reload'), interruptMetrics),
      },
    },
    Cancelling: {
      on: {
        CompletedCancelFetchMetrics: [
          Machine.when(
            (state) => state.reason === 'Reload',
            'Loading',
            () => ExplorerState.Loading(),
            () => [FetchMetrics()],
          ),
          Machine.otherwise(Machine.to('Idle', () => ExplorerState.Idle())),
        ],
      },
    },
    Idle: { on: {} },
  },
});

type Return = UpdateReturn<Model, Message>;

const transitionLabel = (result: Machine.TransitionResult<ExplorerStateType, Message>): string =>
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
