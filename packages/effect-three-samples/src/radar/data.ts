/* Local fixture decoding is the unknown-input boundary; ordinary data validation is not Effect state handling. */
/* oxlint-disable anti-slop/no-unknown-parameters, linteffect/no-if-statement, linteffect/no-magic-domain-string, linteffect/no-domain-logic-in-conditional, linteffect/no-ternary, linteffect/no-return-in-arrow */
import { Option, Schema } from 'effect';

import { demoRadar } from './fixture';

export const Category = Schema.Literals([
  'techniques',
  'tools',
  'platforms',
  'languages-frameworks',
]);
export type Category = typeof Category.Type;
export const Ring = Schema.Literals(['adopt', 'trial', 'assess', 'caution']);
export type Ring = typeof Ring.Type;
export const categoryIds = Category.literals;
export const ringIds = Ring.literals;
export const categoryLabels = {
  techniques: 'Techniques',
  tools: 'Tools',
  platforms: 'Platforms',
  'languages-frameworks': 'Languages & Frameworks',
} satisfies Readonly<Record<Category, string>>;
export const ringLabels = {
  adopt: 'Adopt',
  trial: 'Trial',
  assess: 'Assess',
  caution: 'Caution',
} satisfies Readonly<Record<Ring, string>>;
/* The notice is human-readable provenance, not a state sentinel. */
/* oxlint-disable-next-line linteffect/no-string-sentinel-const */
export const demoNotice =
  'Original demo dataset - placements are illustrative, not adoption advice';
export const RelationshipType = Schema.Literals([
  'builds-on',
  'complements',
  'inspired-by',
  'guards-against',
  'alternative-to',
]);
export type RelationshipType = typeof RelationshipType.Type;
export const relationshipTypes = RelationshipType.literals;
export const relationshipLabels = {
  'builds-on': 'Builds on',
  complements: 'Complements',
  'inspired-by': 'Inspired by',
  'guards-against': 'Guards against',
  'alternative-to': 'Alternative to',
} satisfies Readonly<Record<RelationshipType, string>>;
/** Peer relationships read the same both ways, so `a → b` and `b → a` are one. */
export const isSymmetric = (type: RelationshipType): boolean =>
  type === 'complements' || type === 'alternative-to';
const Entry = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  category: Category,
  ring: Ring,
  description: Schema.String,
  sourceUrl: Schema.String,
});
const Relationship = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  type: RelationshipType,
  note: Schema.String,
});
/**
 * An earlier edition of the radar, against the current one: the entries whose ring
 * differed then, and those not yet on it.
 */
const Edition = Schema.Struct({
  authoredOn: Schema.String,
  label: Schema.String,
  rings: Schema.Record(Schema.String, Ring),
  absent: Schema.Array(Schema.String),
});
const Dataset = Schema.Struct({
  authoredOn: Schema.String,
  entries: Schema.Array(Entry),
  relationships: Schema.optionalKey(Schema.Array(Relationship)),
  /** Earlier editions, oldest first; the dataset itself is the latest. */
  editions: Schema.optionalKey(Schema.Array(Edition)),
});
export type RadarEntry = typeof Entry.Type;
export type RadarRelationship = typeof Relationship.Type;
export type RadarEdition = typeof Edition.Type;
export type RadarDataset = typeof Dataset.Type;
export type RadarData =
  | Readonly<{ _tag: 'Ready'; dataset: RadarDataset }>
  | Readonly<{ _tag: 'Failure'; reason: string }>;

export function decodeRadarDataset(input: unknown): RadarData {
  const decoded = Schema.decodeUnknownOption(Dataset)(input);
  if (Option.isNone(decoded)) return { _tag: 'Failure', reason: 'Malformed radar dataset' };
  const dataset = decoded.value;
  if (!isCalendarDate(dataset.authoredOn))
    return { _tag: 'Failure', reason: 'Invalid radar authored date' };
  const ids = new Set<string>();
  const counts = {
    techniques: 0,
    tools: 0,
    platforms: 0,
    'languages-frameworks': 0,
  };
  for (const entry of dataset.entries) {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) ||
      !entry.name.trim() ||
      !entry.description.trim()
    )
      return { _tag: 'Failure', reason: 'Invalid radar entry text or identity' };
    if (ids.has(entry.id)) return { _tag: 'Failure', reason: 'Duplicate radar entry IDs' };
    ids.add(entry.id);
    counts[entry.category] += 1;
    if (counts[entry.category] > 8)
      return { _tag: 'Failure', reason: 'Radar category exceeds eight layout slots' };
    if (!URL.canParse(entry.sourceUrl))
      return { _tag: 'Failure', reason: 'Invalid radar source URL' };
    const url = new URL(entry.sourceUrl);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
      return { _tag: 'Failure', reason: 'Radar sources require credential-free HTTPS URLs' };
  }
  const pairs = new Set<string>();
  for (const { from, to, type, note } of dataset.relationships ?? []) {
    if (!ids.has(from) || !ids.has(to))
      return { _tag: 'Failure', reason: 'Radar relationships must name known entries' };
    if (from === to) return { _tag: 'Failure', reason: 'Radar relationships need two entries' };
    if (!note.trim()) return { _tag: 'Failure', reason: 'Radar relationships need a note' };
    const keys = isSymmetric(type)
      ? [`${from}|${to}|${type}`, `${to}|${from}|${type}`]
      : [`${from}|${to}|${type}`];
    if (keys.some((key) => pairs.has(key)))
      return { _tag: 'Failure', reason: 'Duplicate radar relationships' };
    for (const key of keys) pairs.add(key);
  }
  const editions = dataset.editions ?? [];
  const dates = [...editions.map(({ authoredOn }) => authoredOn), dataset.authoredOn];
  if (editions.some((edition) => !isCalendarDate(edition.authoredOn) || !edition.label.trim()))
    return { _tag: 'Failure', reason: 'Invalid radar edition date or label' };
  if (dates.some((date, index) => index > 0 && date <= (dates[index - 1] ?? '')))
    return { _tag: 'Failure', reason: 'Radar editions must be in order, before the current one' };
  if (
    editions.some((edition) =>
      [...Object.keys(edition.rings), ...edition.absent].some((id) => !ids.has(id)),
    )
  )
    return { _tag: 'Failure', reason: 'Radar editions must name known entries' };
  return { _tag: 'Ready', dataset };
}

/** A real calendar date written as `YYYY-MM-DD`. */
function isCalendarDate(text: string): boolean {
  const date = Date.parse(`${text}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    Number.isFinite(date) &&
    new Date(date).toISOString().slice(0, 10) === text
  );
}
export function loadDemoRadar(): RadarData {
  return decodeRadarDataset(demoRadar);
}
