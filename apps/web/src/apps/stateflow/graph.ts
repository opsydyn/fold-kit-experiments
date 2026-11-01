import type { StateFlowGraph, StateFlowNodeRole } from '@opsydyn/foldkit-viz/stateflow';

import type { Model, TransitionFact } from './model';
import { specimenFor, stateTagOf, traceOf } from './replay';
import type { SpecimenEdge } from './specimen';

/** Whether a recorded fact took this edge. */
export const tookEdge = (
  record: TransitionFact,
  edge: Readonly<{ from: string; messageTag: string; target: string }>,
): boolean =>
  record.outcome === 'transitioned' &&
  record.from === edge.from &&
  record.target === edge.target &&
  record.messageTag === edge.messageTag;

/** The machine as graph records, counted and dated by the trace up to the scrubber. */
export const graphFor = (model: Model): StateFlowGraph => {
  const specimen = specimenFor(model);
  const trace = traceOf(model);
  const active = stateTagOf(model);
  const roleFor = (stateTag: string): StateFlowNodeRole => {
    if (stateTag === active) return 'active';
    if (specimen.errorStates.includes(stateTag)) return 'error';
    if (specimen.transientStates.includes(stateTag)) return 'transient';
    if (stateTag === specimen.initialTag) return 'initial';
    return 'normal';
  };
  const taken = (edge: SpecimenEdge) => trace.filter((record) => tookEdge(record, edge));
  return {
    nodes: specimen.stateTags.map((stateTag) => ({
      id: stateTag,
      label: stateTag,
      role: roleFor(stateTag),
      visitCount: trace.filter(
        (record) =>
          (record.outcome === 'transitioned' && record.target === stateTag) ||
          (record.sequence === 1 && record.from === stateTag),
      ).length,
    })),
    edges: specimen.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.target,
      event: edge.messageTag,
      guard: edge.guard,
      guardPosition: edge.guardPosition,
      transitionCount: taken(edge).length,
      lastSeenAt: taken(edge).at(-1)?.sequence,
    })),
  };
};
