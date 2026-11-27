import { Option, Schema } from 'effect';

import { SceneStart } from '../effect-ui-scene';

/** The robot's clips, as the generated model names them. */
export const Clip = Schema.Literals(['wave', 'roll']);
export type Clip = typeof Clip.Type;
export const clips: ReadonlyArray<Clip> = Clip.literals;

/** What the loaded robot offers, and whether it is the finest of its levels yet. */
const RobotInfo = Schema.Struct({
  parts: Schema.Array(Schema.String),
  clips: Schema.Array(Schema.String),
  final: Schema.Boolean,
});
export type RobotInfo = typeof RobotInfo.Type;

const assetState = <S extends Schema.Top>(data: S) =>
  Schema.Union([
    Schema.TaggedStruct('Idle', {}),
    Schema.TaggedStruct('Loading', {}),
    Schema.TaggedStruct('Success', { data }),
    Schema.TaggedStruct('Failure', { error: Schema.String }),
  ]);

export const Model = Schema.Struct({
  /** Where the site serves the model and texture from, ending in `/`. */
  assetBase: Schema.String,
  /** Whether the scene asks for its assets: unloading is no longer asking. */
  wanted: Schema.Boolean,
  robot: assetState(RobotInfo),
  floor: assetState(Schema.Boolean),
  font: assetState(Schema.String),
  clip: Schema.NullOr(Clip),
  speed: Schema.Number,
  part: Schema.Option(Schema.String),
  sceneStatus: Schema.NullOr(SceneStart),
});
export type Model = typeof Model.Type;

/** Ids the assets are lent under in the shared store. */
export const assetIds = {
  robot: 'workshop-robot',
  floor: 'workshop-floor',
  font: 'workshop-font',
} as const;

export const initialModel = (assetBase: string): Model => ({
  assetBase,
  wanted: true,
  robot: { _tag: 'Loading' },
  floor: { _tag: 'Loading' },
  font: { _tag: 'Loading' },
  clip: 'wave',
  speed: 1,
  part: Option.none(),
  sceneStatus: null,
});
