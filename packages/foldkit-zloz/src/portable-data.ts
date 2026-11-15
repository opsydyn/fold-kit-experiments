import { ZlozError } from './graph';
import type { JsonValue } from './types';
export const portableDataLimits = Object.freeze({
  maxCharacters: 2000000,
  maxDepth: 64,
  maxValues: 100000,
});
export type PortableDataLimits = Readonly<{
  maxCharacters: number;
  maxDepth: number;
  maxValues: number;
}>;
export class PortableDataError extends ZlozError {
  constructor(
    readonly reasonCode: 'invalid-data' | 'limit-exceeded',
    message: string,
    readonly path: string,
  ) {
    super('invalid-edit', message);
  }
}
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-runtime-typeof -- This bounded data ownership routine rejects accessors/prototypes before observing external values. */
export function ownPortableData(
  input: unknown,
  limits: PortableDataLimits = portableDataLimits,
  label = 'Patch',
): JsonValue {
  function fail(
    path: string,
    message: string,
    code: 'invalid-data' | 'limit-exceeded' = 'invalid-data',
  ): never {
    throw new PortableDataError(
      code,
      message
        .replace(/^Patch/u, label)
        .replaceAll('2000000', String(limits.maxCharacters))
        .replaceAll('100000', String(limits.maxValues))
        .replace(/\b64\b/gu, String(limits.maxDepth)),
      path,
    );
  }
  let count = 0,
    characters = 0;
  const ancestors = new Set<object>();
  const visit = (v: unknown, depth: number, path: string): JsonValue => {
    if (++count > limits.maxValues || depth > limits.maxDepth)
      fail(path, 'Patch exceeds 100000 JSON values or depth 64.', 'limit-exceeded');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      characters += v.length;
      if (characters > limits.maxCharacters)
        fail(path, 'Patch exceeds 2000000 characters of string/key content.', 'limit-exceeded');
      return v;
    }
    if (typeof v !== 'object' || v === null || ancestors.has(v))
      fail(path, 'Patch requires finite, acyclic plain JSON data.');
    if (
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) !== Object.prototype &&
      Object.getPrototypeOf(v) !== null
    )
      fail(path, 'Patch requires plain JSON objects.');
    const keys = Reflect.ownKeys(v);
    if (keys.some((k) => typeof k !== 'string'))
      fail(path, 'Patch cannot contain symbol properties.');
    ancestors.add(v);
    if (Array.isArray(v)) {
      if (Object.getPrototypeOf(v) !== Array.prototype)
        fail(path, 'Patch requires plain JSON arrays.');
      if (v.length > limits.maxValues)
        fail(path, 'Patch arrays exceed 100000 JSON values.', 'limit-exceeded');
      if (keys.length !== v.length + 1)
        fail(path, 'Patch arrays must be dense and contain only indexed values.');
      const result: JsonValue[] = [];
      for (let i = 0; i < v.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
          fail(path, 'Patch arrays cannot contain accessors or holes.');
        result.push(visit(descriptor.value, depth + 1, `${path}/${i}`));
      }
      ancestors.delete(v);
      return Object.freeze(result);
    }
    const entries: [string, JsonValue][] = [];
    for (const key of keys) {
      if (typeof key !== 'string') fail(path, 'Patch cannot contain symbols.');
      const descriptor = Object.getOwnPropertyDescriptor(v, key);
      if (!descriptor?.enumerable || !('value' in descriptor))
        fail(path, 'Patch cannot contain accessors or non-enumerable fields.');
      characters += key.length;
      if (characters > limits.maxCharacters)
        fail(path, 'Patch exceeds 2000000 characters of string/key content.', 'limit-exceeded');
      entries.push([
        key,
        visit(
          descriptor.value,
          depth + 1,
          `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
        ),
      ]);
    }
    ancestors.delete(v);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.freeze(Object.fromEntries(entries));
  };
  return visit(input, 0, '');
}
