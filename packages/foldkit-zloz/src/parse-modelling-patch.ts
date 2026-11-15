import { ZlozError } from './graph';
import {
  captureModellingPatch,
  captureModellingPatchV2,
  type ZlozModellingPatchV2,
  modellingPatchLimits,
  PatchValidationError,
  type ZlozModellingPatch,
} from './modelling-patch';
import type { JsonValue, JsonObject } from './types';

/** Positive safe integer limits; omitted values use the existing v1 object caps. */
export type ZlozModellingPatchParseOptions = Readonly<{
  maxCharacters?: number;
  maxDepth?: number;
  maxValues?: number;
}>;
export type ZlozModellingPatchParseResult<P = ZlozModellingPatch> =
  | Readonly<{ status: 'parsed'; value: P }>
  | Readonly<{
      status: 'rejected';
      code:
        | 'invalid-json'
        | 'limit-exceeded'
        | 'unsupported-format'
        | 'unsupported-version'
        | 'invalid-patch';
      reason: string;
      path: string;
    }>;
type Rejected = Extract<ZlozModellingPatchParseResult, { status: 'rejected' }>;
const rejected = (code: Rejected['code'], reason: string, path = ''): Rejected => ({
  status: 'rejected',
  code,
  reason,
  path,
});
function limit(input: number | undefined, maximum: number, name: string): number {
  const value = input === undefined ? maximum : input;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new ZlozError('invalid-edit', `${name} must be an integer from 1 to ${maximum}.`);
  return value;
}
class PatchTextError extends Error {
  constructor(
    readonly code: Rejected['code'],
    message: string,
    readonly path: string,
  ) {
    super(message);
  }
}
const record = (value: JsonValue): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const digit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9';
const pointer = (path: string, key: string) =>
  path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
