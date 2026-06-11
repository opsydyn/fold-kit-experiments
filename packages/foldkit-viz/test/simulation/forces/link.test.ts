import { describe, expect, it } from 'bun:test';
import { linkForce } from '../../../src/simulation/forces/link';
import type { SimNode } from '../../../src/simulation/types';

const node = (x: number, y: number, index = 0): SimNode => ({
  x,
  y,
  vx: 0,
  vy: 0,
  index,
});

describe('linkForce', () => {
  it('pulls two nodes closer when they are further than the target distance', () => {
    const a = node(0, 0, 0);
    const b = node(100, 0, 1); // far apart, target distance defaults to 30
    const force = linkForce({
      links: [{ source: 0, target: 1 }],
      distance: 30,
    });
    force.initialize([a, b], Math.random);
    force(1);
    expect(a.vx).toBeGreaterThan(0); // a pulled right toward b
    expect(b.vx).toBeLessThan(0); // b pulled left toward a
  });

  it('pushes two nodes apart when they are closer than the target distance', () => {
    const a = node(0, 0, 0);
    const b = node(5, 0, 1); // close together, target distance is 30
    const force = linkForce({
      links: [{ source: 0, target: 1 }],
      distance: 30,
    });
    force.initialize([a, b], Math.random);
    force(1);
    expect(a.vx).toBeLessThan(0); // a pushed left away from b
    expect(b.vx).toBeGreaterThan(0);
  });

  it('applies no force when nodes are exactly at target distance', () => {
    const a = node(0, 0, 0);
    const b = node(30, 0, 1); // exactly at distance 30
    const force = linkForce({
      links: [{ source: 0, target: 1 }],
      distance: 30,
    });
    force.initialize([a, b], Math.random);
    force(1);
    expect(a.vx).toBeCloseTo(0, 8);
    expect(b.vx).toBeCloseTo(0, 8);
  });

  it('unlinked nodes are unaffected', () => {
    const a = node(0, 0, 0);
    const b = node(10, 0, 1);
    const c = node(50, 0, 2); // no link involving c
    const force = linkForce({
      links: [{ source: 0, target: 1 }],
      distance: 30,
    });
    force.initialize([a, b, c], Math.random);
    force(1);
    expect(c.vx).toBe(0);
    expect(c.vy).toBe(0);
  });
});
