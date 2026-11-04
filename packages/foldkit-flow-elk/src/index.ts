import {
  FlowError,
  portPosition,
  validateGraph,
  type EdgeRoute,
  type LayoutEngine,
} from '@opsydyn/foldkit-flow';
import type { ELK as ElkInstance, ElkNode, ElkEdgeSection } from 'elkjs/lib/elk-api';
import ELK from 'elkjs/lib/elk.bundled.js';

export type ElkLayoutOptions = Readonly<{
  direction?: 'RIGHT' | 'DOWN';
  spacing?: number;
  /** Supply a worker-backed instance when needed; the caller owns its lifetime. */
  elk?: Pick<ElkInstance, 'layout'>;
}>;

function routePoints(sections: readonly ElkEdgeSection[], edgeId: string): EdgeRoute['points'] {
  const byId = new Map(sections.map((section) => [section.id, section]));
  const visited = new Set<string>();
  const points: Array<{ x: number; y: number }> = [];
  let current = sections.find((section) => !section.incomingSections?.length);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const previous = points.at(-1);
    if (
      previous &&
      (Math.abs(previous.x - current.startPoint.x) > 1e-6 ||
        Math.abs(previous.y - current.startPoint.y) > 1e-6)
    )
      break;
    if (!previous) points.push(current.startPoint);
    for (const bend of current.bendPoints ?? []) points.push(bend);
    points.push(current.endPoint);
    const outgoing = current.outgoingSections ?? [];
    if (outgoing.length === 0 && visited.size === sections.length)
      return points.map(({ x, y }) => ({ x, y }));
    const next = outgoing[0];
    if (outgoing.length !== 1 || next === undefined) break;
    current = byId.get(next);
  }
  throw new FlowError('invalid-layout', `ELK omitted a continuous route for ${edgeId}`);
}

/** Default invocations use in-process ELK. Caller-supplied worker instances remain caller-owned. */
export function createElkLayout(options: ElkLayoutOptions = {}): LayoutEngine {
  const spacing = options.spacing ?? 64;
  if (!Number.isFinite(spacing) || spacing <= 0)
    throw new FlowError('invalid-layout', 'Layout spacing must be positive and finite');
  return async (request) => {
    validateGraph(request.graph);
    const nodeIds = new Map(request.graph.nodes.map((node, index) => [node.id, `n:${index}`]));
    const portIds = new Map<string, Map<string, string>>();
    const hasGroups = request.graph.nodes.some((node) => node.kind === 'group');
    const children: ElkNode[] = [];
    const elkNodes = new Map(
      request.graph.nodes.map((node, index): [string, ElkNode] => {
        if (node.kind === 'group')
          return [
            node.id,
            {
              id: `n:${index}`,
              width: node.size.width,
              height: node.size.height,
              children: [],
              layoutOptions: { 'elk.padding': '[top=52,left=24,bottom=24,right=24]' },
            },
          ];
        const ports = new Map(node.ports.map((port, at) => [port.id, `p:${index}:${at}`]));
        portIds.set(node.id, ports);
        return [
          node.id,
          {
            id: `n:${index}`,
            width: node.size.width,
            height: node.size.height,
            layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
            ports: node.ports.map((port) => {
              const point = portPosition(node, port.id);
              const side = { left: 'WEST', right: 'EAST', top: 'NORTH', bottom: 'SOUTH' }[
                port.side
              ];
              return {
                id: ports.get(port.id) ?? '',
                width: 0,
                height: 0,
                x: point.x - node.position.x,
                y: point.y - node.position.y,
                layoutOptions: { 'elk.port.side': side },
              };
            }),
          },
        ];
      }),
    );
    for (const node of request.graph.nodes) {
      const elkNode = elkNodes.get(node.id);
      if (!elkNode) throw new FlowError('invalid-layout', `Missing input elkNode for ${node.id}`);
      const siblings =
        node.parentId === undefined ? children : elkNodes.get(node.parentId)?.children;
      if (!siblings) throw new FlowError('invalid-layout', `Missing parent elkNode for ${node.id}`);
      siblings.push(elkNode);
    }
    const graph: ElkNode = {
      id: 'graph',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.hierarchyHandling': hasGroups ? 'INCLUDE_CHILDREN' : 'SEPARATE_CHILDREN',
        'elk.json.shapeCoords': 'ROOT',
        'elk.json.edgeCoords': 'ROOT',
        'elk.direction': options.direction ?? 'RIGHT',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
      },
      children,
      edges: request.graph.edges.map((edge, index) => ({
        id: `e:${index}`,
        sources: [portIds.get(edge.source.node)?.get(edge.source.port) ?? ''],
        targets: [portIds.get(edge.target.node)?.get(edge.target.port) ?? ''],
      })),
    };
    const elk = options.elk ?? new ELK();
    const result = await elk.layout(graph);
    const laidOutNodes = new Map<string, ElkNode>();
    const laidOutEdges = new Map<string, ElkEdgeSection[]>();
    const pending = [result];
    while (pending.length > 0) {
      const node = pending.pop();
      if (!node) break;
      laidOutNodes.set(node.id, node);
      for (const edge of node.edges ?? []) laidOutEdges.set(edge.id, edge.sections ?? []);
      for (const child of node.children ?? []) pending.push(child);
    }
    const positions = request.graph.nodes.map((node) => {
      const laidOut = laidOutNodes.get(nodeIds.get(node.id) ?? '');
      if (
        !laidOut ||
        !Number.isFinite(laidOut.x) ||
        !Number.isFinite(laidOut.y) ||
        laidOut.x === undefined ||
        laidOut.y === undefined
      )
        throw new FlowError('invalid-layout', `ELK omitted position for ${node.id}`);
      const position = { id: node.id, x: laidOut.x, y: laidOut.y };
      if (node.kind !== 'group') return position;
      const { width, height } = laidOut;
      if (
        width === undefined ||
        height === undefined ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
      )
        throw new FlowError('invalid-layout', `ELK returned invalid bounds for ${node.id}`);
      return { ...position, size: { width, height } };
    });
    const routes: EdgeRoute[] = request.graph.edges.map((edge, index) => {
      const sections = laidOutEdges.get(`e:${index}`) ?? [];
      const points = routePoints(sections, edge.id);
      if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)))
        throw new FlowError('invalid-layout', `ELK returned an invalid route for ${edge.id}`);
      return { id: edge.id, points };
    });
    return { requestId: request.requestId, revision: request.revision, positions, routes };
  };
}
