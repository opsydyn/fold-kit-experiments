import { Schema } from 'effect';

export const DatasetId = Schema.Literals(['north', 'coast', 'upland']);
export type DatasetId = typeof DatasetId.Type;
export const RequestProfile = Schema.Literals(['normal', 'slow', 'fast']);
export const Transport = Schema.Literals(['api', 'fixtures']);
export type Transport = typeof Transport.Type;
export const Request = Schema.Struct({
  dataset: DatasetId,
  revision: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(1_000_000),
  ),
  profile: RequestProfile,
  fail: Schema.Boolean,
  source: Schema.optional(Transport),
});
export type Request = typeof Request.Type;
export const Point = Schema.Struct({ hour: Schema.Number, value: Schema.Number });
export const Snapshot = Schema.Struct({
  dataset: DatasetId,
  revision: Schema.Number,
  points: Schema.Array(Point),
});
export const Fixture = Schema.Struct({ dataset: DatasetId, points: Schema.Array(Point) });
export type Snapshot = typeof Snapshot.Type;

/** Illustrative observations served by the API and static fixture routes. */
export const datasets = {
  north: {
    label: 'North station',
    colour: 'var(--dataset-north)',
    values: [4, 7, 9, 6, 12, 15, 10, 8],
  },
  coast: {
    label: 'Coastal station',
    colour: 'var(--dataset-coast)',
    values: [8, 12, 10, 16, 21, 18, 14, 11],
  },
  upland: {
    label: 'Upland station',
    colour: 'var(--dataset-upland)',
    values: [6, 10, 14, 12, 17, 23, 19, 13],
  },
} as const;
export const datasetIds: ReadonlyArray<DatasetId> = ['north', 'coast', 'upland'];
export const delays = { normal: 700, slow: 2200, fast: 150 } as const;
