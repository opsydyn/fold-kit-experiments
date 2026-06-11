import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { manyBodyForce } from '../../../src/simulation/forces/many-body';
import type { SimNode } from '../../../src/simulation/types';

const node = (x: number, y: number, index = 0): SimNode => ({
  x,
  y,
  vx: 0,
  vy: 0,
  index,
});

const lcg = () => {
  let s = 1;
  return () => ((s = (Math.imul(1664525, s) + 1013904223) | 0) >>> 0) / 4294967296;
};

describe('manyBodyForce — repulsion', () => {
  it('two nodes repel each other (velocities point away)', () => {
    const a = node(0, 0, 0);
    const b = node(4, 0, 1);
    const force = manyBodyForce({ strength: -30 });
    force.initialize([a, b], lcg());
    force(1);
    // a should move left (negative vx), b should move right (positive vx)
    expect(a.vx).toBeLessThan(0);
    expect(b.vx).toBeGreaterThan(0);
  });

  it('repulsion is symmetric: equal and opposite velocities for symmetric layout', () => {
    const a = node(-2, 0, 0);
    const b = node(2, 0, 1);
    const force = manyBodyForce({ strength: -30 });
    force.initialize([a, b], lcg());
    force(1);
    expect(a.vx).toBeCloseTo(-b.vx, 5);
    expect(a.vy).toBeCloseTo(-b.vy, 5);
  });

  it('distanceMin prevents infinite force for coincident nodes', () => {
    const a = node(0, 0, 0);
    const b = node(0, 0, 1); // exactly coincident
    const force = manyBodyForce({ strength: -30, distanceMin: 1 });
    force.initialize([a, b], lcg());
    expect(() => force(1)).not.toThrow();
    expect(Number.isFinite(a.vx)).toBe(true);
    expect(Number.isFinite(b.vx)).toBe(true);
  });

  it('stronger charge produces larger velocity change (property)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
        (alpha) => {
          const a1 = node(0, 0, 0);
          const b1 = node(4, 0, 1);
          const a2 = node(0, 0, 0);
          const b2 = node(4, 0, 1);

          const weak = manyBodyForce({ strength: -10 });
          const strong = manyBodyForce({ strength: -60 });
          weak.initialize([a1, b1], lcg());
          strong.initialize([a2, b2], lcg());
          weak(alpha);
          strong(alpha);

          expect(Math.abs(a2.vx)).toBeGreaterThan(Math.abs(a1.vx));
        },
      ),
    );
  });
});
