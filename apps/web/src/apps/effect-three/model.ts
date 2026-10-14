import { Option, Schema } from 'effect';

import type { AppInitProps } from '../types';

export const Paint = Schema.Literals(['teal', 'amber']);
export type Paint = typeof Paint.Type;

export const CubeSize = Schema.Literals(['small', 'large']);
export type CubeSize = typeof CubeSize.Type;

export const SceneStatus = Schema.Literals(['starting', 'running', 'failed']);
export type SceneStatus = typeof SceneStatus.Type;

export const Model = Schema.Struct({
  paint: Paint,
  size: CubeSize,
  showSecondCube: Schema.Boolean,
  showScene: Schema.Boolean,
  hovered: Schema.Option(Schema.String),
  clicks: Schema.Number,
  status: SceneStatus,
});
export type Model = typeof Model.Type;

export const init = (_props: AppInitProps) => ({
  model: {
    paint: 'teal',
    size: 'small',
    showSecondCube: true,
    showScene: true,
    hovered: Option.none(),
    clicks: 0,
    status: 'starting',
  } satisfies Model,
});
