import { describe, expect, it } from 'bun:test';

import { orbitGeometry } from '../src/chart/orbit';

type Module = Readonly<{ id: string; risk: number; integration: string }>;
const accessors = {
  key: (d: Module) => d.id,
  value: (d: Module) => d.risk,
  halo: (d: Module) => d.integration,
};
const modules = (count: number): ReadonlyArray<Module> =>
  Array.from({ length: count }, (_, index) => ({
    id: `m${index}`,
    risk: index % 11,
    integration: ['intrusive', 'contract', 'functional'][index % 3] ?? 'contract',
  }));
const close = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThan(1e-9);
};

describe('orbit geometry', () => {
  it('places nodes clockwise from twelve o’clock on one ring, keeping datum and order', () => {
    const data = modules(4);
    const geometry = orbitGeometry(data, accessors, { size: 260 });
    const ring = geometry.ring.radius;
    expect(geometry.nodes.map((node) => node.key)).toEqual(['m0', 'm1', 'm2', 'm3']);
    expect(geometry.nodes[2]?.datum).toBe(data[2]);
    const expected = [
      [0, -ring],
      [ring, 0],
      [0, ring],
      [-ring, 0],
    ];
    geometry.nodes.forEach((node, index) => {
      close(node.angle, (index * Math.PI) / 2);
      close(node.x, expected[index]?.[0] ?? Number.NaN);
      close(node.y, expected[index]?.[1] ?? Number.NaN);
    });
  });

  it('scales node area, not radius, with value across the value domain', () => {
    const data = [
      { id: 'low', risk: 0, integration: 'a' },
      { id: 'mid', risk: 5, integration: 'a' },
      { id: 'high', risk: 10, integration: 'a' },
    ];
    const geometry = orbitGeometry(data, accessors, {
      size: 400,
      nodeRadius: { min: 4, max: 12 },
    });
    const [low, mid, high] = geometry.nodes.map((node) => node.radius);
    close(low ?? Number.NaN, 4);
    close(high ?? Number.NaN, 12);
    close((mid ?? Number.NaN) ** 2, (4 ** 2 + 12 ** 2) / 2);
  });

  it('clamps values outside an explicit value domain', () => {
    const data = [
      { id: 'under', risk: -0, integration: 'a' },
      { id: 'over', risk: 50, integration: 'a' },
    ];
    const geometry = orbitGeometry(data, accessors, {
      size: 400,
      nodeRadius: { min: 3, max: 9 },
      valueDomain: [2, 10],
    });
    expect(geometry.nodes.map((node) => node.radius)).toEqual([3, 9]);
  });

  it('keeps every node inside the chart and clear of its neighbours, however many there are', () => {
    for (const count of [1, 2, 3, 12, 42, 120, 300]) {
      const geometry = orbitGeometry(modules(count), accessors, { size: 260, padding: 8 });
      const limit = 260 / 2 - 8;
      for (const [index, node] of geometry.nodes.entries()) {
        expect(Math.hypot(node.x, node.y) + node.radius).toBeLessThanOrEqual(limit + 1e-9);
        const next = geometry.nodes[(index + 1) % geometry.nodes.length];
        if (next !== undefined && next !== node)
          expect(Math.hypot(next.x - node.x, next.y - node.y)).toBeGreaterThanOrEqual(
            node.radius + next.radius,
          );
      }
    }
  });

  it('uses the configured largest radius while the ring has room', () => {
    const geometry = orbitGeometry(modules(3), accessors, {
      size: 260,
      nodeRadius: { min: 4, max: 12 },
    });
    expect(geometry.nodeRadius).toEqual({ min: 4, max: 12 });
  });

  it('shrinks both radius bounds when the ring is crowded', () => {
    const geometry = orbitGeometry(modules(300), accessors, {
      size: 260,
      nodeRadius: { min: 4, max: 12 },
    });
    expect(geometry.nodeRadius.max).toBeLessThan(4);
    expect(geometry.nodeRadius.min).toBe(geometry.nodeRadius.max);
  });

  it('builds the halo from category counts in first-seen order, inside the node ring', () => {
    const geometry = orbitGeometry(modules(7), accessors, { size: 260, haloPadAngle: 0 });
    expect(geometry.halo.arcs.map(({ key, count }) => [key, count])).toEqual([
      ['intrusive', 3],
      ['contract', 2],
      ['functional', 2],
    ]);
    const sweep = geometry.halo.arcs.reduce((sum, arc) => sum + arc.endAngle - arc.startAngle, 0);
    close(sweep, Math.PI * 2);
    const smallestNode = Math.min(
      ...geometry.nodes.map((node) => Math.hypot(node.x, node.y) - node.radius),
    );
    expect(geometry.halo.outerRadius).toBeLessThan(smallestNode);
    expect(geometry.halo.innerRadius).toBeLessThan(geometry.halo.outerRadius);
    expect(geometry.core.radius).toBeLessThan(geometry.halo.innerRadius);
  });

  it('lets the caller grow or shrink the core within the halo', () => {
    const full = orbitGeometry(modules(12), accessors, { size: 260 });
    const half = orbitGeometry(modules(12), accessors, { size: 260, coreScale: 0.5 });
    expect(full.core.radius).toBe(full.core.maxRadius);
    close(half.core.radius, full.core.maxRadius / 2);
  });

  it('draws no halo when its width is zero', () => {
    const geometry = orbitGeometry(modules(6), accessors, { size: 260, haloWidth: 0 });
    expect(geometry.halo.arcs).toEqual([]);
  });

  it('returns an empty orbit for no data', () => {
    const geometry = orbitGeometry([], accessors, { size: 260 });
    expect(geometry.nodes).toEqual([]);
    expect(geometry.halo.arcs).toEqual([]);
    expect(geometry.core.radius).toBeGreaterThan(0);
    expect(geometry.centre).toBe(130);
  });

  it.each([
    ['duplicate keys', [...modules(2), { id: 'm0', risk: 1, integration: 'a' }], {}],
    ['an empty key', [{ id: '', risk: 1, integration: 'a' }], {}],
    ['a negative value', [{ id: 'a', risk: -1, integration: 'a' }], {}],
    ['a non-finite value', [{ id: 'a', risk: Number.NaN, integration: 'a' }], {}],
    ['an empty halo category', [{ id: 'a', risk: 1, integration: '' }], {}],
    ['a non-positive size', modules(2), { size: 0 }],
    ['padding that leaves no room', modules(2), { padding: 130 }],
    ['inverted radius bounds', modules(2), { nodeRadius: { min: 8, max: 4 } }],
    ['a zero minimum radius', modules(2), { nodeRadius: { min: 0, max: 4 } }],
    ['a reversed value domain', modules(2), { valueDomain: [5, 1] }],
    ['a core scale above one', modules(2), { coreScale: 1.5 }],
    ['a zero core scale', modules(2), { coreScale: 0 }],
    ['a negative halo width', modules(2), { haloWidth: -1 }],
    ['too many nodes for the size', modules(400), { size: 40 }],
  ] as const)('rejects %s', (_, data, config) => {
    expect(() => orbitGeometry(data, accessors, { size: 260, ...config })).toThrow(RangeError);
  });
});
