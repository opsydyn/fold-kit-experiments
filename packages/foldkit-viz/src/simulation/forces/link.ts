import type { Force, SimNode } from '../types';

export interface LinkDatum {
  source: number; // index into nodes array
  target: number;
}

export interface LinkConfig {
  links: ReadonlyArray<LinkDatum>;
  distance?: number;
  strength?: number;
  iterations?: number;
}

// D3 forceLink parity — Hooke's law spring force between connected node pairs.
export function linkForce(config: LinkConfig): Force {
  const distance = config.distance ?? 30;
  const strengthVal = config.strength ?? 1;
  const iterations = config.iterations ?? 1;
  const links = config.links;

  let nodes: SimNode[] = [];

  const force = Object.assign(
    (alpha: number) => {
      for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          if (!link) continue;
          const s = nodes[link.source];
          const t = nodes[link.target];
          if (!s || !t) continue;

          let dx = t.x + t.vx - (s.x + s.vx);
          let dy = t.y + t.vy - (s.y + s.vy);
          let l = Math.sqrt(dx * dx + dy * dy);
          if (l === 0) continue;

          // Spring: l = (actual - target) / actual * alpha * strength
          l = ((l - distance) / l) * alpha * strengthVal;
          dx *= l;
          dy *= l;

          // Equal split (bias = 0.5 when degrees equal)
          s.vx += dx * 0.5;
          s.vy += dy * 0.5;
          t.vx -= dx * 0.5;
          t.vy -= dy * 0.5;
        }
      }
    },
    {
      initialize(ns: SimNode[]) {
        nodes = ns;
      },
    },
  );

  return force;
}
