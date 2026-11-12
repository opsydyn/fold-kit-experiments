import {
  eventStormingRelationshipPolicy,
  dddRelationshipPolicy,
  resolveDddRelationship,
  resolveEventStormingRelationship,
  type ZlozEventStormingDddApplyPolicy,
  type EditorPolicy,
  type ZlozNode,
} from '@opsydyn/foldkit-zloz';
import { Option, Schema } from 'effect';

import { workbenchRelationshipOptions } from './event-storming-relationships';
import type { Model } from './model';
import { fixtureSocketPolicy } from './socket-policy';

const isProtected = Schema.is(Schema.Struct({ deletionProtected: Schema.Literal(true) }));

const requiredItemPolicy = {
  canDelete: (candidate) => {
    const node = candidate.nodes.find(({ data }) => isProtected(data));
    if (node) return `${node.label} is required.`;
    return candidate.edges.some(({ data }) => isProtected(data))
      ? 'This connection is required.'
      : null;
  },
} satisfies EditorPolicy;

function baseWorkbenchPolicy({
  protectDeletions,
  protectPortEdits,
  perPortSnapping,
  restrictedSnapTargets,
  overlappingPortSnaps,
  reconnectLock,
  portLocks,
  mixedPortProtection,
  editor,
  lockKeyNodes,
  lockNodeSizes,
  excludeSelection,
}: Pick<
  Model,
  | 'protectDeletions'
  | 'protectPortEdits'
  | 'perPortSnapping'
  | 'restrictedSnapTargets'
  | 'overlappingPortSnaps'
  | 'reconnectLock'
  | 'lockKeyNodes'
  | 'lockNodeSizes'
  | 'excludeSelection'
  | 'portLocks'
  | 'mixedPortProtection'
  | 'editor'
>): EditorPolicy & Required<Pick<EditorPolicy, 'canReconnect'>> {
  const canReconnect: NonNullable<EditorPolicy['canReconnect']> = (edge, end) =>
    edge.id === 'draft-review' && (reconnectLock === end || reconnectLock === 'both')
      ? end === 'source'
        ? 'Source reconnection is locked.'
        : 'Target reconnection is locked.'
      : null;
  const fixtureReason = mixedPortProtection ? fixtureSocketPolicy(editor.graph) : () => null;
  const canConnectPort: NonNullable<EditorPolicy['canConnectPort']> = ({ node, port }) => {
    if (portLocks.draftOutput && node === 'source' && port === 'out')
      return 'Draft output is closed to new connections.';
    return portLocks.publishInput && node === 'publish' && port === 'in'
      ? 'Publish input is closed to new connections.'
      : fixtureReason({ node, port });
  };
  const canEditPort: NonNullable<EditorPolicy['canEditPort']> = ({ node, port }) =>
    protectPortEdits && node.id === 'review' && port.id === 'in'
      ? 'Review input is managed upstream.'
      : null;
  const portAnchorSnap: EditorPolicy['portAnchorSnap'] =
    perPortSnapping || restrictedSnapTargets || overlappingPortSnaps
      ? ({ node, port }) => {
          if (overlappingPortSnaps && node.id === 'review' && port.id === 'in')
            return {
              distance: 0,
              cornerDistance: 60,
              midpointDistance: 60,
              hysteresis: 4,
              allowedCorners: ['top-left'],
              allowedMidpoints: ['left'],
            };
          if (overlappingPortSnaps && node.id === 'review' && port.id === 'out')
            return {
              distance: 0,
              cornerDistance: 60,
              midpointDistance: 60,
              hysteresis: 4,
              allowedCorners: ['top-right'],
              allowedMidpoints: ['right'],
              priority: 'corners-first',
            };
          if (restrictedSnapTargets && node.id === 'review' && port.id === 'in')
            return {
              distance: 12,
              cornerDistance: 12,
              midpointDistance: 18,
              hysteresis: 6,
              allowedEdges: [],
              allowedCorners: [],
              allowedMidpoints: ['left', 'right'],
            };
          if (restrictedSnapTargets && node.id === 'review' && port.id === 'out')
            return {
              distance: 12,
              cornerDistance: 12,
              midpointDistance: 12,
              allowedEdges: ['top'],
              allowedCorners: ['top-left', 'top-right'],
              allowedMidpoints: [],
            };
          if (!perPortSnapping) return undefined;
          if (node.id === 'review' && port.id === 'in')
            return { distance: 0, cornerDistance: 0, midpointDistance: 18, hysteresis: 6 };
          if (node.id === 'review' && port.id === 'out')
            return { distance: 0, cornerDistance: 12, midpointDistance: 0 };
          if (node.id === 'source' && port.id === 'out')
            return { distance: 0, cornerDistance: 0, midpointDistance: 0 };
          return undefined;
        }
      : undefined;
  const connections = { canReconnect, canConnectPort, canEditPort, portAnchorSnap };
  const policy = protectDeletions ? { ...requiredItemPolicy, ...connections } : connections;
  const movementPolicy = lockKeyNodes
    ? {
        ...policy,
        canMoveNode: (node: ZlozNode) =>
          node.id === 'review' || node.id === 'domain' ? `${node.label} is locked in place.` : null,
      }
    : policy;
  const resizePolicy: EditorPolicy & Required<Pick<EditorPolicy, 'canReconnect'>> = lockNodeSizes
    ? {
        ...movementPolicy,
        canResizeNode: (node) =>
          node.id === 'review' || node.id === 'core'
            ? `${node.label} dimensions are locked.`
            : null,
      }
    : movementPolicy;
  return excludeSelection
    ? {
        ...resizePolicy,
        canSelectNode: (node) =>
          node.id === 'review' ? 'Review is excluded from selection.' : null,
        canSelectEdge: (edge) =>
          edge.id === 'draft-review' ? 'Draft → Review is excluded from selection.' : null,
      }
    : resizePolicy;
}

