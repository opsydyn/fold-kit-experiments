import {
  createArchitecturePattern,
  insertPattern,
  type ArchitecturePattern,
} from '@opsydyn/foldkit-zloz';

import { workbenchPolicy } from './editor-policy';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';

export function patternInsertionReason(model: Model): string | null {
  if (model.historyReview) return 'Return to the working model before inserting a pattern.';
  if (model.protectPatternInsertion) return 'Pattern insertion is protected in this workspace.';
  if (modelSessionBusy(model))
    return 'Finish active edits, imports or layout before inserting a pattern.';
  if (model.editor.readOnly) return 'The working model is read-only.';
  if (model.editor.historyLimit === 0) return 'Enable graph Undo before inserting a pattern.';
  return null;
}
export function insertWorkbenchPattern(model: Model, pattern: ArchitecturePattern): Model {
  const reason = patternInsertionReason(model);
  if (reason !== null) return { ...model, notice: reason };
  const right = Math.max(
    0,
    ...model.editor.graph.nodes.map((node) => node.position.x + node.size.width),
  );
  const result = insertPattern(model.editor, createArchitecturePattern(pattern), {
    offset: { x: right + 80, y: 40 },
    policy: { ...workbenchPolicy(model), canInsertPattern: () => patternInsertionReason(model) },
  });
  if (result.type === 'blocked') return { ...model, notice: result.reason };
  return {
    ...model,
    editor: result.editor,
    notice: 'Pattern added beside the existing diagram. Undo removes the whole insertion.',
  };
}
