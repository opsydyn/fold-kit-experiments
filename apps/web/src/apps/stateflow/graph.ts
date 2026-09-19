import type {
  StateFlowGraph,
  StateFlowGuard,
  StateFlowNodeRole,
} from '@opsydyn/foldkit-viz/stateflow';

import { diagnosticsMachine } from '../request-diagnostics/machine';
import type { Model, TransitionFact } from './model';

const roleFor = (stateTag: string, activeTag: string): StateFlowNodeRole => {
  if (stateTag === activeTag) return 'active';
  if (stateTag === 'Failed') return 'error';
  if (stateTag === 'Loading' || stateTag === 'Cancelling') return 'transient';
  return 'normal';
};

const guardFor = (guard: { readonly _tag: string }): StateFlowGuard => {
  if (guard._tag === 'When') return 'when';
  if (guard._tag === 'Otherwise') return 'otherwise';
  return 'unguarded';
};

const transitionCountFor = (
  trace: ReadonlyArray<TransitionFact>,
  edge: (typeof diagnosticsMachine.edges)[number],
): number =>
  trace.filter(
    (record) =>
      record.outcome === 'transitioned' &&
      record.from === edge.from &&
      record.target === edge.target &&
      record.messageTag === edge.messageTag,
  ).length;

export const graphFor = (model: Model): StateFlowGraph => ({
  nodes: diagnosticsMachine.stateTags.map((stateTag) => ({
    id: stateTag,
    label: stateTag,
    role: roleFor(stateTag, model.explorer._tag),
    visitCount: model.trace.filter(
      (record) =>
        (record.outcome === 'transitioned' && record.target === stateTag) ||
        (record.sequence === 1 && record.from === stateTag),
    ).length,
  })),
  edges: diagnosticsMachine.edges.map((edge) => ({
    id: [
      edge.from,
      edge.messageTag,
      edge.target,
      edge.guard._tag,
      edge.guard._tag === 'Unguarded' ? '' : edge.guard.position,
    ].join(':'),
    source: edge.from,
    target: edge.target,
    event: edge.messageTag,
    guard: guardFor(edge.guard),
    guardPosition: edge.guard._tag === 'Unguarded' ? undefined : edge.guard.position,
    transitionCount: transitionCountFor(model.trace, edge),
  })),
});
