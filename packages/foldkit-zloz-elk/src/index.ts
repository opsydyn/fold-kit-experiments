/**
 * Optional ELK layout adapter; the host owns request publication and worker lifetime.
 * @module ELK
 */
import {
  ZlozError,
  portPosition,
  portBoundaryPosition,
  validateLayoutRequest,
  resolveLayoutGroupHeader,
  type EdgeRoute,
  type LayoutEngine,
} from '@opsydyn/foldkit-zloz';
import type {
  ELK as ElkInstance,
  ElkNode,
  ElkEdgeSection,
  ElkLabel,
  LayoutOptions as ElkLayoutProperties,
} from 'elkjs/lib/elk-api';
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
  throw new ZlozError('invalid-layout', `ELK omitted a continuous route for ${edgeId}`);
}

/** Default invocations use in-process ELK. Caller-supplied worker instances remain caller-owned. */
export function createElkLayout(options: ElkLayoutOptions = {}): LayoutEngine {
  const spacing = options.spacing ?? 64;
  if (!Number.isFinite(spacing) || spacing <= 0)
    throw new ZlozError('invalid-layout', 'Layout spacing must be positive and finite');
  return async (request) => {
    validateLayoutRequest(request);
    const labelHints = new Map((request.edgeLabels ?? []).map((label) => [label.id, label]));
    const groupHeaders = new Map((request.groupHeaders ?? []).map((header) => [header.id, header]));
    const nodeIds = new Map(request.graph.nodes.map((node, index) => [node.id, `n:${index}`]));
    const portIds = new Map<string, Map<string, string>>();
    const hasGroups = request.graph.nodes.some((node) => node.kind === 'group');
    const layoutOptions = {
      'elk.algorithm': 'layered',
      'elk.direction': options.direction ?? 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': String(spacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
    } as const;
    const children: ElkNode[] = [];
    const elkNodes = new Map(
      request.graph.nodes.map((node, index): [string, ElkNode] => {
        if (node.kind === 'group') {
          const hint = groupHeaders.get(node.id);
          const header = hint ? resolveLayoutGroupHeader(node, hint) : undefined;
          const groupOptions: ElkLayoutProperties = {
            ...layoutOptions,
            'elk.padding': '[top=52,left=24,bottom=24,right=24]',
          };
          if (header) {
            const p = header.contentPadding;
            groupOptions['elk.padding'] =
              `[top=${p.top},left=${p.left},bottom=${p.bottom},right=${p.right}]`;
            groupOptions['elk.nodeSize.constraints'] = 'MINIMUM_SIZE';
            // ELK 0.12.1 transposes compound graph minima in DOWN, but leaf/empty group minima remain physical.
            // Keep this correction behind the adapter; nested/empty, wide/tall real-engine regressions qualify upgrades.
            const transposed =
              options.direction === 'DOWN' &&
              request.graph.nodes.some((child) => child.parentId === node.id);
            const minimum = header.minimumSize;
            groupOptions['elk.nodeSize.minimum'] = transposed
              ? `(${minimum.height},${minimum.width})`
              : `(${minimum.width},${minimum.height})`;
          }
          return [
            node.id,
            {
              id: `n:${index}`,
              width: node.size.width,
              height: node.size.height,
              children: [],
              layoutOptions: groupOptions,
            },
          ];
        }
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
              const point = portBoundaryPosition(node, port.id);
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
      if (!elkNode) throw new ZlozError('invalid-layout', `Missing input elkNode for ${node.id}`);
      const siblings =
        node.parentId === undefined ? children : elkNodes.get(node.parentId)?.children;
      if (!siblings) throw new ZlozError('invalid-layout', `Missing parent elkNode for ${node.id}`);
      siblings.push(elkNode);
    }
    const graph: ElkNode = {
      id: 'graph',
      layoutOptions: {
        ...layoutOptions,
        'elk.hierarchyHandling': hasGroups ? 'INCLUDE_CHILDREN' : 'SEPARATE_CHILDREN',
        'elk.json.shapeCoords': 'ROOT',
        'elk.json.edgeCoords': 'ROOT',
      },
      children,
      edges: request.graph.edges.map((edge, index) => {
        const base = {
          id: `e:${index}`,
          sources: [portIds.get(edge.source.node)?.get(edge.source.port) ?? ''],
          targets: [portIds.get(edge.target.node)?.get(edge.target.port) ?? ''],
        };
        const hint = labelHints.get(edge.id);
        return hint
          ? {
              ...base,
              labels: [
                {
                  id: `l:${index}`,
                  text: edge.label?.trim() || 'label',
                  width: hint.size.width,
                  height: hint.size.height,
                  layoutOptions: { 'elk.edgeLabels.placement': 'CENTER' },
                },
              ],
            }
          : base;
      }),
    };
    const elk = options.elk ?? new ELK();
    const result = await elk.layout(graph);
    const laidOutNodes = new Map<string, ElkNode>();
    const laidOutEdges = new Map<string, ElkEdgeSection[]>();
    const laidOutLabels = new Map<string, readonly ElkLabel[]>();
    const pending = [result];
    while (pending.length > 0) {
      const node = pending.pop();
      if (!node) break;
      laidOutNodes.set(node.id, node);
      for (const edge of node.edges ?? []) {
        laidOutEdges.set(edge.id, edge.sections ?? []);
        laidOutLabels.set(edge.id, edge.labels ?? []);
      }
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
        throw new ZlozError('invalid-layout', `ELK omitted position for ${node.id}`);
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
        throw new ZlozError('invalid-layout', `ELK returned invalid bounds for ${node.id}`);
      return { ...position, size: { width, height } };
    });
    const routes: EdgeRoute[] = request.graph.edges.map((edge, index) => {
      const sections = laidOutEdges.get(`e:${index}`) ?? [];
      const points = routePoints(sections, edge.id);
      if (!points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)))
        throw new ZlozError('invalid-layout', `ELK returned an invalid route for ${edge.id}`);
      const sourceNode = request.graph.nodes.find((node) => node.id === edge.source.node);
      const targetNode = request.graph.nodes.find((node) => node.id === edge.target.node);
      const sourcePosition = positions.find((position) => position.id === edge.source.node);
      const targetPosition = positions.find((position) => position.id === edge.target.node);
      if (!sourceNode || !targetNode || !sourcePosition || !targetPosition)
        throw new ZlozError('invalid-layout', 'Missing routed endpoint');
      const anchored = [
        portPosition({ ...sourceNode, position: sourcePosition }, edge.source.port),
        ...points,
        portPosition({ ...targetNode, position: targetPosition }, edge.target.port),
      ];
      const route = {
        id: edge.id,
        points: anchored.filter((point, index) => {
          const previous = anchored[index - 1];
          return !previous || previous.x !== point.x || previous.y !== point.y;
        }),
      };
      const hint = labelHints.get(edge.id);
      if (!hint) return route;
      const labels = laidOutLabels.get(`e:${index}`) ?? [],
        label = labels[0];
      if (
        labels.length !== 1 ||
        !label ||
        label.id !== `l:${index}` ||
        label.x === undefined ||
        label.y === undefined ||
        !Number.isFinite(label.x) ||
        !Number.isFinite(label.y) ||
        label.width !== hint.size.width ||
        label.height !== hint.size.height
      )
        throw new ZlozError('invalid-layout', `ELK omitted a valid label box for ${edge.id}`);
      return {
        ...route,
        label: {
          position: { x: label.x + hint.size.width / 2, y: label.y + hint.size.height / 2 },
          size: { ...hint.size },
        },
      };
    });
    return { requestId: request.requestId, revision: request.revision, positions, routes };
  };
}
