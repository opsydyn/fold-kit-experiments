import type { DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';

// Validated frames contain JSON records plus optional properties that may be undefined.
type FrameValue =
  | null
  | undefined
  | boolean
  | number
  | string
  | readonly FrameValue[]
  | FrameRecord;
type FrameRecord = Readonly<{ [key: string]: FrameValue }>;

const record = (value: FrameValue): value is FrameRecord =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

function equal(previous: FrameValue, incoming: FrameValue): boolean {
  if (Object.is(previous, incoming)) return true;
  if (Array.isArray(previous) && Array.isArray(incoming))
    return (
      previous.length === incoming.length &&
      incoming.every((value, index) => equal(previous[index], value))
    );
  if (!record(previous) || !record(incoming)) return false;
  const keys = Object.keys(incoming);
  return (
    Object.keys(previous).length === keys.length &&
    keys.every((key) => Object.hasOwn(previous, key) && equal(previous[key], incoming[key]))
  );
}

function retain(previous: FrameValue, incoming: FrameValue): FrameValue {
  if (equal(previous, incoming)) return previous;
  if (Array.isArray(previous) && Array.isArray(incoming))
    return incoming.map((value, index) => retain(previous[index], value));
  if (!record(previous) || !record(incoming)) return incoming;
  // fromEntries preserves own JSON keys such as __proto__ as data properties.
  return Object.fromEntries(
    Object.entries(incoming).map(([key, value]) => [key, retain(previous[key], value)]),
  );
}

/** Pure structural sharing after frame validation; the entire incoming value remains authoritative. */
export function shareFrame(previous: DiagramFrame | null, incoming: DiagramFrame): DiagramFrame {
  // SAFETY: retain only substitutes an equal subtree, preserving the validated frame's complete value.
  return retain(previous, incoming) as DiagramFrame;
}
