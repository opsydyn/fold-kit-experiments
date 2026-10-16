import { Option, Schema } from 'effect';

/** The city is `side` × `side` buildings: 10,000 in one instanced mesh. */
export const side = 100;
export const buildingCount = side * side;

export const Model = Schema.Struct({
  /** Seeds the skyline; "New city" moves to the next seed. */
  seed: Schema.Int,
  hovered: Schema.Option(Schema.Int),
  /** Buildings raised by a click, by index. */
  raised: Schema.Array(Schema.Int),
  /** The latest performance factor, 0 to 1: the render resolution follows it. */
  quality: Schema.Number,
  /** The fps average behind the latest quality change, if any. */
  fps: Schema.Option(Schema.Number),
});
export type Model = typeof Model.Type;

export const init = () => ({
  model: {
    seed: 1,
    hovered: Option.none(),
    raised: [],
    quality: 1,
    fps: Option.none(),
  } satisfies Model,
});

export const buildingKey = (index: number): string => `b${index}`;

/** Reads a building index back from an instance key. */
export const buildingOf = (key: string): Option.Option<number> =>
  Option.filter(
    Option.liftPredicate(Number.parseInt(key.slice(1), 10), Number.isInteger),
    (index) => key.startsWith('b') && index >= 0 && index < buildingCount,
  );
