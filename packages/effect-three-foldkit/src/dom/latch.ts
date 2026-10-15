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

/** Calls `f` only while `latch` is open. */
export const whileOpen =
  <A>(latch: Latch, f: (value: A) => void) =>
  (value: A): void => {
    if (latch.isOpen()) f(value);
  };

/** A thunk calling `f(value)`, so Effect code can write `Effect.sync(applying(f, value))`. */
export const applying =
  <A, B>(f: (value: A) => B, value: A) =>
  (): B =>
    f(value);
