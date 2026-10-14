/**
 * Intercepts the property Foldkit's CustomElement factory sets on every render, so a
 * Mount can see new values without an update hook (ADR-002).
 *
 * @module
 */

export type PropertyInterception = {
  /** The value present when interception began (set by the first render). */
  readonly initial: unknown;
  /** Restores a plain data property holding the latest value. */
  readonly restore: () => void;
};

/** Calls `onSet` for every assignment to `element[key]`. */
export const interceptProperty = (
  element: object,
  key: string,
  onSet: (value: unknown) => void,
): PropertyInterception => {
  const initial: unknown = Reflect.get(element, key);
  let current = initial;
  Object.defineProperty(element, key, {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value: unknown) => {
      current = value;
      onSet(value);
    },
  });
  return {
    initial,
    restore: () => {
      Object.defineProperty(element, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: current,
      });
    },
  };
};
