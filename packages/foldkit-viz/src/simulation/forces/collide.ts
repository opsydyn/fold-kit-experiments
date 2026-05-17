import { jiggle } from '../lcg';
import type { Force, SimNode } from '../types';

export interface CollideConfig {
  radius?: number;
  strength?: number;
  iterations?: number;
}

// D3 forceCollide parity — iterative overlap relaxation (O(n²) per iteration).
// At n≤100 this is fast enough; the manyBody Barnes-Hut handles the O(n log n) critical path.
export function collideForce(config: CollideConfig = {}): Force {
  const radius = config.radius ?? 1;
  const strength = config.strength ?? 1;
  const iterations = config.iterations ?? 1;

  let nodes: SimNode[] = [];
  let random: () => number = Math.random;

  const force = Object.assign(
    (_alpha: number) => {
      for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          if (!a) continue;
          const ax = a.x + a.vx;
          const ay = a.y + a.vy;

          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            if (!b) continue;

            let dx = (b.x + b.vx) - ax;
            let dy = (b.y + b.vy) - ay;
            // Jiggle coincident nodes so they always have a direction to separate
            if (dx === 0) dx = jiggle(random);
            if (dy === 0) dy = jiggle(random);
            const l = Math.sqrt(dx * dx + dy * dy);
            const minDist = radius * 2;

            if (l < minDist) {
              const overlap = (minDist - l) / l * strength;
              dx *= overlap;
              dy *= overlap;
              a.vx -= dx * 0.5;
              a.vy -= dy * 0.5;
              b.vx += dx * 0.5;
              b.vy += dy * 0.5;
            }
          }
        }
      }
    },
    {
      initialize(ns: SimNode[], rng: () => number) {
        nodes = ns;
        random = rng;
      },
    },
  );

  return force;
}
