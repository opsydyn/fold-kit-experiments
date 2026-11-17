/**
 * Inputs (ADR 0110): ```input fences a reader changes, the values a plot spec refers to
 * with `{ "input": "name" }`, and `where`, which keeps the rows a chart draws. Pure and
 * browser-safe: the build checks with it, and the page's script draws with it.
 * @module Inputs
 */
import { Result, Schema } from 'effect';

import type { Json, JsonObject, Rows } from './rows';

/** A value an input can hold. */
export const Choice = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean]);
export type Choice = typeof Choice.Type;

/** An input's value: a choice, or `null` for a select's or radio's `all`. */
export const InputValue = Schema.NullOr(Choice);
export type InputValue = typeof InputValue.Type;

const Name = Schema.String.check(Schema.isPattern(/^[A-Za-z_][\w-]*$/));

const Label = Schema.optionalKey(Schema.String);

/** Choices listed, or every value of a field in a data file or loader's output. */
const FromData = Schema.Struct({ data: Schema.String, field: Schema.String });

/** An ```input fence, as written. */
export const InputFence = Schema.Union([
  Schema.Struct({
    type: Schema.Literals(['select', 'radio']),
    name: Name,
    label: Label,
    options: Schema.Union([Schema.Array(Choice), FromData]),
    /** A first choice meaning "no filter", labelled with this text. */
    all: Schema.optionalKey(Schema.String),
    value: Schema.optionalKey(InputValue),
  }),
  Schema.Struct({
    type: Schema.Literal('range'),
    name: Name,
    label: Label,
    min: Schema.Finite,
    max: Schema.Finite,
    step: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThan(0))),
    value: Schema.optionalKey(Schema.Finite),
  }),
  Schema.Struct({
    type: Schema.Literal('checkbox'),
    name: Name,
    label: Label,
    value: Schema.optionalKey(Schema.Boolean),
  }),
]);
export type InputFence = typeof InputFence.Type;

/** An input with its choices known and its default chosen: what a page's script needs. */
export const Input = Schema.Union([
  Schema.TaggedStruct('Choose', {
    style: Schema.Literals(['select', 'radio']),
    name: Schema.String,
    label: Schema.String,
    choices: Schema.Array(Choice),
    all: Schema.NullOr(Schema.String),
    value: InputValue,
  }),
  Schema.TaggedStruct('Range', {
    name: Schema.String,
    label: Schema.String,
    min: Schema.Finite,
    max: Schema.Finite,
    step: Schema.Finite,
    value: Schema.Finite,
  }),
  Schema.TaggedStruct('Toggle', {
    name: Schema.String,
    label: Schema.String,
    value: Schema.Boolean,
  }),
]);
export type Input = typeof Input.Type;

/** Every input's current value, by name. */
export const Values = Schema.Record(Schema.String, InputValue);
export type Values = typeof Values.Type;

const decodeFence = Schema.decodeUnknownResult(Schema.fromJsonString(InputFence));

const isText = Schema.is(Schema.String);
const isFromData = Schema.is(FromData);

/** A choice as messages and labels show it: strings quoted. */
export const shown = (value: InputValue): string =>
  value === null ? 'all' : isText(value) ? JSON.stringify(value) : String(value);

/** Every distinct value of `field`, in the order they first appear, or why not. */
const valuesOf = (
  rows: Rows,
  field: string,
  from: string,
): Result.Result<ReadonlyArray<Choice>, string> => {
  if (!rows.some((row) => field in row)) {
    return Result.fail(`options.field: field "${field}" is missing from ${from}`);
  }
  const seen = new Set<Choice>();
  for (const row of rows) {
    const value = row[field];
    if (value !== null && value !== undefined) seen.add(value);
  }
  return Result.succeed([...seen]);
};

type FenceOf<T extends InputFence['type']> = Extract<InputFence, { readonly type: T }>;

const chooser = (
  fence: FenceOf<'select' | 'radio'>,
  choices: ReadonlyArray<Choice>,
): Result.Result<Input, string> => {
  if (choices.length === 0) return Result.fail('options: an input needs at least one choice');
  const all = fence.all ?? null;
  const value =
    fence.value === undefined ? (all === null ? (choices[0] ?? null) : null) : fence.value;
  if (value === null && all === null) {
    return Result.fail('value: null means "all", so give the input an `all` label');
  }
  if (value !== null && !choices.includes(value)) {
    return Result.fail(`value: ${shown(value)} is not one of the options`);
  }
  return Result.succeed({
    _tag: 'Choose',
    style: fence.type,
    name: fence.name,
    label: fence.label ?? fence.name,
    choices,
    all,
    value,
  });
};

