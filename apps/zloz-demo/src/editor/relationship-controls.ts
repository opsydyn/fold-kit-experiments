import {
  resolveEventStormingRelationshipControls,
  resolveEventStormingRelationshipRequest,
  updateEditor,
  type EditorState,
  type ZlozEventStormingRelationshipRequest,
} from '@opsydyn/foldkit-zloz';

import { workbenchPolicy } from './editor-policy';
import { workbenchRelationshipOptions } from './event-storming-relationships';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
export function inspectedRelationshipId(editor: EditorState): string | null {
  return editor.graph.edges.find((edge) => editor.selectedEdges.includes(edge.id))?.id ?? null;
}
function controlsOptions(model: Model) {
  return {
    conventions: workbenchRelationshipOptions(model),
    policy: workbenchPolicy(model),
    blockedReason: model.historyReview
      ? 'Return to the working model before editing relationships.'
      : modelSessionBusy(model)
        ? 'Finish active edits, imports or layout before editing relationships.'
        : null,
  };
}
export function relationshipControlsContext(model: Model) {
  return resolveEventStormingRelationshipControls(
    model.editor,
    inspectedRelationshipId(model.editor),
    controlsOptions(model),
  );
}
export function editWorkbenchRelationship(
  model: Model,
  input: ZlozEventStormingRelationshipRequest & Readonly<{ modelId: string; epoch: number }>,
): Model {
  if (input.modelId !== model.modelIdentity.id || input.epoch !== model.modelEpoch) return model;
  const options = controlsOptions(model);
  const decision = resolveEventStormingRelationshipRequest(
    model.editor,
    inspectedRelationshipId(model.editor),
    input,
    options,
  );
  if (decision.type === 'blocked')
    return {
      ...model,
      editor: { ...model.editor, notice: decision.reason },
      notice: decision.reason,
    };
  if (decision.type !== 'ready') return model;
  const editor = updateEditor(model.editor, decision.event, options.policy);
  return editor.graph === model.editor.graph
    ? { ...model, editor }
    : {
        ...model,
        editor: { ...editor, notice: 'Relationship updated.' },
        notice: 'Relationship updated.',
      };
}
