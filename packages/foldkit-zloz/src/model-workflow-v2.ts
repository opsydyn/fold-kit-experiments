import { createEditorFromConnectionDocument, updateEditor } from './editor';
import { isHistoryNavigationEvent } from './history';
import {
  captureEditionV2,
  captureModelDocumentV2,
  type ZlozEditionV2,
  type ZlozModelDocumentV2,
} from './model-document-v2';
import type { EditorEvent, EditorOptions, EditorPolicy, EditorState } from './types';

/** Transient navigation plus an immutable selected checkpoint, never the working editor or an Apply request. */
export type ZlozHistoryReviewV2 = Readonly<{
  editionId: string;
  edition: ZlozEditionV2;
  editor: EditorState & Readonly<{ readOnly: true }>;
}>;

/** Validate the whole canonical model, then start a detached current-mode session with fresh history. */
export function createModelEditorV2(
  document: ZlozModelDocumentV2,
  options: EditorOptions = {},
): EditorState {
  const checked = captureModelDocumentV2(document);
  return createEditorFromConnectionDocument(checked.snapshot, options);
}

/** The checkpoint owns graph/mode/camera. Only navigation preferences and surface size come from present. */
export function createHistoryReviewV2(
  edition: ZlozEditionV2,
  present: EditorState,
): ZlozHistoryReviewV2 {
  const checked = captureEditionV2(edition);
  const editor = createEditorFromConnectionDocument(checked.snapshot, {
    readOnly: true,
    historyLimit: 0,
    viewport: checked.snapshot.viewport ?? present.viewport,
    zoomLimits: present.zoomLimits,
    fitViewPadding: present.fitViewPadding,
  });
  return {
    editionId: checked.id,
    edition: checked,
    editor: {
      ...editor,
      readOnly: true,
      surface: present.surface === null ? null : { ...present.surface },
    },
  };
}

/** Reuse the fail-closed history navigation whitelist; authored edits, node measurements and Undo never enter the reducer. */
export function updateHistoryReviewV2(
  review: ZlozHistoryReviewV2,
  event: EditorEvent,
  policy: EditorPolicy = {},
): ZlozHistoryReviewV2 {
  if (!isHistoryNavigationEvent(event)) return review;
  const editor = updateEditor(review.editor, event, policy);
  return editor === review.editor ? review : { ...review, editor: { ...editor, readOnly: true } };
}
