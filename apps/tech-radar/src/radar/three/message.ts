import { Tooltip } from '@foldkit/ui';
import { SceneSchema } from '@opsydyn/effect-three';
import * as EffectThreeFoldkit from '@opsydyn/effect-three-foldkit';
import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { Category, Ring } from './data';
import { CategoryFilter, IconControl, PointerInput } from './model';
import { ColorScheme, ContrastSetting, ThemeChoice } from './themes';

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
  ChangedColorScheme: { scheme: ColorScheme },
  ChangedContrast: { contrast: ContrastSetting },
  ChoseTheme: { choice: ThemeChoice },
  SucceededLoadThemeChoice: { choice: ThemeChoice },
  CompletedSaveThemeChoice: {},
  CompletedReplaceLink: {},
  ClickedCopyLink: {},
  CompletedCopyLink: { outcome: Schema.Literals(['copied', 'refused']) },
  ClickedRecord: {},
  ClickedStopRecording: {},
  ClickedPlayTour: {},
  ClickedStopTour: {},
  AdvancedTour: { deltaTimeMs: Schema.Number },
  ClickedSaveTour: {},
  CompletedSaveTour: {},
  ClickedLoadTour: {},
  SucceededLoadTour: { recording: Schema.Unknown },
  FailedLoadTour: { reason: Schema.String },
  CancelledLoadTour: {},
  ChangedEdition: { index: Schema.Number },
  ClickedPlay: {},
  AdvancedPlayback: { deltaTimeMs: Schema.Number },
  ClickedZoom: { direction: Schema.Literals(['in', 'out']) },
  ClickedRelationships: {},
  ToggledEntries: { isOpen: Schema.Boolean },
  GotTooltipMessage: { control: IconControl, message: Tooltip.Message },
  MadeGesture: { gesture: SceneSchema.Gesture },
  ReceivedSceneLifecycle: { lifecycle: EffectThreeFoldkit.SceneLifecycle },
});
export type Message = typeof Message.Type;