type WorkbenchPolicyModel = Parameters<typeof baseWorkbenchPolicy>[0] &
  Pick<Model, 'semanticRelationships' | 'customStormingRelationships' | 'protectDddRelationships'> &
  Partial<Pick<Model, 'protectWaypointEdits'>>;
function editingWorkbenchPolicy(
  model: WorkbenchPolicyModel,
): EditorPolicy & Required<Pick<EditorPolicy, 'canReconnect'>> {
  const base = baseWorkbenchPolicy(model);
  return {
    ...base,
    canChangeEdgeWaypoints: () =>
      model.protectWaypointEdits
        ? 'Routing is managed by the architecture team. Disable bend protection to edit.'
        : null,
    canChangeEdgeArchitecture: (edge, next, graph) =>
      base.canChangeEdgeArchitecture?.(edge, next, graph) ??
      (model.protectDddRelationships && edge.id === 'orders-billing'
        ? 'Orders–Billing meaning is managed by the architecture team. Disable contract protection to edit.'
        : null),
  };
}
export function workbenchPolicy(
  model: WorkbenchPolicyModel,
): EditorPolicy & Required<Pick<EditorPolicy, 'canReconnect'>> {
  const editing = editingWorkbenchPolicy(model);
  return model.semanticRelationships
    ? {
        ...eventStormingRelationshipPolicy(
          workbenchRelationshipOptions(model),
          dddRelationshipPolicy({}, editing),
        ),
        canReconnect: editing.canReconnect,
      }
    : editing;
}
/** Conversion checks complete final semantics; individual edits keep source-graph semantics above. */
export function workbenchConversionPolicy(
  model: WorkbenchPolicyModel & Pick<Model, 'protectMappingApply'>,
): ZlozEventStormingDddApplyPolicy {
  type Guard = NonNullable<ZlozEventStormingDddApplyPolicy['canApplyEventStormingDddConversion']>;
  function resolve(
    plan: Parameters<Guard>[0],
    target: Parameters<Guard>[1],
  ): Option.Option<string> {
    if (model.protectMappingApply)
      return Option.some('Conversion Apply is protected in this workbench.');
    if (!model.semanticRelationships) return Option.none();
    const changedNodes = new Set(plan.changes.nodes.map((change) => change.nodeId));
    const changedEdges = new Set(plan.changes.edges.map((change) => change.edgeId));
    for (const edge of target.snapshot.graph.edges) {
      if (
        !changedEdges.has(edge.id) &&
        !changedNodes.has(edge.source.node) &&
        !changedNodes.has(edge.target.node)
      )
        continue;
      const decision =
        edge.architecture?.family === 'ddd'
          ? resolveDddRelationship(
              target.snapshot.graph,
              {
                sourceNodeId: edge.source.node,
                targetNodeId: edge.target.node,
                architecture: edge.architecture,
              },
              plan.mappings.relationships,
            )
          : resolveEventStormingRelationship(
              target.snapshot.graph,
              edge,
              workbenchRelationshipOptions(model),
            );
      if (decision.type === 'blocked')
        return Option.some(`${edge.label || edge.id}: ${decision.reason}`);
    }
    return Option.none();
  }
  return {
    ...editingWorkbenchPolicy(model),
    // The public editor policy uses null for an allowed decision.
    canApplyEventStormingDddConversion: (plan, target) => Option.getOrNull(resolve(plan, target)),
  };
}
