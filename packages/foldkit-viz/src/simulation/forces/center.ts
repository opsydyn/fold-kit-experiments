import type { Force, SimNode } from '../types';

export interface CenterConfig {
  cx?: number;
  cy?: number;
  strength?: number;
}

// D3 forceCenter parity — pulls all nodes toward (cx, cy).
export function centerForce(config: CenterConfig = {}): Force {
  const cx = config.cx ?? 0;
  const cy = config.cy ?? 0;
  const strength = config.strength ?? 0.1;
  let nodes: SimNode[] = [];

  const force = Object.assign(
    (alpha: number) => {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n) {
          n.vx += (cx - n.x) * strength * alpha;
          n.vy += (cy - n.y) * strength * alpha;
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
