/**
 * A boolean read synchronously by DOM callbacks and written by Effect code.
 *
 * @module
 */

export type Latch = {
  readonly isOpen: () => boolean;
  readonly set: (open: boolean) => void;
};

export const createLatch = (open: boolean): Latch => {
  let current = open;
  return {
    isOpen: () => current,
    set: (next) => {
      current = next;
    },
  };
};

const nothing: ReadonlyArray<never> = [];

/** Calls `route` only while `latch` is open, returning what it routed (nothing when shut). */
export const routedWhileOpen =
  <A, B>(latch: Latch, route: (value: A) => ReadonlyArray<B>) =>
  (value: A): ReadonlyArray<B> => {
    if (!latch.isOpen()) return nothing;
    return route(value);
  };

/** A thunk calling `f(value)`, so Effect code can write `Effect.sync(applying(f, value))`. */
export const applying =
  <A, B>(f: (value: A) => B, value: A) =>
  (): B =>
    f(value);
