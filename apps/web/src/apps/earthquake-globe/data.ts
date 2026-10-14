/* External GeoJSON decoding is the explicit unknown-input boundary. */
/* oxlint-disable anti-slop/no-unknown-parameters */
/* Pure decoding/display data, not Effect transitions (same distinction as the Viz data layer). */
/* oxlint-disable linteffect/no-if-statement, linteffect/no-ternary, linteffect/no-magic-domain-string, linteffect/no-string-sentinel-const, linteffect/no-domain-logic-in-conditional */
import { Option, Schema } from 'effect';

import provenance from './fixtures/provenance.json';
import rawSnapshot from './fixtures/usgs-week.geojson?raw';

export type Earthquake = Readonly<{
  id: string;
  longitude: number;
  latitude: number;
  magnitude: number | null;
  depthKm: number | null;
  timeMs: number;
  place: string | null;
  url: string | null;
}>;
export type SnapshotProvenance = Readonly<{
  sourceUrl: string;
  capturedAt: string;
  generatedAtMs: number;
  originalCount: number;
  sha256: string;
}>;
export type DecodedSnapshot = Readonly<{
  provenance: SnapshotProvenance;
  events: ReadonlyArray<Earthquake>;
  excluded: Readonly<Record<string, number>>;
  warnings: Readonly<Record<string, number>>;
  window: readonly [number, number] | null;
}>;
export type SnapshotResult =
  | Readonly<{ _tag: 'Ready'; snapshot: DecodedSnapshot }>
  | Readonly<{ _tag: 'Failure'; reason: string }>;

const Envelope = Schema.Struct({
  type: Schema.Literals(['FeatureCollection']),
  metadata: Schema.Struct({ generated: Schema.Number, count: Schema.Number }),
  features: Schema.Array(Schema.Unknown),
});
const Feature = Schema.Struct({
  type: Schema.Literals(['Feature']),
  id: Schema.optional(Schema.Unknown),
  geometry: Schema.Unknown,
  properties: Schema.Struct({
    type: Schema.optional(Schema.Unknown),
    time: Schema.optional(Schema.Unknown),
    mag: Schema.optional(Schema.Unknown),
    place: Schema.optional(Schema.Unknown),
    url: Schema.optional(Schema.Unknown),
  }),
});
const Point = Schema.Struct({
  type: Schema.Literals(['Point']),
  coordinates: Schema.Array(Schema.Unknown),
});
const sourceUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
function isTime(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value) && Math.abs(value) <= 8.64e15;
}
function officialUrl(value: unknown): Option.Option<string> {
  if (!isText(value) || !URL.canParse(value)) return Option.none();
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'earthquake.usgs.gov' ||
    url.username ||
    url.password ||
    url.port ||
    !url.pathname.startsWith('/earthquakes/eventpage/')
  )
    return Option.none();
  return Option.some(url.href);
}
function count(record: Record<string, number>, reason: string): void {
  record[reason] = (record[reason] ?? 0) + 1;
}

export function decodeSnapshot(input: unknown, record: SnapshotProvenance): SnapshotResult {
  const decoded = Schema.decodeUnknownOption(Envelope)(input);
  if (Option.isNone(decoded)) return { _tag: 'Failure', reason: 'Malformed earthquake snapshot' };
  const feed = decoded.value;
  if (
    !isTime(feed.metadata.generated) ||
    !Number.isSafeInteger(feed.metadata.count) ||
    feed.metadata.count !== feed.features.length ||
    record.originalCount !== feed.features.length ||
    record.generatedAtMs !== feed.metadata.generated ||
    !Number.isFinite(Date.parse(record.capturedAt)) ||
    record.sourceUrl !== sourceUrl ||
    !/^[a-f0-9]{64}$/.test(record.sha256)
  )
    return { _tag: 'Failure', reason: 'Snapshot provenance does not match the recorded feed' };
  const events: Earthquake[] = [];
  const ids = new Set<string>();
  const excluded: Record<string, number> = {};
  const warnings: Record<string, number> = {};
  for (const raw of feed.features) {
    const parsed = Schema.decodeUnknownOption(Feature)(raw);
    if (Option.isNone(parsed)) {
      count(excluded, 'malformed-event');
      continue;
    }
    const feature = parsed.value;
    if (!isText(feature.id)) {
      count(excluded, 'invalid-id');
      continue;
    }
    if (ids.has(feature.id))
      return { _tag: 'Failure', reason: 'Duplicate event IDs in recorded feed' };
    ids.add(feature.id);
    if (feature.properties.type !== 'earthquake') {
      count(excluded, 'non-earthquake');
      continue;
    }
    if (!isTime(feature.properties.time)) {
      count(excluded, 'invalid-time');
      continue;
    }
    const geometry = Schema.decodeUnknownOption(Point)(feature.geometry);
    const coordinates = Option.getOrUndefined(geometry)?.coordinates;
    const longitude = coordinates?.[0];
    const latitude = coordinates?.[1];
    if (
      !isFiniteNumber(longitude) ||
      Math.abs(longitude) > 180 ||
      !isFiniteNumber(latitude) ||
      Math.abs(latitude) > 90
    ) {
      count(excluded, 'invalid-coordinate');
      continue;
    }
    const mag = feature.properties.mag;
    const depth = coordinates?.[2];
    const url = Option.getOrNull(officialUrl(feature.properties.url));
    if (mag !== null && mag !== undefined && !isFiniteNumber(mag))
      count(warnings, 'invalid-magnitude');
    if (depth !== null && depth !== undefined && !isFiniteNumber(depth))
      count(warnings, 'invalid-depth');
    if (feature.properties.url !== null && feature.properties.url !== undefined && url === null)
      count(warnings, 'invalid-url');
    if (
      feature.properties.place !== null &&
      feature.properties.place !== undefined &&
      !isText(feature.properties.place)
    )
      count(warnings, 'invalid-place');
    events.push(
      Object.freeze({
        id: feature.id,
        longitude,
        latitude,
        magnitude: isFiniteNumber(mag) ? mag : null,
        depthKm: isFiniteNumber(depth) ? depth : null,
        timeMs: feature.properties.time,
        place: isText(feature.properties.place) ? feature.properties.place : null,
        url,
      }),
    );
  }
  events.sort((a, b) => b.timeMs - a.timeMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const newest = events[0];
  const oldest = events.at(-1);
  const window: DecodedSnapshot['window'] =
    newest && oldest ? [oldest.timeMs, newest.timeMs] : null;
  return {
    _tag: 'Ready',
    snapshot: Object.freeze({
      provenance: Object.freeze({ ...record }),
      events: Object.freeze(events),
      excluded: Object.freeze(excluded),
      warnings: Object.freeze(warnings),
      window,
    }),
  };
}

export function loadBundledSnapshot(): SnapshotResult {
  return Option.match(
    Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(rawSnapshot),
    {
      onNone: () => ({ _tag: 'Failure', reason: 'Recorded earthquake snapshot is not valid JSON' }),
      onSome: (input) => decodeSnapshot(input, provenance),
    },
  );
}
