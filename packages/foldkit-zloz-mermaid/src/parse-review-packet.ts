import {
  parseSnapshot,
  parseConnectionDocument,
  type ZlozSnapshot,
  ZlozError,
  type ZlozRelationshipAuditSource,
  type JsonValue,
  type JsonObject,
} from '@opsydyn/foldkit-zloz';

import {
  createReviewPacket,
  isReviewPacketOptions,
  type ZlozReviewPacketOptions,
  type ZlozReviewPacket,
} from './review-packet';
import { createReviewPacketV2, type ZlozReviewPacketV2 } from './review-packet-v2';
export type ZlozReviewPacketParseOptions = Readonly<{
  maxCharacters?: number;
  maxDepth?: number;
  maxValues?: number;
}>;
export type ZlozReviewPacketParseResult<P = ZlozReviewPacket> =
  | Readonly<{ status: 'parsed'; value: P }>
  | Readonly<{
      status: 'rejected';
      code:
        | 'invalid-json'
        | 'limit-exceeded'
        | 'unsupported-format'
        | 'unsupported-version'
        | 'invalid-packet'
        | 'inconsistent-packet';
      reason: string;
      path: string;
    }>;
type Rejected = Extract<ZlozReviewPacketParseResult, { status: 'rejected' }>;
const rejected = (code: Rejected['code'], reason: string, path = ''): Rejected => ({
  status: 'rejected',
  code,
  reason,
  path,
});
const container = (value: JsonValue | undefined): value is JsonObject | readonly JsonValue[] =>
  typeof value === 'object' && value !== null;
const numeric = (value: JsonValue | undefined): value is number => typeof value === 'number';
const record = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const stringValue = (value: JsonValue | undefined): value is string => typeof value === 'string';
const nonblank = (value: JsonValue | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const fields = (value: JsonObject, names: readonly string[]) =>
  Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name));
