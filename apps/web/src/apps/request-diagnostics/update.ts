import { Match, Option } from 'effect';
import type { Command } from 'foldkit';
import { Machine } from 'foldkit/experimental';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { FetchMetrics } from './command';
import { ChangedSelection, ClearedSelection, Message, StartedSelection } from './message';
import {
  ExplorerState,
  Loading,
  type ExplorerState as ExplorerStateType,
  type Model,
} from './model';
import { isEnteringDiagnostics, parseDiagnosticsPath } from './navigation';

type LoadedMetricsMessage = Extract<Message, { readonly _tag: 'LoadedMetrics' }>;

const filterPoints = (
  points: ReadonlyArray<import('./model').Point>,
  domain: readonly [number, number],
): ReadonlyArray<import('./model').Point> =>
  points.filter(({ x }) => x >= domain[0] && x <= domain[1]);

export const diagnosticsMachine = Machine.define({
  state: ExplorerState,
  message: Message,
})({
  initial: Loading(),
  states: {
    Loading: {
      on: {
        LoadedMetrics: Machine.to('Ready', ({ message }) => ({
          _tag: 'Ready',
          points: message.points,
        })),
        FailedLoad: Machine.to('Failed', ({ message }) => ({
          _tag: 'Failed',
          error: message.error,
        })),
      },
    },
    Ready: {
      on: {
        ClickedReload: Machine.to(
          'Loading',
          () => Loading(),
          () => [FetchMetrics()],
        ),
        StartedSelection: Machine.to('Selecting', ({ state }) => ({
          _tag: 'Selecting',
          points: state.points,
          allPoints: state.points,
        })),
        ChangedSelection: [
          Machine.when(
            (_state, message) =>
              message.domain[1] - message.domain[0] > 2
                ? Option.some(message.domain)
                : Option.none(),
            'Filtered',
            ({ state, guardValue }) => ({
              _tag: 'Filtered',
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
            ({ state, guardValue }) => ({
              _tag: 'Filtered',
              points: filterPoints(state.points, guardValue),
              allPoints: state.points,
              domain: guardValue,
            }),
          ),
        ],
        ClearedSelection: Machine.to('Ready', ({ state }) => ({
          _tag: 'Ready',
          points: state.allPoints,
        })),
      },
    },
    Filtered: {
      on: {
        ClearedSelection: Machine.to('Ready', ({ state }) => ({
          _tag: 'Ready',
          points: state.allPoints,
        })),
        ClickedReload: Machine.to(
          'Loading',
          () => Loading(),
          () => [FetchMetrics()],
        ),
      },
    },
    Failed: {
      on: {
        ClickedReload: Machine.to(
          'Loading',
          () => Loading(),
          () => [FetchMetrics()],
        ),
      },
    },
    Idle: { on: {} },
  },
});

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>];

const transitionLabel = (result: Machine.TransitionResult<ExplorerStateType, Message>): string =>
  result._tag === 'Transitioned'
    ? `${result.from} -> ${result.target} on ${result.messageTag}`
    : `${result.messageTag} ignored in ${result.stateTag}`;

const applyStateToScatter = (
  model: Model,
  points: ReadonlyArray<import('./model').Point>,
): Model => {
  const [scatter] = Scatter.update(model.scatter, Scatter.UpdatedPoints({ points }));
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
  return [withCharts, result._tag === 'Transitioned' ? result.commands : []];
};

const selectionMessage = (
  childTag: Histogram.Message['_tag'],
  domain: Option.Option<readonly [number, number]>,
): Option.Option<Message> => {
  if (childTag === 'ClearedHistogramBrush') return Option.some(ClearedSelection());
  if (childTag === 'StartedHistogramBrush') return Option.some(StartedSelection());
  return Option.map(domain, (value) => ChangedSelection({ domain: value }));
};

const updateHistogram = (model: Model, rawMessage: unknown): Return => {
  const child = rawMessage as Histogram.Message;
  const [histogram] = Histogram.update(model.histogram, child);
  const nextModel = { ...model, histogram };
  const maybeSelection = selectionMessage(child._tag, Histogram.getBrushDomain(histogram));
  return Option.match(maybeSelection, {
    onNone: () => [nextModel, []],
    onSome: (selection) => runMachine(nextModel, selection),
  });
};

const updateScatter = (model: Model, rawMessage: unknown): Return => {
  const child = rawMessage as Scatter.Message;
  const [scatter] = Scatter.update(model.scatter, child);
  return [{ ...model, scatter }, []];
};

const updateLoadedMetrics = (model: Model, message: LoadedMetricsMessage): Return => {
  const [nextModel, commands] = runMachine(model, message);
  return [
    {
      ...nextModel,
      histogram: Histogram.init({
        data: message.points.map(({ x }) => ({ value: x })),
        binCount: 10,
        color: '#38bdf8',
        xLabel: 'Response time (ms)',
        dims: { width: 480, height: 265 },
        enableBrush: true,
      })[0],
    },
    commands,
  ];
};

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      GotHistogramMessage: ({ message: rawMessage }) => updateHistogram(model, rawMessage),
      GotScatterMessage: ({ message: rawMessage }) => updateScatter(model, rawMessage),
      LoadedMetrics: (loadedMessage) => updateLoadedMetrics(model, loadedMessage),
      ClickedReload: () => runMachine(model, message),
      FailedLoad: () => runMachine(model, message),
      StartedSelection: () => runMachine(model, message),
      ChangedSelection: () => runMachine(model, message),
      ClearedSelection: () => runMachine(model, message),
      Navigated: (message) => {
        const navigation = {
          phase: message.phase,
          path: message.path,
          previousPath: message.previousPath,
        };
        const route = parseDiagnosticsPath(navigation.path);
        const routeEntry = isEnteringDiagnostics(message.phase, model.route, route);
        return [
          {
            ...model,
            navigation,
            route,
            lastTransition: `${navigation.phase} ${navigation.path}${routeEntry ? ' (route entry)' : ''}`,
          },
          [],
        ];
      },
    }),
  );
