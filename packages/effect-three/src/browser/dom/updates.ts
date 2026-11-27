/**
 * What follows a scene update in the DOM.
 *
 * @module
 */

/** After an update: report it, then run each follow-up step in order. */
export const afterUpdate =
  <A>(report: (value: A) => () => void, steps: ReadonlyArray<() => void>) =>
  (value: A) =>
  (): void => {
    report(value)();
    for (const step of steps) step();
  };
