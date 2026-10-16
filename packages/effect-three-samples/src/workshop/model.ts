import { Option, Schema } from 'effect';
import type { AsyncData } from 'foldkit/asyncData';

/** The robot's clips, as the generated model names them. */
export const Clip = Schema.Literals(['wave', 'roll']);
export type Clip = typeof Clip.Type;
export const clips: ReadonlyArray<Clip> = Clip.literals;

/** What the loaded robot offers. */
export type RobotInfo = {
  readonly parts: ReadonlyArray<string>;
  readonly clips: ReadonlyArray<string>;
};

export const Model = Schema.Struct({
  /** Where the site serves the model and texture from, ending in `/`. */
  assetBase: Schema.String,
  robot: Schema.Unknown,
  floor: Schema.Unknown,
  clip: Schema.NullOr(Clip),
  speed: Schema.Number,
  part: Schema.Option(Schema.String),
});
export type Model = Omit<typeof Model.Type, 'robot' | 'floor'> & {
  readonly robot: AsyncData<RobotInfo, string>;
  /** The floor texture, settled to its id once lent. */
  readonly floor: AsyncData<string, string>;
};

/** Ids the assets are lent under in the shared store. */
export const assetIds = { robot: 'workshop-robot', floor: 'workshop-floor' } as const;

export const initialModel = (assetBase: string): Model => ({
  assetBase,
  robot: { _tag: 'Loading' },
  floor: { _tag: 'Loading' },
  clip: 'wave',
  speed: 1,
  part: Option.none(),
});
