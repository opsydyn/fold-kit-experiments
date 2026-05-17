import { jiggle } from '../lcg';
import type { LeafQuad, QuadNode } from '../quadtree';
import { createQuadtree, isInternal, isLeaf } from '../quadtree';
import type { Force, SimNode } from '../types';

export interface ManyBodyConfig {
  strength?: number;
  distanceMin?: number;
  distanceMax?: number;
  theta?: number;
}

// D3 forceManyBody parity — Barnes-Hut O(n log n) repulsion/attraction.
export function manyBodyForce(config: ManyBodyConfig = {}): Force {
  const strengthVal = config.strength ?? -30;
  const distanceMin2 = (config.distanceMin ?? 1) ** 2;
  const distanceMax2 = (config.distanceMax ?? Infinity) ** 2;
  const theta2 = (config.theta ?? 0.9) ** 2;

  let nodes: SimNode[] = [];
  let strengths: number[] = [];
  let random: () => number = Math.random;

  function initialize(): void {
    strengths = nodes.map(() => strengthVal);
  }

  // Bottom-up: accumulate aggregate charge and centroid for each quad — D3 accumulate parity.
  function accumulate(quad: QuadNode): void {
    let strength = 0;
    let weight = 0;
    let qx = 0;
    let qy = 0;

    if (isInternal(quad)) {
      for (let i = 0; i < 4; i++) {
        const child = quad[i];
        if (child == null) continue;
        const c = Math.abs(child.value ?? 0);
        if (c === 0) continue;
        strength += child.value ?? 0;
        weight += c;
        qx += c * (child.x ?? 0);
        qy += c * (child.y ?? 0);
      }
      quad.x = weight > 0 ? qx / weight : 0;
      quad.y = weight > 0 ? qy / weight : 0;
    } else {
      quad.x = quad.data.x;
      quad.y = quad.data.y;
      let leaf: LeafQuad | undefined = quad;
      while (leaf) {
        strength += strengths[leaf.data.index] ?? 0;
        leaf = leaf.next;
      }
    }

    quad.value = strength;
  }

  // Top-down: apply repulsion from one quad to one node — D3 apply parity.
  function applyToNode(node: SimNode, alpha: number, quad: QuadNode, x0: number, _y0: number, x1: number): boolean {
    if ((quad.value ?? 0) === 0) return true;

    const dx = (quad.x ?? 0) - node.x;
    const dy = (quad.y ?? 0) - node.y;
    const w = x1 - x0;
    let l = dx * dx + dy * dy;

    // Barnes-Hut: quad is far enough — treat as point mass and prune subtree
    if (w * w / theta2 < l) {
      if (l < distanceMax2) {
        let ex = dx, ey = dy;
        if (ex === 0) { ex = jiggle(random); l += ex * ex; }
        if (ey === 0) { ey = jiggle(random); l += ey * ey; }
        if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
        node.vx += ex * (quad.value ?? 0) * alpha / l;
        node.vy += ey * (quad.value ?? 0) * alpha / l;
      }
      return true;
    }

    // Quad is close — apply direct force for each point in the leaf's linked list
    if (isLeaf(quad)) {
      let leaf: LeafQuad | undefined = quad;
      while (leaf) {
        if (leaf.data !== node) {
          let ex = leaf.data.x - node.x;
          let ey = leaf.data.y - node.y;
          let ll = ex * ex + ey * ey;
          if (ex === 0) { ex = jiggle(random); ll += ex * ex; }
          if (ey === 0) { ey = jiggle(random); ll += ey * ey; }
          if (ll < distanceMin2) ll = Math.sqrt(distanceMin2 * ll);
          const w2 = (strengths[leaf.data.index] ?? 0) * alpha / ll;
          node.vx += ex * w2;
          node.vy += ey * w2;
        }
        leaf = leaf.next;
      }
      return l >= distanceMax2;
    }

    return l >= distanceMax2;
  }

  const force = Object.assign(
    (alpha: number) => {
      const qt = createQuadtree();
      qt.addAll(nodes);
      qt.visitAfter(accumulate);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        qt.visit((quad, x0, y0, x1) => applyToNode(node, alpha, quad, x0, y0, x1));
      }
    },
    {
      initialize(ns: SimNode[], rng: () => number) {
        nodes = ns;
        random = rng;
        initialize();
      },
    },
  );

  return force;
}
