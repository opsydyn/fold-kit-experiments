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

/** One end of a span: a number, or an ISO date. */
export const End = Schema.Union([Schema.Finite, Schema.String]);
export type End = typeof End.Type;

/** A `between` input's value (ADR 0119): from `min` to `max`, both included. */
export const Span = Schema.Struct({ min: End, max: End });
export type Span = typeof Span.Type;

/**
 * An input's value: a choice, `null` for a select's or radio's `all`, or the choices a
 * reader ticked in a group of checkboxes (ADR 0117).
 */
export const InputValue = Schema.Union([Schema.NullOr(Choice), Schema.Array(Choice), Span]);
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
    value: Schema.optionalKey(Schema.NullOr(Choice)),
  }),
  Schema.Struct({
    type: Schema.Literal('checkboxes'),
    name: Name,
    label: Label,
    options: Schema.Union([Schema.Array(Choice), FromData]),
    /** The choices ticked at first; every one when not given. */
    value: Schema.optionalKey(Schema.Array(Choice)),
  }),
  Schema.Struct({
    type: Schema.Literal('between'),
    name: Name,
    label: Label,
    /** The ends, numbers or ISO dates; or every value of a data field, its least and greatest. */
    min: Schema.optionalKey(End),
    max: Schema.optionalKey(End),
    options: Schema.optionalKey(FromData),
    step: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThan(0))),
    /** The span chosen at first; the whole of it when not given. */
    value: Schema.optionalKey(Span),
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
    value: Schema.NullOr(Choice),
  }),
  Schema.TaggedStruct('Pick', {
    name: Schema.String,
    label: Schema.String,
    choices: Schema.Array(Choice),
    value: Schema.Array(Choice),
  }),
  Schema.TaggedStruct('Between', {
    name: Schema.String,
    label: Schema.String,
    kind: Schema.Literals(['number', 'date']),
    min: End,
    max: End,
    step: Schema.Finite,
    value: Span,
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

const isChoices = Schema.is(Schema.Array(Choice));
const isSpan = Schema.is(Span);
const isEnd = Schema.is(Schema.Finite);
const isoDay = /^\d{4}-\d{2}-\d{2}/;

/** A choice as messages and labels show it: strings quoted, a list in brackets. */
export const shown = (value: InputValue): string => {
  if (isSpan(value)) return `${String(value.min)} to ${String(value.max)}`;
  if (isChoices(value)) return value.length === 0 ? 'none' : `[${value.map(shown).join(', ')}]`;
  return value === null ? 'all' : isText(value) ? JSON.stringify(value) : String(value);
};

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

const picker = (
  fence: FenceOf<'checkboxes'>,
  choices: ReadonlyArray<Choice>,
): Result.Result<Input, string> => {
  if (choices.length === 0) return Result.fail('options: an input needs at least one choice');
  const ticked = fence.value ?? choices;
  const stray = ticked.find((each) => !choices.includes(each));
  if (stray !== undefined) return Result.fail(`value: ${shown(stray)} is not one of the options`);
  return Result.succeed({
    _tag: 'Pick',
    name: fence.name,
    label: fence.label ?? fence.name,
    choices,
    value: choices.filter((choice) => ticked.includes(choice)),
  });
};

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

/** Whether two ends are of one kind: both numbers, or both ISO dates. */
const kindOf = (end: End): 'number' | 'date' | undefined =>
  isEnd(end) ? 'number' : isoDay.test(end) ? 'date' : undefined;

/** The least and greatest of a data field's values, numbers or ISO dates. */
const extentOf = (
  rows: Rows,
  field: string,
  from: string,
): Result.Result<{ readonly min: End; readonly max: End }, string> => {
  const values = rows.flatMap((row) => {
    const value = row[field];
    return isEnd(value) || (isText(value) && isoDay.test(value)) ? [value] : [];
  });
  if (values.length === 0) {
    return Result.fail(`options.field: "${field}" in ${from} has no numbers or ISO dates`);
  }
  const sorted = values.toSorted((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return Result.succeed({ min: sorted[0] ?? 0, max: sorted.at(-1) ?? 0 });
};

const betweener = (
  fence: FenceOf<'between'>,
  extent: { readonly min: End; readonly max: End },
): Result.Result<Input, string> => {
  const kind = kindOf(extent.min);
  if (kind === undefined || kind !== kindOf(extent.max)) {
    return Result.fail('min: the ends must both be numbers, or both ISO dates');
  }
  if (!(extent.min < extent.max)) return Result.fail('min: must be less than max');
  const value = fence.value ?? extent;
  const inside = (end: End) => kindOf(end) === kind && end >= extent.min && end <= extent.max;
  if (!inside(value.min) || !inside(value.max) || value.min > value.max) {
    return Result.fail(
      `value: ${String(value.min)} to ${String(value.max)} is not within ${String(extent.min)} to ${String(extent.max)}`,
    );
  }
  return Result.succeed({
    _tag: 'Between',
    name: fence.name,
    label: fence.label ?? fence.name,
    kind,
    min: extent.min,
    max: extent.max,
    step: fence.step ?? 1,
    value: { min: value.min, max: value.max },
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
  if (fence.type === 'between') {
    const { min, max, options: field } = fence;
    if (field !== undefined) {
      return Result.flatMap(
        Result.flatMap(read(field.data), (rows) => extentOf(rows, field.field, field.data)),
        (extent) => betweener(fence, extent),
      );
    }
    return min === undefined || max === undefined
      ? Result.fail('min: give min and max, or options: { "data", "field" }')
      : betweener(fence, { min, max });
  }
  if (fence.type === 'checkbox') {
    return Result.succeed({
      _tag: 'Toggle',
      name: fence.name,
      label: fence.label ?? fence.name,
      value: fence.value ?? false,
    });
  }
  const options = fence.options;
  const make = (choices: ReadonlyArray<Choice>) =>
    fence.type === 'checkboxes' ? picker(fence, choices) : chooser(fence, choices);
  if (!isFromData(options)) return make(options);
  const fromData = options;
  return Result.flatMap(
    Result.flatMap(read(fromData.data), (rows) => valuesOf(rows, fromData.field, fromData.data)),
    make,
  );
};

/** The defaults of `inputs`, by name. */
export const defaultsOf = (inputs: ReadonlyArray<Input>): Values =>
  Object.fromEntries(inputs.map((input) => [input.name, input.value]));

/** The value `text` names for `input` (`all` for a select's `all`), or why it names none. */
export const valueFor = (input: Input, text: string): Result.Result<InputValue, string> => {
  if (input._tag === 'Between') {
    // `from..to`, each end as the input's kind.
    const [from = '', to = ''] = text.split('..');
    const end = (part: string): End | undefined => {
      const trimmed = part.trim();
      if (input.kind === 'date') return isoDay.test(trimmed) ? trimmed : undefined;
      const number = Number(trimmed);
      return trimmed !== '' && Number.isFinite(number) ? number : undefined;
    };
    // Ends past the input's are brought to them (`..2026-10-31` for data ending on the
    // 26th), so a period can be named by its calendar; a span that misses it is refused.
    const min = end(from);
    const max = end(to);
    return min === undefined || max === undefined || min > max || max < input.min || min > input.max
      ? Result.fail(
          `${text} is not a span from..to that meets ${String(input.min)}..${String(input.max)}`,
        )
      : Result.succeed({
          min: min < input.min ? input.min : min,
          max: max > input.max ? input.max : max,
        });
  }
  if (input._tag === 'Pick') {
    // A list, comma-separated (`North,South`); empty for none ticked.
    const parts = text === '' ? [] : text.split(',').map((part) => part.trim());
    const stray = parts.find((part) => !input.choices.some((each) => String(each) === part));
    return stray === undefined
      ? Result.succeed(input.choices.filter((choice) => parts.includes(String(choice))))
      : Result.fail(`${stray} is not one of its choices`);
  }
  if (input._tag === 'Choose') {
    if (text === 'all' && input.all !== null) return Result.succeed(null);
    const choice = input.choices.find((each) => String(each) === text);
    return choice === undefined
      ? Result.fail(`${text} is not one of its choices`)
      : Result.succeed(choice);
  }
  if (input._tag === 'Toggle') {
    return text === 'true' || text === 'false'
      ? Result.succeed(text === 'true')
      : Result.fail(`${text} is not true or false`);
  }
  const value = Number(text);
  return Number.isFinite(value) && value >= input.min && value <= input.max
    ? Result.succeed(value)
    : Result.fail(`${text} is not a number from ${input.min} to ${input.max}`);
};

const sameChoices = (a: ReadonlyArray<Choice>, b: ReadonlyArray<Choice>): boolean =>
  a.length === b.length && a.every((each, i) => each === b[i]);

/**
 * A page's query string for `values` (ADR 0116): each input not at its default, as
 * `name=value` (`all` for a select's `all`), in the inputs' order; `''` at the defaults.
 */
export const queryOf = (inputs: ReadonlyArray<Input>, values: Values): string => {
  const params = new URLSearchParams();
  for (const input of inputs) {
    const value = values[input.name] ?? null;
    if (input._tag === 'Pick') {
      // One parameter per ticked choice; an empty one when none is ticked.
      const ticked = isChoices(value) ? value : [];
      if (sameChoices(ticked, input.value)) continue;
      if (ticked.length === 0) params.append(input.name, '');
      for (const choice of ticked) params.append(input.name, String(choice));
    } else if (input._tag === 'Between') {
      const span = isSpan(value) ? value : input.value;
      if (span.min !== input.value.min || span.max !== input.value.max) {
        params.set(input.name, `${String(span.min)}..${String(span.max)}`);
      }
    } else if (value !== input.value) {
      params.set(input.name, value === null ? 'all' : String(value));
    }
  }
  const text = params.toString();
  return text === '' ? '' : `?${text}`;
};

/**
 * The values a query string sets: each parameter naming an input with a value it can
 * take. Anything else in the query (another site's parameters, a stale choice) is left
 * alone, so an old link still opens the page.
 */
export const valuesFromQuery = (inputs: ReadonlyArray<Input>, query: string): Values => {
  const params = new URLSearchParams(query);
  return Object.fromEntries(
    inputs.flatMap((input) => {
      if (input._tag === 'Pick') {
        if (!params.has(input.name)) return [];
        const texts = params.getAll(input.name);
        const ticked = input.choices.filter((choice) => texts.includes(String(choice)));
        return [[input.name, ticked]];
      }
      const text = params.get(input.name);
      if (text === null) return [];
      const value = valueFor(input, text);
      return Result.isSuccess(value) ? [[input.name, value.success]] : [];
    }),
  );
};

/**
 * The values `check` draws an input's charts at: each choice (and `all`), both ends of a
 * range and its default, both states, and for checkboxes each choice alone and the
 * default (not every combination, and not none ticked, which keeps no rows).
 */
export const choicesOf = (input: Input): ReadonlyArray<InputValue> => {
  if (input._tag === 'Choose') return input.all === null ? input.choices : [null, ...input.choices];
  if (input._tag === 'Pick') return [input.value, ...input.choices.map((choice) => [choice])];
  if (input._tag === 'Between') {
    const whole = { min: input.min, max: input.max };
    return input.value.min === whole.min && input.value.max === whole.max
      ? [input.value]
      : [input.value, whole];
  }
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

/**
 * Whether a row's value meets a condition: equal to it, one of a list (ADR 0117), or
 * between `min` and `max`.
 */
const meets = (value: Json | undefined, condition: Json): boolean => {
  if (condition === null) return true;
  if (Array.isArray(condition)) return condition.some((each) => each === value);
  if (!isObject(condition)) return value === condition;
  const { min = null, max = null } = condition;
  if (value === null || value === undefined) return false;
  return (min === null || value >= min) && (max === null || value <= max);
};

/**
 * The rows `where` keeps: for each field, rows whose value equals the condition, is
 * one of a list of values, or lies between its `min` and `max` (inclusive). A `null` condition (an input at `all`)
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
