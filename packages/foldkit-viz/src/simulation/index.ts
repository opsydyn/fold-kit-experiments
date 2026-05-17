import { centerForce } from './forces/center';
import { collideForce } from './forces/collide';
import { linkForce } from './forces/link';
import { manyBodyForce } from './forces/many-body';
import { createSimulation } from './simulation';
import type { SimNode } from './types';

export type { Force, SimNode } from './types';

// ─── public layout API ────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutLink {
  sourceId: string;
  targetId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ForceLayoutConfig {
  nodes: ReadonlyArray<GraphNode>;
  links: ReadonlyArray<GraphLink>;
  width?: number;
  height?: number;
  strength?: number;
  linkDistance?: number;
  collideRadius?: number;
  iterations?: number;
}

export interface ForceLayout {
  nodes: ReadonlyArray<LayoutNode>;
  links: ReadonlyArray<LayoutLink>;
}

// Runs the simulation headlessly to convergence and returns final positions.
// Safe to call synchronously — no timers, no side effects.
export function runForceLayout(config: ForceLayoutConfig): ForceLayout {
  const width = config.width ?? 400;
  const height = config.height ?? 240;
  const strength = config.strength ?? -80;
  const linkDistance = config.linkDistance ?? 60;
  const collideRadius = config.collideRadius ?? 18;
  const iterations = config.iterations ?? 300;

  const idToIndex = new Map<string, number>();
  const simNodes: SimNode[] = config.nodes.map((n, i) => {
    idToIndex.set(n.id, i);
    return { x: 0, y: 0, vx: 0, vy: 0, index: i };
  });

  const simLinks = config.links
    .map((l) => ({ source: idToIndex.get(l.source) ?? -1, target: idToIndex.get(l.target) ?? -1 }))
    .filter((l) => l.source !== -1 && l.target !== -1);

  const sim = createSimulation(simNodes);
  sim.addForce('charge', manyBodyForce({ strength }));
  sim.addForce('link', linkForce({ links: simLinks, distance: linkDistance }));
  sim.addForce('center', centerForce({ cx: width / 2, cy: height / 2, strength: 0.1 }));
  sim.addForce('collide', collideForce({ radius: collideRadius, iterations: 2 }));
  sim.tick(iterations);

  const layoutNodes: LayoutNode[] = config.nodes.map((n, i) => ({
    id: n.id,
    x: Math.round(simNodes[i]?.x ?? 0),
    y: Math.round(simNodes[i]?.y ?? 0),
  }));

  const posMap = new Map(layoutNodes.map((n) => [n.id, n]));

  const layoutLinks: LayoutLink[] = config.links.flatMap((l) => {
    const src = posMap.get(l.source);
    const tgt = posMap.get(l.target);
    if (!src || !tgt) return [];
    return [{ sourceId: l.source, targetId: l.target, x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y }];
  });

  return { nodes: layoutNodes, links: layoutLinks };
}
