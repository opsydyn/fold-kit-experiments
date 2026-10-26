import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Ring } from './data';
import { CategoryFilter } from './model';

export const Message = defineMessageUnion({
  HoveredBlip: { key: Schema.String },
  LeftBlip: { key: Schema.String },
  ClickedBlip: { key: Schema.String },
  ClickedEmptySpace: {},
  ClickedEntry: { id: Schema.String },
  ChangedQuery: { query: Schema.String },
  ChangedCategory: { category: CategoryFilter },
  ClickedRing: { ring: Ring },
  ClickedClearFilters: {},
  ClickedTurn: { direction: Schema.Literals(['left', 'right']) },
  ClickedResetView: {},
  ClickedZoom: { direction: Schema.Literals(['in', 'out']) },
  ClickedRelationships: {},
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
