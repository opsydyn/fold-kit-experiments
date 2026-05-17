import { lcg } from './lcg';
import type { Force, SimNode } from './types';

// D3 forceSimulation parity — headless Verlet integration loop.
// No timer/dispatch: designed to run synchronously to convergence in init().

const INITIAL_RADIUS = 10;
const INITIAL_ANGLE = Math.PI * (3 - Math.sqrt(5)); // golden angle

export interface Simulation {
  nodes: SimNode[];
  alpha: number;
  alphaMin: number;
  alphaDecay: number;
  alphaTarget: number;
  velocityDecay: number;
  addForce(name: string, force: Force): void;
  tick(iterations?: number): void;
}

export function createSimulation(nodes: SimNode[]): Simulation {
  const random = lcg();
  const forces = new Map<string, Force>();

  let alpha = 1;
  const alphaMin = 0.001;
  const alphaDecay = 1 - Math.pow(alphaMin, 1 / 300);
  const alphaTarget = 0;
  const velocityDecay = 0.6;

  function initNodes(): void {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      node.index = i;
      if (node.fx != null) node.x = node.fx;
      if (node.fy != null) node.y = node.fy;
      if (isNaN(node.x) || isNaN(node.y)) {
        const radius = INITIAL_RADIUS * Math.sqrt(0.5 + i);
        const angle = i * INITIAL_ANGLE;
        node.x = radius * Math.cos(angle);
        node.y = radius * Math.sin(angle);
      }
      if (isNaN(node.vx) || isNaN(node.vy)) {
        node.vx = node.vy = 0;
      }
    }
  }

  initNodes();

  function addForce(name: string, force: Force): void {
    forces.set(name, force);
    force.initialize(nodes, random);
  }

  function tick(iterations = 1): void {
    for (let k = 0; k < iterations; k++) {
      alpha += (alphaTarget - alpha) * alphaDecay;

      forces.forEach((force) => force(alpha));

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        if (node.fx == null) node.x += node.vx *= velocityDecay;
        else { node.x = node.fx; node.vx = 0; }
        if (node.fy == null) node.y += node.vy *= velocityDecay;
        else { node.y = node.fy; node.vy = 0; }
      }
    }
  }

  return {
    get nodes() { return nodes; },
    get alpha() { return alpha; },
    get alphaMin() { return alphaMin; },
    get alphaDecay() { return alphaDecay; },
    get alphaTarget() { return alphaTarget; },
    get velocityDecay() { return velocityDecay; },
    addForce,
    tick,
  };
}
