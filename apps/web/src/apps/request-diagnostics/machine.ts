import { Match, Option } from 'effect';
import { Machine } from 'foldkit/experimental';

import { FetchMetrics } from './command';
import { Message } from './message';
import { ExplorerState } from './model';

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

const wideDomain = (domain: readonly [number, number]): Option.Option<readonly [number, number]> =>
  Match.value(domain[1] - domain[0] > 2).pipe(
    Match.when(true, () => Option.some(domain)),
    Match.orElse(() => Option.none()),
  );

const isExitedNavigation = (message: Extract<Message, { readonly _tag: 'Navigated' }>): boolean =>
  Match.value(message.phase).pipe(
    Match.when('exited', () => true),
    Match.orElse(() => false),
  );

const isReloadCancellation = (
  state: Extract<ExplorerState, { readonly _tag: 'Cancelling' }>,
): boolean =>
  Match.value(state.reason).pipe(
    Match.when('Reload', () => true),
    Match.orElse(() => false),
  );

const reloadTransition = () => ({
  model: cancelling('Reload'),
  commands: interruptMetrics(),
});

const routeExitTransition = () => ({
  model: cancelling('RouteExit'),
  commands: interruptMetrics(),
});

const restartAfterReload = () => ({
  model: ExplorerState.Loading(),
  commands: [FetchMetrics()],
});

export const diagnosticsMachine = Machine.define({
  state: ExplorerState,
  message: Message,
})({
  initial: ExplorerState.Loading(),
  states: {
    Loading: {
      on: {
        ClickedReload: Machine.to('Cancelling', reloadTransition),
        Navigated: [
          Machine.when(
            (_state, message) => isExitedNavigation(message),
            'Cancelling',
            routeExitTransition,
          ),
        ],
        LoadedMetrics: Machine.to('Ready', ({ message }) => ({
          model: ExplorerState.Ready({ points: message.points }),
        })),
        FailedLoad: Machine.to('Failed', ({ message }) => ({
          model: ExplorerState.Failed({ error: message.error }),
        })),
      },
    },
    Ready: {
      on: {
        ClickedReload: Machine.to('Cancelling', reloadTransition),
        StartedSelection: Machine.to('Selecting', ({ state }) => ({
          model: ExplorerState.Selecting({ points: state.points, allPoints: state.points }),
        })),
        ChangedSelection: [
          Machine.when(
            (_state, message) => wideDomain(message.domain),
            'Filtered',
            ({ state, guardValue }) => ({
              model: ExplorerState.Filtered({
                points: filterPoints(state.points, guardValue),
                allPoints: state.points,
                domain: guardValue,
              }),
            }),
          ),
        ],
      },
    },
    Selecting: {
      on: {
        ChangedSelection: [
          Machine.when(
            (_state, message) => wideDomain(message.domain),
            'Filtered',
            ({ state, guardValue }) => ({
              model: ExplorerState.Filtered({
                points: filterPoints(state.points, guardValue),
                allPoints: state.points,
                domain: guardValue,
              }),
            }),
          ),
        ],
        ClearedSelection: Machine.to('Ready', ({ state }) => ({
          model: ExplorerState.Ready({ points: state.allPoints }),
        })),
      },
    },
    Filtered: {
      on: {
        ClearedSelection: Machine.to('Ready', ({ state }) => ({
          model: ExplorerState.Ready({ points: state.allPoints }),
        })),
        ClickedReload: Machine.to('Cancelling', reloadTransition),
      },
    },
    Failed: {
      on: {
        ClickedReload: Machine.to('Cancelling', reloadTransition),
      },
    },
    Cancelling: {
      on: {
        CompletedCancelFetchMetrics: [
          Machine.when((state) => isReloadCancellation(state), 'Loading', restartAfterReload),
          Machine.otherwise(Machine.to('Idle', () => ({ model: ExplorerState.Idle() }))),
        ],
      },
    },
    Idle: { on: {} },
  },
});
