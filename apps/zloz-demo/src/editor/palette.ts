import {
  placementForScope,
  resolvePlacementControls,
  updatePlacementControls,
  type ZlozPlacementInput,
} from '@opsydyn/foldkit-zloz';

import { workbenchPalette } from '../architecture-palette';
import { workbenchPolicy } from './editor-policy';
import type { Model } from './model';
import { patternInsertionReason } from './pattern-insertion';

function context(model: Model) {
  return { scope: `${model.modelIdentity.id}/${model.modelEpoch}`, editor: model.editor };
}
function policy(model: Model) {
  return {
    ...workbenchPolicy(model),
    canStartPlacement: () => patternInsertionReason(model),
    canPlace: () => patternInsertionReason(model),
  };
}
export function workbenchPlacement(model: Model) {
  const current = context(model);
  return resolvePlacementControls(
    placementForScope(model.placement, current.scope),
    current,
    workbenchPalette,
    policy(model),
  );
}
export function updateWorkbenchPlacement(model: Model, input: ZlozPlacementInput): Model {
  const current = context(model);
  const result = updatePlacementControls(
    placementForScope(model.placement, current.scope),
    current,
    workbenchPalette,
    input,
    policy(model),
  );
  return {
    ...model,
    editor: result.editor,
    placement: result.placement,
    notice: result.notice || model.notice,
  };
}
