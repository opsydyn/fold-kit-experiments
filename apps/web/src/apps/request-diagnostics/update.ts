import { Command } from '@effect/ui';
import { Match, Option } from 'effect';

import * as PlotPanel from '../../ui/plot-panel/core';
import { CancelMetrics, FetchMetrics, ReportToObservatory } from './command';
import { diagnosticsMachine, type Step } from './machine';
import { CancellationOutcome, Message } from './message';
import { ExplorerState, histogramFor, type Model } from './model';
import { isEnteringDiagnostics, parseDiagnosticsPath } from './navigation';

type LoadedMetricsMessage = Extract<Message, { readonly _tag: 'LoadedMetrics' }>;
type NavigationMessage = Extract<Message, { readonly _tag: 'Navigated' }>;

interface Return {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Command<Message>>;
}

const transitionLabel = (result: Step): string =>
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
  const { model: scatter } = PlotPanel.update(
    model.scatter,
    PlotPanel.Message.ReplacedRows({ rows: points }),
  );
  return { ...model, scatter };
};

const applyChartsForState = (model: Model, state: ExplorerState): Model =>
  state._tag === 'Ready' || state._tag === 'Filtered'
    ? applyStateToScatter(model, state.points)
    : model;

const runMachine = (model: Model, message: Message, alreadyReported = false): Return => {
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
  const outcome =
    model.explorer._tag === 'Loading'
      ? CancellationOutcome.Interrupted()
      : CancellationOutcome.NotFound();
  const work = commands.flatMap(
    ({ name }): ReadonlyArray<Command.Command<Message>> =>
      name === 'FetchMetrics'
        ? [FetchMetrics.make({})]
        : [Command.interrupt(FetchMetrics), CancelMetrics.make({ outcome })],
  );
  return {
    model: withCharts,
    commands: alreadyReported ? work : [ReportToObservatory.make({ message }), ...work],
  };
};

/**
 * The machine's selection event for a histogram step: a press that starts a
 * brush, the range it settles on, or a click that clears it. Hovering is not a
 * selection.
 */
const selectionMessage = (
  before: PlotPanel.Model,
  after: PlotPanel.Model,
  outMessage: PlotPanel.OutMessage | undefined,
): Option.Option<Message> => {
  if (Option.isNone(before.drag) && Option.isSome(after.drag))
    return Option.some(Message.StartedSelection());
  if (outMessage === undefined) return Option.none();
  if (outMessage._tag === 'SelectedRange')
    return Option.some(Message.ChangedSelection({ domain: outMessage.domain }));
  return outMessage._tag === 'ClearedSelection'
    ? Option.some(Message.ClearedSelection())
    : Option.none();
};

const updateHistogram = (model: Model, child: PlotPanel.Message): Return => {
  const { model: histogram, outMessage } = PlotPanel.update(model.histogram, child);
  const nextModel = { ...model, histogram };
  const maybeSelection = selectionMessage(model.histogram, histogram, outMessage);
  return Option.match(maybeSelection, {
    onNone: () => ({ model: nextModel }),
    onSome: (selection) => runMachine(nextModel, selection),
  });
};

const updateScatter = (model: Model, child: PlotPanel.Message): Return => {
  const { model: scatter } = PlotPanel.update(model.scatter, child);
  return { model: { ...model, scatter } };
};

const updateLoadedMetrics = (model: Model, message: LoadedMetricsMessage): Return => {
  const { model: nextModel, commands } = runMachine(model, message);
  return model.explorer._tag === 'Loading' && nextModel.explorer._tag === 'Ready'
    ? { model: { ...nextModel, histogram: histogramFor(message.points) }, commands }
    : { model: nextModel, commands };
};

const updateNavigation = (
  model: Model,
  message: NavigationMessage,
  alreadyReported = false,
): Return => {
  const { model: nextModel, commands } = runMachine(model, message, alreadyReported);
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
    MountedDiagnostics: () => ({ model, commands: [FetchMetrics.make({})] }),
    ReceivedHistogramMessage: ({ message }) => updateHistogram(model, message),
    ReceivedScatterMessage: ({ message }) => updateScatter(model, message),
    LoadedMetrics: (loadedMessage) => updateLoadedMetrics(model, loadedMessage),
    CompletedCancelFetchMetrics: () => runMachine(model, message),
    ClickedReload: () => runMachine(model, message),
    FailedLoad: () => runMachine(model, message),
    StartedSelection: () => runMachine(model, message),
    ChangedSelection: () => runMachine(model, message),
    ClearedSelection: () => runMachine(model, message),
    Navigated: (navigationMessage) => updateNavigation(model, navigationMessage),
    ObservedRouteExit: ({ phase, path, previousPath }) =>
      updateNavigation(model, Message.Navigated({ phase, path, previousPath }), true),
    CompletedReportToObservatory: () => ({ model }),
  });
