import { Option } from 'effect';
import type { KeyboardModifiers } from 'foldkit/html';

import { chartCommandOf, targetAfter } from '../interaction/keyboard.js';
import type { ChartCommand, ChartKeyOptions, TargetOptions } from '../interaction/keyboard.js';

/**
 * FoldKit handlers for chart keyboard navigation. Both read keys through the
 * framework-free `interaction/keyboard` contract; the parent keeps the active
 * target in its Model.
 */

/**
 * For `OnKeyDownPreventDefault`: the message a chart key produces, or none, so
 * keys a chart does not use keep their default behaviour.
 */
export const chartKeyDown =
  <M>(toMessage: (command: ChartCommand) => M, options: ChartKeyOptions = {}) =>
  (key: string, modifiers: KeyboardModifiers): Option.Option<M> => {
    const command = chartCommandOf(key, modifiers, options);
    return command === undefined ? Option.none() : Option.some(toMessage(command));
  };

export type ChartFocusConfig<M> = Readonly<{
  /** How many targets there are, in reading order. */
  count: number;
  /** The active target, if any. */
  current: number | undefined;
  /** A selector for the element to focus for a target, for roving focus. */
  focusSelector: (target: number) => string;
  /** The message for the target a key leads to; none when it clears. */
  toMessage: (target: number | undefined, command: ChartCommand) => M;
}> &
  ChartKeyOptions &
  TargetOptions;

/**
 * For `OnKeyDownFocus`: moves focus to the element of the target a key leads
 * to (roving focus, for charts whose targets are focusable elements) and sends
 * the matching message. Clearing keeps focus where it is.
 */
export const chartKeyDownFocus =
  <M>(config: ChartFocusConfig<M>) =>
  (
    key: string,
    modifiers: KeyboardModifiers,
  ): Option.Option<Readonly<{ focusSelector: string; message: M }>> => {
    const command = chartCommandOf(key, modifiers, config);
    if (command === undefined) return Option.none();
    const target = targetAfter(config.count, config.current, command, config);
    if (target === undefined) return Option.none();
    return Option.some({
      focusSelector: config.focusSelector(target),
      message: config.toMessage(target, command),
    });
  };
