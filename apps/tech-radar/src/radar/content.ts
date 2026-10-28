/**
 * The radar's markdown, assembled into the `RadarDataset` both radars draw. Pure: it takes
 * the files' ids and frontmatter as the content collections hand them over, so the build
 * and the tests assemble the same way.
 *
 * - Every edition, the current one included, is a file in `editions/`, named by its date.
 *   The newest is the current edition.
 * - Every entry is a file in `entries/`, named by its id. Its `ring` is the current one;
 *   `history` lists the earlier editions it was on and its ring then; `related` lists the
 *   relationships it starts.
 *
 * A failure names the file it comes from, so a bad edit stops the build with its cause.
 *
 * @module
 */
import { Array as Arr, Order, Result, Schema, SchemaIssue } from 'effect';

import {
  Category,
  categoryIds,
  decodeRadarDataset,
  type RadarDataset,
  type RadarEdition,
  type RadarEntry,
  type RadarRelationship,
  RelationshipType,
  Ring,
  ringIds,
} from './three/data';

/** A markdown file as a content collection hands it over: its id and its frontmatter. */
export type ContentFile = { readonly id: string; readonly data: unknown };

/** `radar.md`: the radar's name; its body is the introduction. */
export const RadarFile = Schema.Struct({ title: Schema.String });
export type RadarFile = typeof RadarFile.Type;

export const EditionFile = Schema.Struct({
  date: Schema.String,
  label: Schema.String,
});
export type EditionFile = typeof EditionFile.Type;

const Placement = Schema.Struct({ edition: Schema.String, ring: Ring });
const Related = Schema.Struct({ to: Schema.String, type: RelationshipType, note: Schema.String });

export const EntryFile = Schema.Struct({
  name: Schema.String,
  category: Category,
  ring: Ring,
  summary: Schema.String,
  source: Schema.String,
  history: Schema.optionalKey(Schema.Array(Placement)),
  related: Schema.optionalKey(Schema.Array(Related)),
});
export type EntryFile = typeof EntryFile.Type;

type Edition = EditionFile & { readonly id: string };
type Entry = EntryFile & { readonly id: string };

const formatIssue = SchemaIssue.makeFormatterDefault();

const decodeFile =
  <A extends object>(schema: Schema.Decoder<A>, folder: string) =>
  ({ id, data }: ContentFile): Result.Result<A & { readonly id: string }, string> =>
    Schema.decodeUnknownResult(schema)(data).pipe(
      Result.map((decoded): A & { readonly id: string } => ({ ...decoded, id })),
      Result.mapError((error) => `${folder}/${id}.md: ${formatIssue(error.issue)}`),
    );

const byDate = Order.mapInput(Order.String, (edition: Edition) => edition.date);

/** Category, then ring, then name: the order the radar lists its entries in. */
const byPlace = Order.combineAll<Entry>([
  Order.mapInput(Order.Number, (entry: Entry) => categoryIds.indexOf(entry.category)),
  Order.mapInput(Order.Number, (entry: Entry) => ringIds.indexOf(entry.ring)),
  Order.mapInput(Order.String, (entry: Entry) => entry.name),
]);

const checkEdition = (edition: Edition): Result.Result<Edition, string> =>
  edition.id === edition.date
    ? Result.succeed(edition)
    : Result.fail(`editions/${edition.id}.md: its date, ${edition.date}, must be its file name`);

/** An entry's history names earlier editions, once each; its relationships, other entries. */
const checkEntry =
  (earlier: ReadonlySet<string>, ids: ReadonlySet<string>) =>
  (entry: Entry): Result.Result<Entry, string> => {
    const file = `entries/${entry.id}.md`;
    const editions = (entry.history ?? []).map(({ edition }) => edition);
    const unknownEdition = editions.find((edition) => !earlier.has(edition));
    const unknownEntry = (entry.related ?? []).find(({ to }) => !ids.has(to) || to === entry.id);
    return unknownEdition !== undefined
      ? Result.fail(`${file}: history names ${unknownEdition}, which is not an earlier edition`)
      : new Set(editions).size < editions.length
        ? Result.fail(`${file}: history names an edition twice`)
        : unknownEntry !== undefined
          ? Result.fail(`${file}: related names ${unknownEntry.to}, which is not another entry`)
          : Result.succeed(entry);
  };

/** The entry as the radar holds it, checked alone so a bad field names its file. */
const toRadarEntry =
  (authoredOn: string) =>
  (entry: Entry): Result.Result<RadarEntry, string> => {
    const radarEntry: RadarEntry = {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      ring: entry.ring,
      description: entry.summary,
      sourceUrl: entry.source,
    };
    const checked = decodeRadarDataset({ authoredOn, entries: [radarEntry] });
    return checked._tag === 'Ready'
      ? Result.succeed(radarEntry)
      : Result.fail(`entries/${entry.id}.md: ${checked.reason}`);
  };

const toRelationships = (entry: Entry): ReadonlyArray<RadarRelationship> =>
  (entry.related ?? []).map(({ to, type, note }) => ({ from: entry.id, to, type, note }));

/** An earlier edition, against the current one: the rings that differed, who was absent. */
const toRadarEdition =
  (entries: ReadonlyArray<Entry>) =>
  (edition: Edition): RadarEdition => {
    const ringThen = (entry: Entry) =>
      (entry.history ?? []).find((placement) => placement.edition === edition.date)?.ring;
    return {
      authoredOn: edition.date,
      label: edition.label,
      rings: Object.fromEntries(
        entries.flatMap((entry) => {
          const ring = ringThen(entry);
          return ring === undefined || ring === entry.ring ? [] : [[entry.id, ring] as const];
        }),
      ),
      absent: entries.filter((entry) => ringThen(entry) === undefined).map(({ id }) => id),
    };
  };

/** The radar the markdown describes, or why it can't be one. */
export const assembleRadar = (files: {
  readonly editions: ReadonlyArray<ContentFile>;
  readonly entries: ReadonlyArray<ContentFile>;
}): Result.Result<RadarDataset, string> =>
  Result.gen(function* () {
    const editions = Arr.sort(
      yield* Result.all(
        files.editions.map((file) =>
          Result.flatMap(decodeFile(EditionFile, 'editions')(file), checkEdition),
        ),
      ),
      byDate,
    );
    const current = yield* Result.fromOption(
      Arr.last(editions),
      () => 'editions/: the radar needs at least one edition',
    );
    const earlier = editions.slice(0, -1);
    const decoded = yield* Result.all(files.entries.map(decodeFile(EntryFile, 'entries')));
    const ids = new Set(decoded.map(({ id }) => id));
    const entries = Arr.sort(
      yield* Result.all(decoded.map(checkEntry(new Set(earlier.map(({ date }) => date)), ids))),
      byPlace,
    );
    const dataset: RadarDataset = {
      authoredOn: current.date,
      entries: yield* Result.all(entries.map(toRadarEntry(current.date))),
      relationships: entries.flatMap(toRelationships),
      editions: earlier.map(toRadarEdition(entries)),
    };
    const checked = decodeRadarDataset(dataset);
    return yield* checked._tag === 'Ready'
      ? Result.succeed(checked.dataset)
      : Result.fail(`The radar: ${checked.reason}`);
  });
