import { ZlozError } from './graph';
import {
  captureModellingPatch,
  captureModellingPatchV2,
  captureModellingPatchV3,
  type ZlozModellingPatchV3,
  type ZlozModellingPatchV2,
  modellingPatchLimits,
  PatchValidationError,
  type ZlozModellingPatch,
} from './modelling-patch';
import { preflightPortableJson as scanPortableJson, PortableJsonError } from './portable-json';
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
/** Bounded grammar/duplicate preflight retaining the legacy patch error contract. */
export function preflightPortableJson(text: string, maxDepth: number, maxValues: number): void {
  // oxlint-disable-next-line linteffect/no-try-catch -- Preserve the version-fixed patch scanner error codes at this existing boundary.
  try {
    scanPortableJson(text, maxDepth, maxValues);
  } catch (error) {
    if (error instanceof PortableJsonError)
      throw new PatchTextError(
        error.code === 'invalid-data' ? 'invalid-patch' : error.code,
        error.message,
        error.path,
      );
    throw error;
  }
}
/** Strict raw v1 proposal decoder. Does not dry-run, import, execute or grant Apply authority. */
function parsePatch<P>(
  text: string,
  options: ZlozModellingPatchParseOptions,
  version: 1 | 2 | 3,
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

export function parseModellingPatchV3(
  text: string,
  options: ZlozModellingPatchParseOptions = {},
): ZlozModellingPatchParseResult<ZlozModellingPatchV3> {
  return parsePatch(text, options, 3, captureModellingPatchV3);
}
