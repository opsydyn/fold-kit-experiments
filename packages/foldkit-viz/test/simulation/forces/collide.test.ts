import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { collideForce } from '../../../src/simulation/forces/collide';
import type { SimNode } from '../../../src/simulation/types';

const node = (x: number, y: number, index = 0): SimNode => ({
  x,
  y,
  vx: 0,
  vy: 0,
  index,
});

describe('collideForce', () => {
  it('overlapping nodes are pushed apart', () => {
    const a = node(0, 0, 0);
    const b = node(5, 0, 1); // distance 5, radius 10 → overlap of 15
    const force = collideForce({ radius: 10 });
    force.initialize([a, b], Math.random);
    force(1);
    // a pushed left, b pushed right
    expect(a.x + a.vx).toBeLessThan(b.x + b.vx);
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('non-overlapping nodes are unaffected', () => {
    const a = node(0, 0, 0);
    const b = node(100, 0, 1); // distance 100, radius 5 → no overlap
    const force = collideForce({ radius: 5 });
    force.initialize([a, b], Math.random);
    force(1);
    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });

  it('after sufficient iterations, no two nodes overlap (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.float({ min: -50, max: 50, noNaN: true }),
            y: fc.float({ min: -50, max: 50, noNaN: true }),
          }),
          { minLength: 2, maxLength: 10 },
        ),
        (pts) => {
          const radius = 8;
          const nodes = pts.map((p, i) => node(p.x, p.y, i));
          const force = collideForce({ radius, iterations: 5 });
          force.initialize(nodes, Math.random);

          // Apply force multiple times to allow convergence
          for (let t = 0; t < 20; t++) {
            for (const n of nodes) {
              n.x += n.vx;
              n.y += n.vy;
              n.vx = 0;
              n.vy = 0;
            }
            force(0.5);
          }

          // Check no two nodes overlap
          for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
              const ni = nodes[i]!;
              const nj = nodes[j]!;
              const dx = ni.x - nj.x;
              const dy = ni.y - nj.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              // Allow a small tolerance for floating point
              expect(dist).toBeGreaterThanOrEqual(radius * 2 - 0.5);
            }
          }
        },
      ),
    );
  });
});
