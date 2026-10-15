/**
 * Runs an assertion-style property. Kept out of Effect-importing modules so plain
 * control flow stays available to property bodies.
 */
export function holds<A>(property: (value: A) => void, value: A): true {
  property(value);
  return true;
}

/** Throws `error`. Lets Effect-importing test modules raise without statements. */
export function raise(error: unknown): never {
  throw error;
}
