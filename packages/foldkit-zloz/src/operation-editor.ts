import { commitGraph } from './editor';
import { canonicalOperationValue } from './operation-codec';
import type {
  ZlozOperationDocument,
  ZlozOperationPolicy,
  ZlozOperationRequest,
  ZlozOperationScope,
} from './operation-types';
import { decideOperation, rejectOperation } from './operations';
import type { EditorState } from './types';

/** Explicit local transaction bridge. Remote delivery/reconciliation must not use snapshot Undo. */
export function applyEditorOperation(
  editor: EditorState,
  document: ZlozOperationDocument,
  request: ZlozOperationRequest,
  scope: ZlozOperationScope,
  policy: ZlozOperationPolicy = {},
) {
  const decision =
    editor.readOnly || editor.gesture.type !== 'idle'
      ? rejectOperation(
          document,
          request,
          scope,
          'Protected',
          'Finish the gesture in an editable diagram before submitting an operation',
        )
      : canonicalOperationValue(editor.graph) !== canonicalOperationValue(document.graph)
        ? rejectOperation(
            document,
            request,
            scope,
            'Conflict',
            'The editor and authored document must agree before a local transaction',
          )
        : decideOperation(document, request, scope, policy);
  return {
    editor: decision.type === 'accepted' ? commitGraph(editor, decision.document.graph) : editor,
    decision,
  };
}