/** Bounded grammar/duplicate preflight. Native JSON.parse constructs the value only afterward. */
export function preflightPortableJson(text: string, maxDepth: number, maxValues: number): void {
  let i = 0,
    values = 0;
  let nonfinite: string | null = null;
  const fail = (path: string, message = 'Malformed modelling-patch JSON.'): never => {
    throw new PatchTextError('invalid-json', message, path);
  };
  const skip = () => {
    while (text[i] === ' ' || text[i] === '\t' || text[i] === '\r' || text[i] === '\n') i++;
  };
  const string = (path: string): string => {
    const start = i++;
    while (i < text.length) {
      const char = text[i++];
      if (char === '"') return text.slice(start, i);
      if (char === '\\') {
        const escaped = text[i++];
        if (escaped === 'u') {
          for (let n = 0; n < 4; n++) {
            const hex = text[i++];
            if (hex === undefined || !/[0-9a-fA-F]/u.test(hex))
              fail(path, 'Invalid JSON Unicode escape.');
          }
        } else if (
          escaped === undefined ||
          !['"', '\\', '/', 'b', 'f', 'n', 'r', 't'].includes(escaped)
        )
          fail(path, 'Invalid JSON escape.');
      } else if (char !== undefined && char.charCodeAt(0) < 32)
        fail(path, 'Unescaped control character in JSON string.');
    }
    return fail(path, 'Unterminated JSON string.');
  };
  const value = (depth: number, path: string): void => {
    if (depth > maxDepth)
      throw new PatchTextError(
        'limit-exceeded',
        'Modelling patch exceeds its JSON value-depth budget.',
        path,
      );
    if (++values > maxValues)
      throw new PatchTextError(
        'limit-exceeded',
        'Modelling patch exceeds its JSON value budget.',
        path,
      );
    skip();
    const char = text[i];
    if (char === '{') {
      i++;
      skip();
      const keys = new Set<string>();
      if (text[i] === '}') {
        i++;
        return;
      }
      while (i < text.length) {
        if (text[i] !== '"') fail(path, 'Expected a JSON property name.');
        const key: string = JSON.parse(string(path)),
          child = pointer(path, key);
        if (keys.has(key)) fail(child, 'Duplicate decoded JSON property names are not allowed.');
        keys.add(key);
        skip();
        if (text[i++] !== ':') fail(child, 'Expected a colon after JSON property name.');
        value(depth + 1, child);
        skip();
        const end = text[i++];
        if (end === '}') return;
        if (end !== ',') fail(path, 'Expected comma or closing object.');
        skip();
      }
      return fail(path, 'Unterminated JSON object.');
    }
    if (char === '[') {
      i++;
      skip();
      if (text[i] === ']') {
        i++;
        return;
      }
      let index = 0;
      while (i < text.length) {
        value(depth + 1, pointer(path, String(index++)));
        skip();
        const end = text[i++];
        if (end === ']') return;
        if (end !== ',') fail(path, 'Expected comma or closing array.');
        skip();
      }
      return fail(path, 'Unterminated JSON array.');
    }
    if (char === '"') {
      string(path);
      return;
    }
    for (const literal of ['true', 'false', 'null'])
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return;
      }
    const start = i;
    if (text[i] === '-') i++;
    if (text[i] === '0') i++;
    else {
      if (!digit(text[i])) return fail(path, 'Expected a JSON value.');
      while (digit(text[i])) i++;
    }
    if (text[i] === '.') {
      i++;
      if (!digit(text[i])) fail(path, 'JSON fraction requires digits.');
      while (digit(text[i])) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!digit(text[i])) fail(path, 'JSON exponent requires digits.');
      while (digit(text[i])) i++;
    }
    if (!Number.isFinite(Number(text.slice(start, i)))) nonfinite ??= path;
  };
  value(0, '');
  skip();
  if (i !== text.length) fail('', 'Expected exactly one JSON document.');
  if (nonfinite !== null)
    throw new PatchTextError('invalid-patch', 'Modelling patch numbers must be finite.', nonfinite);
}
/** Strict raw v1 proposal decoder. Does not dry-run, import, execute or grant Apply authority. */
function parsePatch<P>(
  text: string,
  options: ZlozModellingPatchParseOptions,
  version: 1 | 2,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- The injected version-specific capture validates the raw parsed proposal.
  capture: (input: unknown) => P,
): ZlozModellingPatchParseResult<P> {
  const maxCharacters = limit(
      options.maxCharacters,
      modellingPatchLimits.maxCharacters,
      'maxCharacters',
    ),
    maxDepth = limit(options.maxDepth, modellingPatchLimits.maxDepth, 'maxDepth'),
    maxValues = limit(options.maxValues, modellingPatchLimits.maxValues, 'maxValues');
  if (text.length > maxCharacters)
    return rejected('limit-exceeded', 'Modelling patch exceeds its text character budget.');
  // oxlint-disable-next-line linteffect/no-try-catch -- Dependency-free text boundary translates bounded scanner/native/domain rejections into data.
  try {
    preflightPortableJson(text, maxDepth, maxValues);
    const value: JsonValue = JSON.parse(text);
    if (!record(value)) return rejected('invalid-patch', 'Modelling patch must be an object.');
    if (value.format !== 'foldkit-zloz-patch')
      return rejected('unsupported-format', 'Expected foldkit-zloz-patch format.', '/format');
    if (value.version !== version)
      return rejected(
        'unsupported-version',
        `Expected modelling-patch version ${version}.`,
        '/version',
      );
    if (
      Array.isArray(value.operations) &&
      value.operations.length > modellingPatchLimits.maxOperations
    )
      return rejected('limit-exceeded', 'Modelling patch exceeds 1000 operations.', '/operations');
    return { status: 'parsed', value: capture(value) };
  } catch (error) {
    if (error instanceof PatchTextError) return rejected(error.code, error.message, error.path);
    if (error instanceof SyntaxError)
      return rejected('invalid-json', 'Malformed modelling-patch JSON.');
    if (error instanceof ZlozError)
      return rejected(
        'invalid-patch',
        error.message,
        error instanceof PatchValidationError ? error.path : '',
      );
    throw error;
  }
}

export function parseModellingPatch(
  text: string,
  options: ZlozModellingPatchParseOptions = {},
): ZlozModellingPatchParseResult {
  return parsePatch(text, options, 1, captureModellingPatch);
}
export function parseModellingPatchV2(
  text: string,
  options: ZlozModellingPatchParseOptions = {},
): ZlozModellingPatchParseResult<ZlozModellingPatchV2> {
  return parsePatch(text, options, 2, captureModellingPatchV2);
}

/** @internal Shared bounded evidence JSON reader; receipt decoders retain their own strict schemas. */
export function readPortableEvidenceJson(text: string): JsonValue {
  if (text.length > modellingPatchLimits.maxCharacters)
    throw new ZlozError('invalid-edit', 'Portable evidence exceeds its character budget.');
  // oxlint-disable-next-line linteffect/no-try-catch -- Normalize scanner/native syntax errors at the evidence boundary.
  try {
    preflightPortableJson(text, modellingPatchLimits.maxDepth, modellingPatchLimits.maxValues);
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof PatchTextError || error instanceof SyntaxError)
      throw new ZlozError('invalid-edit', error.message);
    throw error;
  }
}
