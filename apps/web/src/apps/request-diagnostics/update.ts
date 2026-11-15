import { Match, Option } from 'effect';
import { Machine } from 'foldkit/experimental';
import type { Return as UpdateReturn } from 'foldkit/update';

import * as PlotPanel from '../../ui/plot-panel';
import { ReportToObservatory } from './command';
import { diagnosticsMachine } from './machine';
import { Message } from './message';
import { ExplorerState, histogramFor, type Model } from './model';
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
  const { model: scatter } = PlotPanel.update(
    model.scatter,
    PlotPanel.Message.ReplacedRows({ rows: points }),
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
  return { model: withCharts, commands: [...commands, ReportToObservatory({ message })] };
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
  return PlotPanel.OutMessage.match<Option.Option<Message>>(outMessage, {
    SelectedRange: ({ domain }) => Option.some(Message.ChangedSelection({ domain })),
    ClearedSelection: () => Option.some(Message.ClearedSelection()),
    InspectedPoint: () => Option.none(),
    InspectedRange: () => Option.none(),
    ClearedInspection: () => Option.none(),
  });
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
                histogram: histogramFor(message.points),
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
      return updateHistogram(model, rawMessage as PlotPanel.Message);
    },
    ReceivedScatterMessage: ({ message: rawMessage }) => {
      // SAFETY: The child message wrapper is produced by the Scatter submodel boundary.
      return updateScatter(model, rawMessage as PlotPanel.Message);
    },
    LoadedMetrics: (loadedMessage) => updateLoadedMetrics(model, loadedMessage),
    CompletedCancelFetchMetrics: () => runMachine(model, message),
    ClickedReload: () => runMachine(model, message),
    FailedLoad: () => runMachine(model, message),
    StartedSelection: () => runMachine(model, message),
    ChangedSelection: () => runMachine(model, message),
    ClearedSelection: () => runMachine(model, message),
    Navigated: (navigationMessage) => updateNavigation(model, navigationMessage),
    CompletedReportToObservatory: () => ({ model }),
  });
