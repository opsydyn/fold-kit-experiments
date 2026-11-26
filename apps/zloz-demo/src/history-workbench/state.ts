import { Command } from '@effect/ui';
import {
  appendEditionV2,
  captureConnectionDocument,
  captureModelDocumentV2,
  compareEditionsV2,
  createModelEditorV2,
  createHistoryReviewV2,
  updateHistoryReviewV2,
  updateEditor,
  createEditionPlaybackV2,
  updateEditionPlaybackV2,
  reviewEditionPlaybackV2,
  mergeEditionsV2,
  resolveHistoryChangeFocusV2,
  resolveHistoryChangeStepV2,
  resolveEditionRestoreV2,
  restoreEditionV2,
  serializeEditionsV2,
  serializeModelDocumentV2,
  type EditorState,
  type EditorEvent,
  type ZlozEditionV2,
  type ZlozModelDocumentV2,
  type ZlozHistoryReviewV2,
  type ZlozEditionPlaybackV2,
  type ZlozHistoryChangeCursorV2,
  type ZlozHistoryChangeFocusRequestV2,
  type ZlozHistoryComparisonSideV2,
  type ZlozHistoryChangeFilters,
  type ZlozHistoryGhostVisibility,
} from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

import { ReadHistoryFile, DownloadHistory, byteLimit } from './command';
import { Message, Theme } from './message';
import { nativeInitial, nativeHandlers, type NativeState } from './native-authoring';
import { CreateNativeSession } from './native-command';
export { Message };
export const Model = Schema.Struct({
  section: Schema.Literals(['files', 'review', 'playback', 'restore', 'authoring', 'evidence']),
  native: Schema.fromJsonString(Schema.Unknown),
  editor: Schema.fromJsonString(Schema.Unknown),
  identity: Schema.fromJsonString(Schema.Unknown),
  editions: Schema.fromJsonString(Schema.Unknown),
  selectedId: Schema.String,
  baselineId: Schema.String,
  side: Schema.Literals(['baseline', 'selected']),
  review: Schema.fromJsonString(Schema.Unknown),
  playback: Schema.fromJsonString(Schema.Unknown),
  cursor: Schema.fromJsonString(Schema.Unknown),
  filters: Schema.fromJsonString(Schema.Unknown),
  ghosts: Schema.fromJsonString(Schema.Unknown),
  name: Schema.String,
  minimal: Schema.Boolean,
  minimap: Schema.Boolean,
  protectedRestore: Schema.Boolean,
  preview: Schema.fromJsonString(Schema.Unknown),
  reading: Schema.fromJsonString(Schema.Unknown),
  conflict: Schema.fromJsonString(Schema.Unknown),
  previousSession: Schema.fromJsonString(Schema.Unknown),
  epoch: Schema.Number,
  run: Schema.Number,
  sequence: Schema.Number,
  visible: Schema.Boolean,
  theme: Theme,
  systemDark: Schema.Boolean,
  notice: Schema.String,
});
type Session = Readonly<{
  editor: EditorState;
  identity: Pick<ZlozModelDocumentV2, 'id' | 'name' | 'origin'>;
  editions: readonly ZlozEditionV2[];
}>;
export type Model = Readonly<{
  section: 'files' | 'review' | 'playback' | 'restore' | 'authoring' | 'evidence';
  native: NativeState;
  previousSession: Session | null;
  editor: EditorState;
  identity: Pick<ZlozModelDocumentV2, 'id' | 'name' | 'origin'>;
  editions: readonly ZlozEditionV2[];
  selectedId: string;
  baselineId: string;
  side: ZlozHistoryComparisonSideV2;
  review: ZlozHistoryReviewV2 | null;
  playback: ZlozEditionPlaybackV2;
  cursor: ZlozHistoryChangeCursorV2 | null;
  filters: ZlozHistoryChangeFilters;
  ghosts: ZlozHistoryGhostVisibility;
  name: string;
  minimal: boolean;
  minimap: boolean;
  protectedRestore: boolean;
  preview: Readonly<{ edition: ZlozEditionV2; revision: number }> | null;
  reading: Readonly<{ token: number; revision: number; kind: 'model' | 'archive' }> | null;
  conflict: Readonly<{ existing: ZlozEditionV2; proposed: ZlozEditionV2 }> | null;
  epoch: number;
  run: number;
  sequence: number;
  visible: boolean;
  theme: typeof Theme.Type;
  systemDark: boolean;
  notice: string;
}>;
export function initialDocument(): ZlozModelDocumentV2 {
  const graph = {
    nodes: ['Orders', 'Billing'].map((label, i) => ({
      id: i === 0 ? 'a' : 'b',
      label,
      position: { x: 90 + i * 350, y: 140 },
      size: { width: 220, height: 130 },
      ports: [
        {
          id: 'in',
          kind: 'input' as const,
          side: i === 0 ? ('right' as const) : ('left' as const),
          offset: 0.5,
        },
        { id: 'out', kind: 'output' as const, side: 'bottom' as const, offset: 0.5 },
      ],
    })),
    edges: [],
  };
  const snapshot = captureConnectionDocument({ graph });
  const loose = captureConnectionDocument({
    connectionMode: 'loose',
    graph: {
      nodes: graph.nodes.map((node) =>
        node.id === 'a' ? { ...node, position: { x: 140, y: 320 } } : node,
      ),
      edges: [
        {
          id: 'shared-inputs',
          source: { node: 'a', port: 'in' },
          target: { node: 'b', port: 'in' },
          label: 'Loose-mode link',
        },
      ],
    },
  });
  return captureModelDocumentV2({
    id: 'history-workshop',
    name: 'Architecture history',
    snapshot,
    origin: null,
    editions: [
      { id: 'strict-start', name: 'Strict foundation', snapshot },
      { id: 'loose-evolved', name: 'Loose collaboration', snapshot: loose },
    ],
  });
}
type Transition = Readonly<{
  model: Model;
  commands?: readonly Command.Command<Message>[];
}>;

