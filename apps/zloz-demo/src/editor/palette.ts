import {
  createArchitectureNode,
  placementForScope,
  resolvePlacementControls,
  updatePlacementControls,
  type ZlozPaletteEntry,
  type ZlozPlacementInput,
} from '@opsydyn/foldkit-zloz';

import { workbenchPolicy } from './editor-policy';
import type { Model } from './model';
import { patternInsertionReason } from './pattern-insertion';

export const workbenchPalette: readonly ZlozPaletteEntry[] = [
  {
    id: 'c4-person',
    label: 'C4 person',
    intent: {
      source: { type: 'palette', id: 'c4-person' },
      anchor: { x: 0, y: 0 },
      snapping: { anchorDistance: 12 },
      fragment: {
        nodes: [
          createArchitectureNode({
            id: 'person',
            label: 'New person',
            position: { x: 0, y: 0 },
            size: { width: 180, height: 140 },
            ports: [],
            architecture: { family: 'c4', role: 'person' },
          }),
        ],
        edges: [],
      },
    },
  },
  {
    id: 'ddd-context',
    label: 'DDD bounded context',
    intent: {
      source: { type: 'palette', id: 'ddd-context' },
      anchor: { x: 0, y: 0 },
      snapping: { anchorDistance: 12 },
      fragment: {
        nodes: [
          createArchitectureNode({
            id: 'context',
            label: 'New context',
            position: { x: 0, y: 0 },
            size: { width: 240, height: 160 },
            ports: [],
            architecture: { family: 'ddd', role: 'bounded-context' },
          }),
        ],
        edges: [],
      },
    },
  },
];
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
