import { describe, expect, it } from 'bun:test';
import { createSimulation } from '../../src/simulation/simulation';
import type { SimNode } from '../../src/simulation/types';

const node = (x: number, y: number, index = 0): SimNode => ({
  x,
  y,
  vx: 0,
  vy: 0,
  index,
});

describe('simulation — alpha', () => {
  it('starts at 1', () => {
    const sim = createSimulation([node(0, 0)]);
    expect(sim.alpha).toBeCloseTo(1);
  });

  it('decreases each tick toward alphaTarget (0)', () => {
    const sim = createSimulation([node(0, 0)]);
    const before = sim.alpha;
    sim.tick();
    expect(sim.alpha).toBeLessThan(before);
  });

  it('converges below alphaMin after 300 ticks', () => {
    const sim = createSimulation([node(0, 0)]);
    sim.tick(300);
    expect(sim.alpha).toBeLessThan(sim.alphaMin);
  });
});

describe('simulation — node movement', () => {
  it('nodes with non-zero velocity move each tick', () => {
    const n = node(0, 0);
    n.vx = 10;
    const sim = createSimulation([n]);
    sim.tick();
    const first = sim.nodes[0];
    expect(first?.x).not.toBe(0);
  });

  it('velocity is damped by velocityDecay each tick', () => {
    const n = node(0, 0);
    n.vx = 10;
    const sim = createSimulation([n]);
    const vDecay = sim.velocityDecay;
    sim.tick();
    const first = sim.nodes[0];
    expect(Math.abs(first?.vx ?? 0)).toBeCloseTo(10 * vDecay);
  });

  it('fixed nodes (fx/fy) do not move', () => {
    const n: SimNode = { x: 5, y: 5, vx: 10, vy: 10, index: 0, fx: 5, fy: 5 };
    const sim = createSimulation([n]);
    sim.tick(10);
    const first = sim.nodes[0];
    expect(first?.x).toBe(5);
    expect(first?.y).toBe(5);
  });
});

describe('simulation — forces', () => {
  it('a force applied each tick accumulates velocity', () => {
    const n = node(0, 0);
    const sim = createSimulation([n]);
    const pushForce = Object.assign(
      (alpha: number) => {
        const first = sim.nodes[0];
        if (first) first.vx += 1 * alpha;
      },
      { initialize: () => {} },
    );
    sim.addForce('push', pushForce);
    sim.tick(5);
    const first = sim.nodes[0];
    expect(first?.x).toBeGreaterThan(0);
  });
});
