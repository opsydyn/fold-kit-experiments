import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
export const Side = Schema.Literals(['baseline', 'selected']);
export const Theme = Schema.Literals(['system', 'light', 'dark']);
export const GhostPart = Schema.Literals(['enabled', 'nodes', 'edges', 'movements']);
export const Message = defineMessageUnion({
  ObservedEditor: { epoch: Schema.Number, event: Schema.Unknown },
  ChangedName: { name: Schema.String },
  ClickedCapture: {},
  SelectedSection: { section: Schema.Literals(['files', 'review', 'playback', 'restore']) },
  ClickedReview: {},
  SelectedEdition: { id: Schema.String },
  SelectedBaseline: { id: Schema.String },
  SelectedSide: { side: Side },
  ClickedPresent: {},
  ClickedPreviousSession: {},
  ClickedChange: { request: Schema.Unknown },
  ClickedChangeStep: { direction: Schema.Literals(['previous', 'next']) },
  ClickedFilter: { kind: Schema.Literals(['added', 'removed', 'changed']) },
  ClickedGhost: { part: GhostPart },
  ClickedMinimal: {},
  ClickedMinimap: {},
  ClickedRestorePreview: {},
  ClickedRestoreConfirm: {},
  ClickedRestoreCancel: {},
  ClickedProtection: {},
  ClickedTransport: {
    action: Schema.Literals([
      'PlayClicked',
      'PauseClicked',
      'RewindClicked',
      'PreviousClicked',
      'NextClicked',
    ]),
  },
  AdvancedPlayback: { run: Schema.Number },
  ChangedReducedMotion: { reduced: Schema.Boolean },
  ChangedVisibility: { visible: Schema.Boolean },
  SelectedTheme: { theme: Theme },
  ChangedSystemTheme: { dark: Schema.Boolean },
  ChoseFile: { kind: Schema.Literals(['model', 'archive']), files: Schema.Unknown },
  ClickedCancelRead: {},
  SucceededModelRead: { token: Schema.Number, document: Schema.Unknown },
  SucceededArchiveRead: { token: Schema.Number, editions: Schema.Unknown },
  FailedRead: { token: Schema.Number },
  ClickedDownload: { kind: Schema.Literals(['model', 'archive']) },
  CompletedDownload: {},
  FailedDownload: {},
});
export type Message = typeof Message.Type;
