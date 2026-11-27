import {
  createPlacement,
  resolvePlacementControls,
  updatePlacementControls,
  type ZlozPlacement,
  type ZlozPlacementInput,
} from '@opsydyn/foldkit-zloz';

import { workbenchPalette } from '../architecture-palette';
import type { Model } from './state';

export const newHistoryPlacement = (epoch: number): ZlozPlacement =>
  createPlacement(`history-placement:${epoch}`);

export function placementAvailable(model: Model): boolean {
  return (
    model.section === 'authoring' &&
    !model.review &&
    !model.reading &&
    !model.native.inspection &&
    !model.native.pending &&
    !model.editor.readOnly
  );
}

function context(model: Model) {
  return {
    scope: model.placement.scope,
    editor: placementAvailable(model) ? model.editor : { ...model.editor, readOnly: true },
  };
}

function policy(model: Model) {
  const reason = () => (model.placementProtected ? 'Placement is protected.' : null);
  return { canStartPlacement: reason, canPlace: reason };
}

export function historyPlacement(model: Model) {
  return resolvePlacementControls(model.placement, context(model), workbenchPalette, policy(model));
}

export function updateHistoryPlacement(model: Model, input: ZlozPlacementInput): Model {
  if (!placementAvailable(model)) return model;
  const result = updatePlacementControls(
    model.placement,
    context(model),
    workbenchPalette,
    input,
    policy(model),
  );
  if (result.placement === model.placement && result.editor === model.editor && !result.notice)
    return model;
  const committed = result.editor.revision !== model.editor.revision;
  return {
    ...model,
    placement: result.placement,
    editor: result.editor,
    notice: result.notice || model.notice,
    native: committed ? { ...model.native, consent: null, packetConsent: null } : model.native,
    preview: committed ? null : model.preview,
  };
}

/** A section, read or model switch invalidates queued input from the previous authoring session. */
export function reconcileHistoryPlacement(before: Model, after: Model): Model {
  if (before.epoch !== after.epoch)
    return { ...after, placement: newHistoryPlacement(after.epoch) };
  if (
    before.section !== after.section ||
    placementAvailable(before) !== placementAvailable(after) ||
    (before.editor.revision !== after.editor.revision && after.placement.type === 'placing')
  ) {
    return {
      ...after,
      placement: {
        type: 'idle',
        scope: after.placement.scope,
        generation: after.placement.generation + 1,
      },
    };
  }
  return after;
}
