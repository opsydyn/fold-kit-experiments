/**
 * The fields of a value, read from its schema (roadmap, "Beyond parity" 4: an inspector
 * generated from the scene schemas). The runtime's `Inspector` passes a schema's AST in;
 * this walks it beside the value and lists what an inspector shows: numbers, text,
 * switches, choices of literals, colours, vectors, and the rest read-only (a node's
 * kind, an absent part, a list of children). A tagged union shows the member the value
 * is; nested structs show their fields under their name.
 *
 * The AST is read through the few shapes used here, so the kernel needs no schema
 * library; colours and vectors are recognised by being the very AST nodes the caller
 * names, not by field names.
 *
 * @module
 */
import type { Vec3 } from './description.ts';

/** Where a field is in the value: property names and list indices from the top. */
export type FieldPath = ReadonlyArray<string | number>;

/** What an inspector's controls produce: a number, text, or a switch's state. */
export type FieldValue = number | string | boolean;

type Base = { readonly path: FieldPath; readonly label: string };

/** A field as an inspector shows it. */
export type InspectedField = Base &
  (
    | { readonly _tag: 'Number'; readonly value: number }
    | { readonly _tag: 'Text'; readonly value: string }
    | { readonly _tag: 'Toggle'; readonly value: boolean }
    | { readonly _tag: 'Choice'; readonly value: string; readonly options: ReadonlyArray<string> }
    | { readonly _tag: 'Colour'; readonly value: number }
    | { readonly _tag: 'Vector'; readonly value: Vec3 }
    /** Shown, not edited: a kind, an absent part, a list, or what this cannot edit. */
    | { readonly _tag: 'Fixed'; readonly text: string }
  );

/** The parts of a schema AST read here (Effect's `SchemaAST`, structurally). */
export type InspectableAst =
  | { readonly _tag: 'Suspend'; readonly thunk: () => InspectableAst }
  | {
      readonly _tag: 'Objects';
      readonly propertySignatures: ReadonlyArray<{
        readonly name: PropertyKey;
        readonly type: InspectableAst;
      }>;
    }
  | {
      readonly _tag: 'Arrays';
      readonly elements: ReadonlyArray<InspectableAst>;
      readonly rest: ReadonlyArray<InspectableAst>;
    }
  | { readonly _tag: 'Union'; readonly types: ReadonlyArray<InspectableAst> }
  | { readonly _tag: 'Literal'; readonly literal: unknown }
  | { readonly _tag: 'Number' | 'String' | 'Boolean' | 'Null' }
  | { readonly _tag: string };

/** AST nodes shown as a colour picker or as three numbers, by identity. */
export type InspectHints = {
  readonly colours: ReadonlyArray<unknown>;
  readonly vectors: ReadonlyArray<unknown>;
};

const resolve = (ast: InspectableAst): InspectableAst =>
  ast._tag === 'Suspend' && 'thunk' in ast ? resolve(ast.thunk()) : ast;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const labelOf = (path: FieldPath): string => String(path.at(-1) ?? 'value');

const literalOf = (ast: InspectableAst): unknown => ('literal' in ast ? ast.literal : undefined);

/** The literal of an object member's `_tag`, if it has one. */
const tagOf = (ast: InspectableAst): unknown => {
  const member = resolve(ast);
  if (!('propertySignatures' in member)) return undefined;
  const tag = member.propertySignatures.find((property) => property.name === '_tag');
  return tag === undefined ? undefined : literalOf(resolve(tag.type));
};

/** The union member `value` is: by its `_tag`, else the non-null one, else the first. */
const memberFor = (
  types: ReadonlyArray<InspectableAst>,
  value: unknown,
): InspectableAst | undefined => {
  if (isRecord(value) && '_tag' in value) {
    const tagged = types.find((member) => tagOf(member) === value['_tag']);
    if (tagged !== undefined) return tagged;
  }
  if (value === null) return types.find((member) => resolve(member)._tag === 'Null');
  return types.find((member) => resolve(member)._tag !== 'Null') ?? types[0];
};

const fixed = (path: FieldPath, text: string): InspectedField => ({
  _tag: 'Fixed',
  path,
  label: labelOf(path),
  text,
});

const isVector = (value: unknown): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number');

