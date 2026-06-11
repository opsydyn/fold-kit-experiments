import { describe, expect, it } from 'bun:test';
import { centerForce } from '../../../src/simulation/forces/center';
import type { SimNode } from '../../../src/simulation/types';

const node = (x: number, y: number, index = 0): SimNode => ({
  x,
  y,
  vx: 0,
  vy: 0,
  index,
});

describe('centerForce', () => {
  it('nudges a node to the right of center leftward', () => {
    const n = node(10, 0); // cx=0, so node is to the right
    const force = centerForce({ cx: 0, cy: 0 });
    force.initialize([n], Math.random);
    force(1);
    expect(n.vx).toBeLessThan(0);
  });

  it('nudges a node below center upward', () => {
    const n = node(0, 10); // cy=0, so node is below
    const force = centerForce({ cx: 0, cy: 0 });
    force.initialize([n], Math.random);
    force(1);
    expect(n.vy).toBeLessThan(0);
  });

  it('applies no force to a node already at center', () => {
    const n = node(0, 0);
    const force = centerForce({ cx: 0, cy: 0 });
    force.initialize([n], Math.random);
    force(1);
    expect(n.vx).toBe(0);
    expect(n.vy).toBe(0);
  });

  it('force is proportional to alpha', () => {
    const n1 = node(10, 0);
    const n2 = node(10, 0);
    const force1 = centerForce({ cx: 0, cy: 0 });
    const force2 = centerForce({ cx: 0, cy: 0 });
    force1.initialize([n1], Math.random);
    force2.initialize([n2], Math.random);
    force1(0.5);
    force2(1.0);
    expect(Math.abs(n2.vx)).toBeGreaterThan(Math.abs(n1.vx));
  });
});
