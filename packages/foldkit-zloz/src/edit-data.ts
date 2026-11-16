import { ZlozError } from './graph';
import { ownPortableData } from './portable-data';
import type { Endpoint, JsonValue, JsonObject, Point, Size } from './types';
/** @internal Guards consume already-owned bounded data; no accessors can be evaluated. */
export const editRecord = (value: JsonValue | undefined): value is JsonObject =>
  value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value);
export const editIdentifier = (value: JsonValue | undefined): value is string =>
  typeof value === 'string' && value.length > 0;
export const editNumber = (value: JsonValue | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const editFields = (
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[] = [],
) =>
  required.every((key) => Object.hasOwn(value, key)) &&
  Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
export const editEndpoint = (value: JsonValue | undefined): value is Endpoint =>
  editRecord(value) &&
  editFields(value, ['node', 'port']) &&
  editIdentifier(value.node) &&
  editIdentifier(value.port);
export const editPoint = (value: JsonValue | undefined): value is Point =>
  editRecord(value) && editFields(value, ['x', 'y']) && editNumber(value.x) && editNumber(value.y);
export const editSize = (value: JsonValue | undefined): value is Size =>
  editRecord(value) &&
  editFields(value, ['width', 'height']) &&
  editNumber(value.width) &&
  value.width > 0 &&
  editNumber(value.height) &&
  value.height > 0;
/** @internal Exact versioned edit ownership; complete target validation remains mandatory. */
export function ownEditorEdit<E>(
  input: E,
  guard: (value: JsonValue) => value is JsonValue & E,
  label: string,
): E {
  const value = ownPortableData(input, undefined, label);
  if (!guard(value)) throw new ZlozError('invalid-edit', `Invalid ${label}.`);
  return value;
}
