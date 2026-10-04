import { Match, Option } from 'effect';
import { Machine } from 'foldkit/experimental';
import type { Return as UpdateReturn } from 'foldkit/update';

import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { diagnosticsMachine } from './machine';
import { Message } from './message';
import { ExplorerState, type Model } from './model';
import { isEnteringDiagnostics, parseDiagnosticsPath } from './navigation';

type LoadedMetricsMessage = Extract<Message, { readonly _tag: 'LoadedMetrics' }>;
type NavigationMessage = Extract<Message, { readonly _tag: 'Navigated' }>;

type Return = UpdateReturn<Model, Message>;

const transitionLabel = (result: Machine.TransitionResult<ExplorerState, Message>): string =>
  Match.value(result).pipe(
    Match.tag(
      'Transitioned',
      ({ from, target, messageTag }) => `${from} -> ${target} on ${messageTag}`,
    ),
    Match.tag('Ignored', ({ messageTag, stateTag }) => `${messageTag} ignored in ${stateTag}`),
    Match.exhaustive,
  );

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

const applyChartsForState = (model: Model, state: ExplorerState): Model =>
  ExplorerState.matchOrElse(
    state,
    {
      Ready: ({ points }) => applyStateToScatter(model, points),
      Filtered: ({ points }) => applyStateToScatter(model, points),
    },
    () => model,
  );

const runMachine = (model: Model, message: Message): Return => {
  const result = diagnosticsMachine.step(model.explorer, message);
  const nextModel = {
    ...model,
    explorer: result.state,
    lastTransition: transitionLabel(result),
  };
  const withCharts = Match.value(result).pipe(
    Match.tag('Transitioned', ({ state }) => applyChartsForState(nextModel, state)),
    Match.orElse(() => nextModel),
  );
  const commands = Match.value(result).pipe(
    Match.tag('Transitioned', ({ commands: nextCommands }) => nextCommands),
    Match.orElse(() => []),
  );
  return { model: withCharts, commands };
};

const selectionMessage = (
  child: Histogram.Message,
  domain: Option.Option<readonly [number, number]>,
): Option.Option<Message> => {
  return Match.value(child).pipe(
    Match.tag('ClearedHistogramBrush', () => Option.some(Message.ClearedSelection())),
    Match.tag('StartedHistogramBrush', () => Option.some(Message.StartedSelection())),
    Match.orElse(() => Option.map(domain, (value) => Message.ChangedSelection({ domain: value }))),
  );
};

const updateHistogram = (model: Model, child: Histogram.Message): Return => {
  const { model: histogram } = Histogram.update(model.histogram, child);
  const nextModel = { ...model, histogram };
  const maybeSelection = selectionMessage(child, Histogram.getBrushDomain(histogram));
  return Option.match(maybeSelection, {
    onNone: () => ({ model: nextModel }),
    onSome: (selection) => runMachine(nextModel, selection),
  });
};

const updateScatter = (model: Model, child: Scatter.Message): Return => {
  const { model: scatter } = Scatter.update(model.scatter, child);
  return { model: { ...model, scatter } };
};

const updateLoadedMetrics = (model: Model, message: LoadedMetricsMessage): Return => {
  const { model: nextModel, commands } = runMachine(model, message);
  return ExplorerState.matchOrElse(
    model.explorer,
    {
      Loading: () =>
        ExplorerState.matchOrElse(
          nextModel.explorer,
          {
            Ready: () => ({
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
            }),
          },
          () => ({ model: nextModel, commands }),
        ),
    },
    () => ({ model: nextModel, commands }),
  );
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
  const routeEntrySuffix = Match.value(routeEntry).pipe(
    Match.when(true, () => ' (route entry)'),
    Match.orElse(() => ''),
  );

  return {
    model: {
      ...nextModel,
      navigation,
      route,
      lastTransition: `${navigation.phase} ${navigation.path}${routeEntrySuffix}`,
    },
    commands,
  };
};

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    ReceivedHistogramMessage: ({ message: rawMessage }) => {
      // SAFETY: The child message wrapper is produced by the Histogram submodel boundary.
      return updateHistogram(model, rawMessage as Histogram.Message);
    },
    ReceivedScatterMessage: ({ message: rawMessage }) => {
      // SAFETY: The child message wrapper is produced by the Scatter submodel boundary.
      return updateScatter(model, rawMessage as Scatter.Message);
    },
    LoadedMetrics: (loadedMessage) => updateLoadedMetrics(model, loadedMessage),
    CompletedCancelFetchMetrics: () => runMachine(model, message),
    ClickedReload: () => runMachine(model, message),
    FailedLoad: () => runMachine(model, message),
    StartedSelection: () => runMachine(model, message),
    ChangedSelection: () => runMachine(model, message),
    ClearedSelection: () => runMachine(model, message),
    Navigated: (navigationMessage) => updateNavigation(model, navigationMessage),
  });