const ranger = (fence: FenceOf<'range'>): Result.Result<Input, string> => {
  if (!(fence.min < fence.max)) return Result.fail('min: must be less than max');
  const value = fence.value ?? fence.min;
  if (value < fence.min || value > fence.max) {
    return Result.fail(`value: ${value} is outside ${fence.min} to ${fence.max}`);
  }
  return Result.succeed({
    _tag: 'Range',
    name: fence.name,
    label: fence.label ?? fence.name,
    min: fence.min,
    max: fence.max,
    step: fence.step ?? 1,
    value,
  });
};

/**
 * An input fence read: decoded, its choices found (from `read` when they come from
 * data), and its default checked. Fails with a message naming the field at fault.
 */
export const readInput = (
  source: string,
  read: (name: string) => Result.Result<Rows, string>,
): Result.Result<Input, string> => {
  const decoded = decodeFence(source);
  if (Result.isFailure(decoded)) return Result.fail(decoded.failure.message);
  const fence = decoded.success;
  if (fence.type === 'range') return ranger(fence);
  if (fence.type === 'checkbox') {
    return Result.succeed({
      _tag: 'Toggle',
      name: fence.name,
      label: fence.label ?? fence.name,
      value: fence.value ?? false,
    });
  }
  const options = fence.options;
  if (!isFromData(options)) return chooser(fence, options);
  const fromData = options;
  return Result.flatMap(
    Result.flatMap(read(fromData.data), (rows) => valuesOf(rows, fromData.field, fromData.data)),
    (choices) => chooser(fence, choices),
  );
};

/** The defaults of `inputs`, by name. */
export const defaultsOf = (inputs: ReadonlyArray<Input>): Values =>
  Object.fromEntries(inputs.map((input) => [input.name, input.value]));

/** Every value an input can take: each choice (and `all`), both ends of a range, both states. */
export const choicesOf = (input: Input): ReadonlyArray<InputValue> => {
  if (input._tag === 'Choose') return input.all === null ? input.choices : [null, ...input.choices];
  if (input._tag === 'Toggle') return [false, true];
  return [...new Set([input.min, input.value, input.max])];
};

const isObject = (json: Json): json is JsonObject =>
  json !== null && typeof json === 'object' && !Array.isArray(json);

/** `{ "input": "name" }`, and nothing else: a reference to an input. */
const referenceOf = (json: Json): string | undefined => {
  if (!isObject(json)) return undefined;
  const keys = Object.keys(json);
  const name = json['input'];
  return keys.length === 1 && isText(name) ? name : undefined;
};

/** Every input a spec refers to, in order, once each. */
export const referencesIn = (json: Json): ReadonlyArray<string> => {
  const found = new Set<string>();
  const visit = (node: Json): void => {
    const name = referenceOf(node);
    if (name !== undefined) found.add(name);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (isObject(node)) Object.values(node).forEach(visit);
  };
  visit(json);
  return [...found];
};

/** A spec with every `{ "input": name }` replaced by that input's value. */
export const withValues = (json: Json, values: Values): Json => {
  const name = referenceOf(json);
  if (name !== undefined) return values[name] ?? null;
  if (Array.isArray(json)) return json.map((node) => withValues(node, values));
  if (isObject(json)) {
    return Object.fromEntries(
      Object.entries(json).map(([key, node]) => [key, withValues(node, values)]),
    );
  }
  return json;
};

/** Whether a row's value meets a condition: equal to it, or between `min` and `max`. */
const meets = (value: Json | undefined, condition: Json): boolean => {
  if (condition === null) return true;
  if (!isObject(condition)) return value === condition;
  const { min = null, max = null } = condition;
  if (value === null || value === undefined) return false;
  return (min === null || value >= min) && (max === null || value <= max);
};

/**
 * The rows `where` keeps: for each field, rows whose value equals the condition, or
 * lies between its `min` and `max` (inclusive). A `null` condition (an input at `all`)
 * keeps every row. Fails naming a field no row has.
 */
export const filterRows = (rows: Rows, where: Json): Result.Result<Rows, string> => {
  if (where === null || where === undefined) return Result.succeed(rows);
  if (!isObject(where)) return Result.fail('where: give an object of field conditions');
  const missing = Object.keys(where).find((field) => !rows.some((row) => field in row));
  if (missing !== undefined) {
    return Result.fail(`where.${missing}: field "${missing}" is missing from the data`);
  }
  const conditions = Object.entries(where);
  return Result.succeed(
    rows.filter((row) => conditions.every(([field, test]) => meets(row[field], test))),
  );
};