const walk = (
  given: InspectableAst,
  value: unknown,
  path: FieldPath,
  hints: InspectHints,
): ReadonlyArray<InspectedField> => {
  const ast = resolve(given);
  const label = labelOf(path);
  if (hints.colours.includes(ast) && typeof value === 'number') {
    return [{ _tag: 'Colour', path, label, value }];
  }
  if (hints.vectors.includes(ast) && isVector(value)) {
    return [{ _tag: 'Vector', path, label, value }];
  }
  switch (ast._tag) {
    case 'Number':
      return typeof value === 'number' ? [{ _tag: 'Number', path, label, value }] : [];
    case 'String':
      return typeof value === 'string' ? [{ _tag: 'Text', path, label, value }] : [];
    case 'Boolean':
      return typeof value === 'boolean' ? [{ _tag: 'Toggle', path, label, value }] : [];
    case 'Literal':
    case 'Null':
      return [fixed(path, String(value))];
    case 'Union':
      return 'types' in ast ? unionFields(ast.types, value, path, hints) : [];
    case 'Objects':
      return 'propertySignatures' in ast ? objectFields(ast, value, path, hints) : [];
    case 'Arrays':
      return 'elements' in ast ? arrayFields(ast, value, path, hints) : [];
    default:
      return [fixed(path, String(value))];
  }
};

/** A union of string literals is a choice; any other shows the member the value is. */
const unionFields = (
  types: ReadonlyArray<InspectableAst>,
  value: unknown,
  path: FieldPath,
  hints: InspectHints,
): ReadonlyArray<InspectedField> => {
  const literals = types.map((member) => literalOf(resolve(member)));
  if (typeof value === 'string' && literals.every((literal) => typeof literal === 'string')) {
    return [{ _tag: 'Choice', path, label: labelOf(path), value, options: literals.map(String) }];
  }
  const member = memberFor(types, value);
  return member === undefined ? [fixed(path, String(value))] : walk(member, value, path, hints);
};

const objectFields = (
  ast: Extract<InspectableAst, { readonly propertySignatures: unknown }>,
  value: unknown,
  path: FieldPath,
  hints: InspectHints,
): ReadonlyArray<InspectedField> => {
  if (!isRecord(value)) return [fixed(path, String(value))];
  return ast.propertySignatures.flatMap((property) =>
    propertyFields(String(property.name), property.type, value, path, hints),
  );
};

/** One property's fields: none when absent; a tag shows what kind it is, never edited. */
function propertyFields(
  name: string,
  type: InspectableAst,
  value: Readonly<Record<string, unknown>>,
  path: FieldPath,
  hints: InspectHints,
): ReadonlyArray<InspectedField> {
  if (!(name in value)) return [];
  if (name === '_tag') return [fixed([...path, name], String(value[name]))];
  return walk(type, value[name], [...path, name], hints);
}

/** A fixed tuple shows each element; a list of any length shows how many it holds. */
const arrayFields = (
  ast: Extract<InspectableAst, { readonly elements: unknown }>,
  value: unknown,
  path: FieldPath,
  hints: InspectHints,
): ReadonlyArray<InspectedField> => {
  if (!Array.isArray(value)) return [fixed(path, String(value))];
  if (ast.rest.length > 0) {
    return [fixed(path, `${value.length} ${value.length === 1 ? 'item' : 'items'}`)];
  }
  return ast.elements.flatMap((element, index) =>
    walk(element, value[index], [...path, index], hints),
  );
};

/** The fields of `value` as its schema's AST describes them, in the schema's order. */
export const inspectFields = (
  ast: InspectableAst,
  value: unknown,
  hints: InspectHints = { colours: [], vectors: [] },
): ReadonlyArray<InspectedField> => walk(ast, value, [], hints);

/** `value` with `next` at `path`, every object and list on the way copied, not changed. */
export const setAt = (value: unknown, path: FieldPath, next: unknown): unknown => {
  const [head, ...rest] = path;
  if (head === undefined) return next;
  if (Array.isArray(value) && typeof head === 'number') {
    return value.map((item, index) => (index === head ? setAt(item, rest, next) : item));
  }
  if (isRecord(value) && typeof head === 'string') {
    return { ...value, [head]: setAt(value[head], rest, next) };
  }
  return value;
};