const editorOptions = {
  portAnchorSnapDistance: 0.05,
  portAnchorCornerSnapDistance: 0.1,
  portAnchorMidpointSnapDistance: 0.08,
};

export function init(): Transition {
  const document = initialDocument();
  return {
    commands: [CreateNativeSession.make({})],
    model: {
      section: 'review',
      native: nativeInitial(),
      previousSession: null,
      editor: createModelEditorV2(document, editorOptions),
      identity: { id: document.id, name: document.name, origin: document.origin },
      editions: document.editions,
      selectedId: 'loose-evolved',
      baselineId: 'strict-start',
      side: 'selected',
      review: null,
      playback: createEditionPlaybackV2(document.editions, { intervalMs: 1000 }),
      cursor: null,
      filters: { added: true, removed: true, changed: true },
      ghosts: { enabled: true, nodes: true, edges: true, movements: true },
      name: '',
      minimal: false,
      minimap: false,
      protectedRestore: false,
      preview: null,
      reading: null,
      conflict: null,
      epoch: 0,
      run: 0,
      sequence: 0,
      visible: true,
      theme: 'system',
      systemDark: false,
      notice: 'Working model is independent of edition review.',
    },
  };
}
export function documentFor(model: Model): ZlozModelDocumentV2 {
  return captureModelDocumentV2({
    ...model.identity,
    snapshot: captureConnectionDocument(model.editor),
    editions: model.editions,
  });
}
export function comparisonFor(model: Model) {
  const baseline = model.editions.find((item) => item.id === model.baselineId);
  const selected = model.editions.find((item) => item.id === model.selectedId);
  return baseline && selected ? compareEditionsV2(baseline, selected) : null;
}
export function targetFor(model: Model) {
  return model.editions.find(
    (item) => item.id === (model.side === 'baseline' ? model.baselineId : model.selectedId),
  );
}
export function restorePolicy(model: Model) {
  return {
    canRestoreEdition: () =>
      model.protectedRestore ? 'Edition restore is protected in this workspace.' : null,
  };
}
function pause(model: Model): Model {
  return {
    ...model,
    playback: updateEditionPlaybackV2(model.playback, { type: 'PauseClicked' }),
    run: model.run + 1,
  };
}
function review(model: Model): Model {
  const target = targetFor(model);
  return {
    ...pause(model),
    review: target ? createHistoryReviewV2(target, model.editor) : null,
    preview: null,
    cursor: null,
    epoch: model.epoch + 1,
  };
}
function loaded(model: Model, document: ZlozModelDocumentV2): Model {
  return {
    ...model,
    previousSession: { editor: model.editor, identity: model.identity, editions: model.editions },
    editor: createModelEditorV2(document, editorOptions),
    identity: { id: document.id, name: document.name, origin: document.origin },
    editions: document.editions,
    selectedId: document.editions.at(-1)?.id ?? '',
    baselineId: document.editions[0]?.id ?? '',
    side: 'selected',
    review: null,
    playback: createEditionPlaybackV2(document.editions, {
      reducedMotion: model.playback.cursor.reducedMotion,
      intervalMs: 1000,
    }),
    reading: null,
    preview: null,
    conflict: null,
    cursor: null,
    epoch: model.epoch + 1,
    run: model.run + 1,
    notice: 'V2 model opened with fresh independent Undo.',
    native: { ...model.native, text: '', patch: null, consent: null, packetConsent: null },
  };
}
function transport(model: Model, action: Parameters<typeof updateEditionPlaybackV2>[1]): Model {
  const playback = updateEditionPlaybackV2(model.playback, action);
  const inspected = reviewEditionPlaybackV2(playback, model.editor);
  return {
    ...model,
    playback,
    review: inspected,
    selectedId: inspected?.editionId ?? model.selectedId,
    side: 'selected',
    preview: null,
    cursor: null,
    epoch: model.epoch + 1,
    run: model.run + 1,
  };
}
function focus(model: Model, request: ZlozHistoryChangeFocusRequestV2): Model {
  const comparison = comparisonFor(model);
  const decision = resolveHistoryChangeFocusV2(comparison, model.side, request, {
    filters: model.filters,
  });
  if (decision.type === 'ignored') return model;
  if (decision.type === 'blocked') return { ...pause(model), notice: decision.reason };
  if (decision.target.type === 'mode')
    return {
      ...pause(model),
      cursor: decision.entry.request,
      notice: `Inspecting ${decision.target.side} connection mode: ${decision.target.connectionMode}. Camera unchanged.`,
    };
  const next = model.review ? pause(model) : review(model);
  return {
    ...next,
    review: next.review ? updateHistoryReviewV2(next.review, decision.target.event) : null,
    cursor: decision.entry.request,
    notice: 'Revealed change on the chosen side.',
  };
}
export function update(model: Model, message: Message): Transition {
  if (
    (model.native.inspection || model.native.pending) &&
    ![
      'ObservedEditor',
      'SelectedSection',
      'ClickedMinimal',
      'ClickedMinimap',
      'SelectedTheme',
      'ChangedSystemTheme',
      'ChangedReducedMotion',
      'ChangedVisibility',
      'SucceededNativeRead',
      'FailedNativeRead',
      'ClickedCancelNativeRead',
      'SelectedNativeSide',
      'ClickedCloseNativeReview',
      'CompletedNativeDownload',
      'FailedNativeDownload',
    ].includes(message._tag)
  )
    return {
      model: {
        ...model,
        native: {
          ...model.native,
          notice:
            'Close the artifact review or cancel its read before changing the working session.',
        },
      },
    };
  return Message.match(message, {
    ...nativeHandlers(model),
    ObservedEditor: ({ epoch, event: raw }) => {
      // SAFETY: the scoped native canvas emits EditorEvent; epoch/read guards reject obsolete bindings.
      const event = raw as EditorEvent;
      if (epoch !== model.epoch || (model.reading && event.type !== 'SurfaceMeasured'))
        return { model };
      if (model.native.inspection)
        return {
          model: {
            ...model,
            native: {
              ...model.native,
              inspection: {
                ...model.native.inspection,
                review: updateHistoryReviewV2(model.native.inspection.review, event),
              },
            },
          },
        };
      if (model.native.pending && event.type !== 'SurfaceMeasured') return { model };
      const next =
        event.type === 'SurfaceMeasured' ||
        event.type === 'NodeMeasured' ||
        event.type === 'FitViewAnimationFrame' ||
        (event.type === 'GestureCancelled' &&
          (model.review?.editor ?? model.editor).gesture.type === 'idle')
          ? model
          : pause(model);
      if (next.review)
        return { model: { ...next, review: updateHistoryReviewV2(next.review, event) } };
      const editor = updateEditor(next.editor, event);
      return {
        model: {
          ...next,
          editor,
          native:
            editor.revision !== model.editor.revision ||
            editor.connectionMode !== model.editor.connectionMode
              ? { ...next.native, consent: null, packetConsent: null }
              : next.native,
          notice:
            editor.notice !== model.editor.notice && editor.notice !== null
              ? editor.notice
              : next.notice,
          preview: editor.revision !== model.editor.revision ? null : next.preview,
          epoch:
            editor.connectionMode !== model.editor.connectionMode ? model.epoch + 1 : model.epoch,
        },
      };
    },
    ChangedName: ({ name }) => ({ model: { ...model, name } }),
    ClickedCapture: () => {
      if (model.reading || model.editor.gesture.type !== 'idle' || !model.name.trim())
        return {
          model: {
            ...model,
            notice: 'Enter an edition name and finish active work before capture.',
          },
        };
      let sequence = model.sequence + 1;
      while (model.editions.some((item) => item.id === `captured-${sequence}`)) sequence++;
      const result = appendEditionV2(model.editions, {
        id: `captured-${sequence}`,
        name: model.name,
        snapshot: captureConnectionDocument(model.editor),
      });
      if (result.type === 'blocked') return { model: { ...model, notice: result.reason } };
      return {
        model: {
          ...pause(model),
          sequence,
          editions: result.editions,
          playback: createEditionPlaybackV2(result.editions, {
            reducedMotion: model.playback.cursor.reducedMotion,
            intervalMs: 1000,
          }),
          preview: null,
          name: '',
          notice: 'Working graph and mode captured; working Undo preserved.',
        },
      };
    },
    SelectedSection: ({ section }) => ({
      model: {
        ...pause(model),
        section,
        preview: null,
        epoch: model.native.inspection && section !== 'evidence' ? model.epoch + 1 : model.epoch,
        native: {
          ...model.native,
          pending: section === model.section ? model.native.pending : null,
          inspection: section === 'evidence' ? model.native.inspection : null,
          consent: section === model.section ? model.native.consent : null,
        },
      },
    }),
    ClickedReview: () => ({ model: model.reading ? model : review(model) }),
    SelectedEdition: ({ id }) => ({
      model:
        model.reading || !model.editions.some((item) => item.id === id)
          ? model
          : review({ ...model, selectedId: id }),
    }),
    SelectedBaseline: ({ id }) => ({
      model:
        model.reading || !model.editions.some((item) => item.id === id)
          ? model
          : review({ ...model, baselineId: id }),
    }),
    SelectedSide: ({ side }) => ({ model: model.reading ? model : review({ ...model, side }) }),
    ClickedPresent: () => ({
      model: {
        ...pause(model),
        review: null,
        preview: null,
        cursor: null,
        epoch: model.epoch + 1,
        notice: 'Working model and its Undo are preserved.',
      },
    }),
    ClickedPreviousSession: () => {
      const previous = model.previousSession;
      if (!previous || model.reading) return { model };
      return {
        model: {
          ...pause(model),
          ...previous,
          previousSession: {
            editor: model.editor,
            identity: model.identity,
            editions: model.editions,
          },
          review: null,
          preview: null,
          cursor: null,
          conflict: null,
          selectedId: previous.editions.at(-1)?.id ?? '',
          baselineId: previous.editions[0]?.id ?? '',
          playback: createEditionPlaybackV2(previous.editions, {
            reducedMotion: model.playback.cursor.reducedMotion,
            intervalMs: 1000,
          }),
          epoch: model.epoch + 1,
          notice: 'Previous working session restored with its own Undo and mode.',
        },
      };
    },
    // SAFETY: native/custom package navigation controls emit scoped focus requests, rechecked by focus.
    ClickedChange: ({ request }) => ({
      model: model.reading ? model : focus(model, request as ZlozHistoryChangeFocusRequestV2),
    }),
    ClickedChangeStep: ({ direction }) => {
      if (model.reading) return { model };
      const result = resolveHistoryChangeStepV2(
        comparisonFor(model),
        model.side,
        model.cursor,
        direction,
        { filters: model.filters },
      );
      return {
        model:
          result.type === 'ready'
            ? focus(model, result.entry.request)
            : result.type === 'blocked'
              ? { ...pause(model), notice: result.reason }
              : model,
      };
    },
    ClickedFilter: ({ kind }) => ({
      model: { ...model, filters: { ...model.filters, [kind]: !model.filters[kind] } },
    }),
    ClickedGhost: ({ part }) => ({
      model: { ...model, ghosts: { ...model.ghosts, [part]: !model.ghosts[part] } },
    }),
    ClickedMinimal: () => ({ model: { ...model, minimal: !model.minimal } }),
    ClickedMinimap: () => ({ model: { ...model, minimap: !model.minimap } }),
    ClickedProtection: () => ({
      model: {
        ...pause(model),
        protectedRestore: !model.protectedRestore,
        preview: null,
        notice: 'Protection changed. Preview restore again.',
      },
    }),
    ClickedRestorePreview: () => {
      const edition = targetFor(model);
      if (!edition || !model.review)
        return { model: { ...model, notice: 'Review a checkpoint before restore.' } };
      const result = resolveEditionRestoreV2(model.editor, edition, {
        expectedRevision: model.editor.revision,
        policy: restorePolicy(model),
        busyReason: model.reading ? 'Import active.' : null,
      });
      return {
        model: {
          ...pause(model),
          preview:
            result.type === 'ready'
              ? { edition: result.edition, revision: model.editor.revision }
              : null,
          notice:
            result.type === 'blocked'
              ? result.reason
              : result.type === 'unchanged'
                ? 'Checkpoint already matches the working graph and mode.'
                : 'Review ready. Confirm to restore graph and mode with one Undo.',
        },
      };
    },
    ClickedRestoreConfirm: () => {
      if (!model.preview) return { model: { ...model, notice: 'Preview restore first.' } };
      const result = restoreEditionV2(model.editor, model.preview.edition, {
        expectedRevision: model.preview.revision,
        policy: restorePolicy(model),
        busyReason: model.reading ? 'Import active.' : null,
      });
      return {
        model:
          result.type === 'blocked'
            ? { ...model, notice: result.reason, preview: null }
            : {
                ...pause(model),
                editor: result.editor,
                review: null,
                preview: null,
                cursor: null,
                epoch: model.epoch + 1,
                notice:
                  'Checkpoint restored. Undo restores the previous graph and connection mode.',
              },
      };
    },
    ClickedRestoreCancel: () => ({ model: { ...model, preview: null } }),
    ClickedTransport: ({ action }) => ({
      model: model.reading || !model.visible ? model : transport(model, { type: action }),
    }),
    AdvancedPlayback: ({ run }) => ({
      model:
        run !== model.run ||
        model.reading ||
        !model.visible ||
        model.playback.cursor.status !== 'playing'
          ? model
          : transport(model, { type: 'Elapsed', milliseconds: 1000 }),
    }),
    ChangedReducedMotion: ({ reduced }) => ({
      model: {
        ...model,
        playback: updateEditionPlaybackV2(model.playback, {
          type: 'ReducedMotionChanged',
          reducedMotion: reduced,
        }),
        run: model.run + 1,
      },
    }),
    ChangedVisibility: ({ visible }) => ({ model: { ...pause(model), visible } }),
    SelectedTheme: ({ theme }) => ({ model: { ...model, theme } }),
    ChangedSystemTheme: ({ dark }) => ({ model: { ...model, systemDark: dark } }),
    ChoseFile: ({ kind, files: raw }) => {
      // SAFETY: OnFileChange supplies native File values; commands validate File identity and byte bounds.
      const file = (raw as readonly File[])[0];
      if (!file || model.reading || model.editor.gesture.type !== 'idle') return { model };
      if (file.size > byteLimit)
        return {
          model: { ...model, notice: 'File exceeds the 5 MiB limit. Working state preserved.' },
        };
      const token = model.sequence + 1;
      return {
        model: {
          ...pause(model),
          sequence: token,
          reading: { token, revision: model.editor.revision, kind },
          preview: null,
          notice: 'Reading a v2 file; current model remains active until validation succeeds.',
        },
        commands: [ReadHistoryFile.make({ token, kind, file })],
      };
    },
    ClickedCancelRead: () => ({
      commands: model.reading
        ? [Command.interrupt(ReadHistoryFile, { token: model.reading.token })]
        : [],
      model: {
        ...model,
        reading: null,
        sequence: model.sequence + 1,
        notice: 'Import cancelled; working state preserved.',
      },
    }),
    SucceededModelRead: ({ token, document }) => {
      if (!model.reading || token !== model.reading.token || model.reading.kind !== 'model')
        return { model };
      if (model.reading.revision !== model.editor.revision)
        return {
          model: {
            ...model,
            reading: null,
            notice: 'Working model changed; imported result discarded.',
          },
        };
      // SAFETY: ReadHistoryFile emits only strictly decoded v2 models after byte/UTF-8 validation.
      return { model: loaded(model, document as ZlozModelDocumentV2) };
    },
    SucceededArchiveRead: ({ token, editions }) => {
      if (!model.reading || token !== model.reading.token || model.reading.kind !== 'archive')
        return { model };
      if (model.reading.revision !== model.editor.revision)
        return {
          model: {
            ...model,
            reading: null,
            notice: 'Working model changed; imported result discarded.',
          },
        };
      // SAFETY: ReadHistoryFile emits strictly decoded v2 editions; merge revalidates the full collection.
      const result = mergeEditionsV2(model.editions, editions as readonly ZlozEditionV2[]);
      return {
        model:
          result.type === 'blocked'
            ? {
                ...model,
                reading: null,
                conflict: { existing: result.existing, proposed: result.proposed },
                notice: result.reason,
              }
            : {
                ...pause(model),
                reading: null,
                editions: result.editions,
                playback: createEditionPlaybackV2(result.editions, {
                  reducedMotion: model.playback.cursor.reducedMotion,
                  intervalMs: 1000,
                }),
                conflict: null,
                preview: null,
                notice:
                  result.type === 'merged'
                    ? 'V2 editions merged atomically; working Undo preserved.'
                    : 'Identical editions already present; no duplicates added.',
              },
      };
    },
    FailedRead: ({ token }) => ({
      model:
        model.reading?.token !== token
          ? model
          : {
              ...model,
              reading: null,
              notice:
                'Unsupported or invalid v2 model/archive (UTF-8, 5 MiB limit). Working state preserved.',
            },
    }),
    ClickedDownload: ({ kind }) => {
      const json =
        kind === 'model'
          ? serializeModelDocumentV2(documentFor(model))
          : serializeEditionsV2(model.editions);
      return new TextEncoder().encode(json).byteLength > byteLimit
        ? { model: { ...model, notice: 'Download exceeds the 5 MiB reopening limit.' } }
        : { model, commands: [DownloadHistory.make({ kind, json })] };
    },
    CompletedDownload: () => ({ model: { ...model, notice: 'Validated v2 file downloaded.' } }),
    FailedDownload: () => ({
      model: { ...model, notice: 'Download failed; model and editions preserved.' },
    }),
  });
}
