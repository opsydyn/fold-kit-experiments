import { Option } from 'effect';
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

export const diagnosticsMachine = Machine.define({
  state: ExplorerState,
  message: Message,
})({
  initial: ExplorerState.Loading(),
  states: {
    Loading: {
      on: {
        ClickedReload: Machine.to('Cancelling', () => ({
          model: cancelling('Reload'),
          commands: interruptMetrics(),
        })),
        Navigated: [
          Machine.when(
            (_state, message) => message.phase === 'exited',
            'Cancelling',
            () => ({
              model: cancelling('RouteExit'),
              commands: interruptMetrics(),
            }),
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
        ClickedReload: Machine.to('Cancelling', () => ({
          model: cancelling('Reload'),
          commands: interruptMetrics(),
        })),
        StartedSelection: Machine.to('Selecting', ({ state }) => ({
          model: ExplorerState.Selecting({ points: state.points, allPoints: state.points }),
        })),
        ChangedSelection: [
          Machine.when(
            (_state, message) =>
              message.domain[1] - message.domain[0] > 2
                ? Option.some(message.domain)
                : Option.none(),
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
            (_state, message) =>
              message.domain[1] - message.domain[0] > 2
                ? Option.some(message.domain)
                : Option.none(),
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
        ClickedReload: Machine.to('Cancelling', () => ({
          model: cancelling('Reload'),
          commands: interruptMetrics(),
        })),
      },
    },
    Failed: {
      on: {
        ClickedReload: Machine.to('Cancelling', () => ({
          model: cancelling('Reload'),
          commands: interruptMetrics(),
        })),
      },
    },
    Cancelling: {
      on: {
        CompletedCancelFetchMetrics: [
          Machine.when(
            (state) => state.reason === 'Reload',
            'Loading',
            () => ({
              model: ExplorerState.Loading(),
              commands: [FetchMetrics()],
            }),
          ),
          Machine.otherwise(Machine.to('Idle', () => ({ model: ExplorerState.Idle() }))),
        ],
      },
    },
    Idle: { on: {} },
  },
});
