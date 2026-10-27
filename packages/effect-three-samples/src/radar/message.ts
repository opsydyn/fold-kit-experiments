import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Category, Ring } from './data';
import { CategoryFilter, PointerInput } from './model';

export const Message = defineMessageUnion({
  HoveredBlip: { key: Schema.String },
  LeftBlip: { key: Schema.String },
  ClickedBlip: { key: Schema.String },
  DoubleClickedBlip: { key: Schema.String },
  ClickedEmptySpace: {},
  HoveredEgg: { key: Schema.String },
  LeftEgg: { key: Schema.String },
  ClickedMonolith: {},
  EnteredKonamiCode: {},
  AdvancedInvasion: { deltaTimeMs: Schema.Number },
  AdvancedComet: { deltaTimeMs: Schema.Number },
  ClickedEntry: { id: Schema.String },
  ClickedFlyTo: { id: Schema.String },
  ChangedQuery: { query: Schema.String },
  ChangedCategory: { category: CategoryFilter },
  ClickedRing: { ring: Ring },
  ClickedClearFilters: {},
  ClickedTurn: { direction: Schema.Literals(['left', 'right']) },
  ClickedResetView: {},
  ClickedUniverse: {},
  ClickedCluster: { category: Category },
  ClickedRelay: { to: Schema.String },
  AdvancedRelay: { deltaTimeMs: Schema.Number },
  ChangedReducedMotion: { isReducedMotion: Schema.Boolean },
  ChangedPointerInput: { input: PointerInput },
  ChangedEdition: { index: Schema.Number },
  ClickedPlay: {},
  AdvancedPlayback: { deltaTimeMs: Schema.Number },
  ClickedZoom: { direction: Schema.Literals(['in', 'out']) },
  ClickedRelationships: {},
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