function limit(value: number | undefined, fallback: number, maximum: number, name: string) {
  const chosen = value ?? fallback;
  if (!Number.isSafeInteger(chosen) || chosen < 1 || chosen > maximum)
    throw new ZlozError('invalid-edit', `${name} must be an integer from 1 to ${maximum}.`);
  return chosen;
}
/** Scan before JSON.parse so nested input cannot evade the depth limit or hide duplicate keys. */
function scan(text: string, maxDepth: number): Rejected | null {
  const stack: (Set<string> | null)[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i += 2;
        else i++;
      }
      if (i >= text.length) return rejected('invalid-json', 'Unterminated JSON string.');
      let next = i + 1;
      while (next < text.length && /\s/u.test(text[next] ?? '')) next++;
      const keys = stack[stack.length - 1];
      if (text[next] === ':' && keys) {
        const key: JsonValue = JSON.parse(text.slice(start, i + 1));
        if (!stringValue(key)) return rejected('invalid-json', 'Invalid JSON property name.');
        if (keys.has(key))
          return rejected('invalid-json', 'Duplicate JSON property names are not allowed.');
        keys.add(key);
      }
    } else if (char === '{' || char === '[') {
      stack.push(char === '{' ? new Set<string>() : null);
      if (stack.length > maxDepth)
        return rejected('limit-exceeded', 'Review packet exceeds its JSON nesting budget.');
    } else if (char === '}' || char === ']') stack.pop();
  }
  return null;
}
function mismatch(a: JsonValue, b: JsonValue): string | null {
  const pending: { a: JsonValue; b: JsonValue; path: string }[] = [{ a, b, path: '' }];
  while (pending.length) {
    const item = pending.pop();
    if (!item) continue;
    if (item.a === item.b) continue;
    if (Array.isArray(item.a) && Array.isArray(item.b)) {
      if (item.a.length !== item.b.length) return item.path;
      for (let i = item.a.length - 1; i >= 0; i--)
        pending.push({ a: item.a[i] ?? null, b: item.b[i] ?? null, path: `${item.path}/${i}` });
    } else if (record(item.a) && record(item.b)) {
      const ak = Object.keys(item.a).sort(),
        bk = Object.keys(item.b).sort();
      if (ak.length !== bk.length || ak.some((key, i) => key !== bk[i])) return item.path;
      for (let i = ak.length - 1; i >= 0; i--) {
        const key = ak[i];
        if (key !== undefined)
          pending.push({
            a: item.a[key] ?? null,
            b: item.b[key] ?? null,
            path: `${item.path}/${key.replace(/~/gu, '~0').replace(/\//gu, '~1')}`,
          });
      }
    } else return item.path;
  }
  return null;
}
function source(value: JsonValue | undefined): ZlozRelationshipAuditSource | null {
  if (!record(value)) return null;
  if (value.kind === 'current' && fields(value, ['kind'])) return { kind: 'current' };
  if (
    value.kind === 'edition' &&
    fields(value, ['kind', 'id', 'name']) &&
    nonblank(value.id) &&
    nonblank(value.name)
  )
    return { kind: 'edition', id: value.id, name: value.name };
  return null;
}
function freeze<P extends object>(packet: P): P {
  const pending: object[] = [packet],
    seen = new Set<object>();
  while (pending.length) {
    const value = pending.pop();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    for (const child of Object.values(value)) if (container(child)) pending.push(child);
    Object.freeze(value);
  }
  return packet;
}
/** Strict v1 data reopening. Recomputes audit/projections; grants no model import, execution or editing authority. */
type ReviewModel<S extends ZlozSnapshot> = Readonly<{
  id: string;
  name: string;
  origin: null;
  snapshot: S;
  editions: readonly Readonly<{ id: string; name: string; snapshot: S }>[];
}>;
/** @internal Shared JSON budgets, also checked before publishing generated native packets. */
export function decodeReviewJson(
  text: string,
  options: ZlozReviewPacketParseOptions = {},
): Readonly<{ status: 'decoded'; value: JsonValue }> | Rejected {
  const maxCharacters = limit(options.maxCharacters, 2000000, 16000000, 'maxCharacters'),
    maxDepth = limit(options.maxDepth, 64, 128, 'maxDepth'),
    maxValues = limit(options.maxValues, 100000, 1000000, 'maxValues');
  if (text.length > maxCharacters)
    return rejected('limit-exceeded', 'Review packet exceeds its character budget.');
  let value: JsonValue;
  // oxlint-disable-next-line linteffect/no-try-catch -- Peer-free JSON boundary reports syntax/duplicate-key errors as data.
  try {
    const failure = scan(text, maxDepth);
    if (failure) return failure;
    value = JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError)
      return rejected('invalid-json', 'Malformed review-packet JSON.');
    throw error;
  }
  const pending: JsonValue[] = [value];
  let count = 0;
  while (pending.length) {
    const node = pending.pop();
    if (++count > maxValues)
      return rejected('limit-exceeded', 'Review packet exceeds its JSON value budget.');
    if (numeric(node) && !Number.isFinite(node))
      return rejected('invalid-packet', 'Review packet numbers must be finite.');
    if (container(node)) {
      const children = Object.values(node);
      if (count + pending.length + children.length > maxValues)
        return rejected('limit-exceeded', 'Review packet exceeds its JSON value budget.');
      for (const child of children) pending.push(child);
    }
  }
  return { status: 'decoded', value };
}
function parsePacket<S extends ZlozSnapshot, P extends object>(
  text: string,
  options: ZlozReviewPacketParseOptions,
  version: 1 | 2,
  snapshot: (value: JsonObject) => S,
  create: (
    document: ReviewModel<S>,
    selection: { baselineId: string; selectedId?: string },
    options: ZlozReviewPacketOptions,
  ) => Readonly<{ status: 'created'; value: P }> | Readonly<{ status: 'rejected' }>,
): ZlozReviewPacketParseResult<P> {
  const decoded = decodeReviewJson(text, options);
  if (decoded.status === 'rejected') return decoded;
  const value = decoded.value;
  if (!record(value)) return rejected('invalid-packet', 'Review packet must be an object.');
  if (value.format !== 'foldkit-zloz-review')
    return rejected('unsupported-format', 'Expected foldkit-zloz-review format.', '/format');
  if (value.version !== version)
    return rejected(
      'unsupported-version',
      `Expected review packet version ${version}.`,
      '/version',
    );
  if (
    !fields(value, [
      'format',
      'version',
      'scope',
      'model',
      'baseline',
      'selected',
      'conventions',
      'comparison',
      'projectionOptions',
      'projections',
      'diagnostics',
    ]) ||
    value.scope !== 'selected-snapshots'
  )
    return rejected('invalid-packet', 'Invalid review-packet envelope or scope.');
  if (
    !record(value.model) ||
    !fields(value.model, ['id', 'name']) ||
    !nonblank(value.model.id) ||
    !nonblank(value.model.name)
  )
    return rejected('invalid-packet', 'Invalid model identity.', '/model');
  if (
    !record(value.baseline) ||
    !record(value.selected) ||
    !fields(value.baseline, ['source', 'snapshot']) ||
    !fields(value.selected, ['source', 'snapshot'])
  )
    return rejected('invalid-packet', 'Invalid review sides.');
  const baseline = source(value.baseline.source),
    selected = source(value.selected.source);
  if (baseline?.kind !== 'edition' || !selected)
    return rejected(
      'invalid-packet',
      'Baseline must identify an edition and both sources must be explicit.',
    );
  const conventions = value.conventions,
    projectionOptions = value.projectionOptions;
  if (
    !record(conventions) ||
    !fields(conventions, ['source', 'roleInterpretation', 'rules']) ||
    (conventions.source !== 'builtin' && conventions.source !== 'custom') ||
    conventions.roleInterpretation !== 'zloz-event-storming/v1' ||
    !Array.isArray(conventions.rules)
  )
    return rejected(
      'invalid-packet',
      'Unsupported or malformed convention contract.',
      '/conventions',
    );
  if (!record(projectionOptions) || !fields(projectionOptions, ['direction', 'lossPolicy']))
    return rejected(
      'invalid-packet',
      'Explicit projection options are required.',
      '/projectionOptions',
    );
  const creationOptions =
    conventions.source === 'custom'
      ? { ...projectionOptions, rules: conventions.rules }
      : projectionOptions;
  if (!isReviewPacketOptions(creationOptions))
    return rejected('invalid-packet', 'Invalid projection options or data-only rule catalogue.');
  // oxlint-disable-next-line linteffect/no-try-catch -- Existing core validators reject malformed authored data; no host I/O or live editor is involved.
  try {
    if (!record(value.baseline.snapshot) || !record(value.selected.snapshot))
      return rejected('invalid-packet', 'Snapshots must be objects.');
    const before = snapshot(value.baseline.snapshot),
      after = snapshot(value.selected.snapshot);
    if (
      selected.kind === 'edition' &&
      selected.id === baseline.id &&
      (selected.name !== baseline.name ||
        mismatch(value.baseline.snapshot, value.selected.snapshot) !== null)
    )
      return rejected(
        'invalid-packet',
        'One edition identity cannot name conflicting snapshots.',
        '/selected',
      );
    const document: ReviewModel<S> = {
      id: value.model.id,
      name: value.model.name,
      origin: null,
      snapshot: after,
      editions: [
        { id: baseline.id, name: baseline.name, snapshot: before },
        ...(selected.kind === 'edition' && selected.id !== baseline.id
          ? [{ id: selected.id, name: selected.name, snapshot: after }]
          : []),
      ],
    };
    const result = create(
      document,
      selected.kind === 'edition'
        ? { baselineId: baseline.id, selectedId: selected.id }
        : { baselineId: baseline.id },
      creationOptions,
    );
    if (result.status === 'rejected')
      return rejected(
        'invalid-packet',
        'Snapshots, conventions or projection policy cannot produce a valid review packet.',
      );
    const canonical: JsonValue = JSON.parse(JSON.stringify(result.value));
    const path = mismatch(value, canonical);
    if (path !== null)
      return rejected(
        'inconsistent-packet',
        'Packet content differs from its recomputed snapshots, audit, conventions or projections.',
        path,
      );
    return { status: 'parsed', value: freeze(result.value) };
  } catch (error) {
    if (error instanceof ZlozError) return rejected('invalid-packet', error.message);
    throw error;
  }
}

export function parseReviewPacket(
  text: string,
  options: ZlozReviewPacketParseOptions = {},
): ZlozReviewPacketParseResult {
  return parsePacket(
    text,
    options,
    1,
    (value) => parseSnapshot(JSON.stringify({ version: 1, ...value })),
    createReviewPacket,
  );
}
export function parseReviewPacketV2(
  text: string,
  options: ZlozReviewPacketParseOptions = {},
): ZlozReviewPacketParseResult<ZlozReviewPacketV2> {
  return parsePacket(
    text,
    options,
    2,
    (value) => parseConnectionDocument(JSON.stringify(value)),
    createReviewPacketV2,
  );
}
