import {
  chartCommandOf,
  targetAfter,
  type ChartCommand,
  type ChartKeyOptions,
  type TargetOptions,
} from '../interaction/keyboard.js';
import { chartKey, type ChartKeyEvent } from './keyboard-event.js';

export type { ChartKeyEvent };

const commandFrom = (keyEvent: ChartKeyEvent, options: ChartKeyOptions) => {
  const key = chartKey(keyEvent);
  return key === undefined ? undefined : chartCommandOf(key, {}, options);
};

/** An Effect UI keydown handler. Use `preventDefault: true` to consume only handled keys. */
export const chartKeyDown =
  <M>(toMessage: (command: ChartCommand) => M, options: ChartKeyOptions = {}) =>
  (keyEvent: ChartKeyEvent): M | undefined => {
    const command = commandFrom(keyEvent, options);
    return command === undefined ? undefined : toMessage(command);
  };

export type ChartFocusConfig<M> = Readonly<{
  /** How many targets there are, in reading order. */
  count: number;
  /** The active target, if any. */
  current: number | undefined;
  /** A selector for the element to focus for a target. */
  focusSelector: (target: number) => string;
  /** Maps the target and command to an application message. */
  toMessage: (target: number, command: ChartCommand) => M;
}> &
  ChartKeyOptions &
  TargetOptions;

/** Computes a roving-focus target and message for an application's scoped focus command. */
export const chartKeyDownFocus =
  <M>(config: ChartFocusConfig<M>) =>
  (keyEvent: ChartKeyEvent): Readonly<{ focusSelector: string; message: M }> | undefined => {
    const command = commandFrom(keyEvent, config);
    if (command === undefined) return undefined;
    const target = targetAfter(config.count, config.current, command, config);
    if (target === undefined) return undefined;
    return {
      focusSelector: config.focusSelector(target),
      message: config.toMessage(target, command),
    };
  };
