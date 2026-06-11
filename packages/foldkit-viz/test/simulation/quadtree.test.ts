import { describe, expect, it } from 'bun:test';
import fc from 'fast-check';
import { createQuadtree, isInternal, isLeaf } from '../../src/simulation/quadtree';
import type { SimNode } from '../../src/simulation/types';

const node = (x: number, y: number, index = 0): SimNode => ({
  x,
  y,
  vx: 0,
  vy: 0,
  index,
});

// ─── structure ────────────────────────────────────────────────────────────────

describe('quadtree — structure', () => {
  it('root is undefined for an empty tree', () => {
    const qt = createQuadtree();
    qt.addAll([]);
    expect(qt.root).toBeUndefined();
  });

  it('single point becomes the root leaf', () => {
    const qt = createQuadtree();
    qt.addAll([node(1, 1)]);
    expect(isLeaf(qt.root!)).toBe(true);
  });

  it('two points in different quadrants produce an internal root with two leaves', () => {
    const qt = createQuadtree();
    // Both within [0,4]: midpoint (2,2). Point A in nw, B in se.
    qt.addAll([node(1, 1, 0), node(3, 3, 1)]);
    expect(isInternal(qt.root!)).toBe(true);
  });

  it('coincident points form a linked-list leaf, not an internal node', () => {
    const qt = createQuadtree();
    qt.addAll([node(2, 2, 0), node(2, 2, 1)]);
    const root = qt.root!;
    expect(isLeaf(root)).toBe(true);
    // The two nodes are chained
    if (isLeaf(root)) {
      expect(root.next).toBeDefined();
      expect(root.next?.next).toBeUndefined();
    }
  });

  it('two points that share an initial quadrant are recursively subdivided', () => {
    const qt = createQuadtree();
    // Both land in nw of [0,4] — (0.5,0.5) and (1,1) are both x<2, y<2
    qt.addAll([node(0.5, 0.5, 0), node(1.5, 1.5, 1)]);
    // Root must be internal; nw child is either internal or has two leaves separated
    const root = qt.root!;
    expect(isInternal(root)).toBe(true);
  });
});

// ─── visitAfter ───────────────────────────────────────────────────────────────

describe('quadtree — visitAfter', () => {
  it('visits every leaf exactly once', () => {
    const points = [node(1, 1, 0), node(3, 1, 1), node(1, 3, 2), node(3, 3, 3)];
    const qt = createQuadtree();
    qt.addAll(points);
    const visited: number[] = [];
    qt.visitAfter((n) => {
      if (isLeaf(n)) visited.push(n.data.index);
    });
    expect(visited.sort()).toEqual([0, 1, 2, 3]);
  });

  it('visits children before their parent (post-order)', () => {
    const qt = createQuadtree();
    qt.addAll([node(1, 1, 0), node(3, 3, 1)]);
    const order: Array<'leaf' | 'internal'> = [];
    qt.visitAfter((n) => {
      order.push(isLeaf(n) ? 'leaf' : 'internal');
    });
    // All leaf visits must come before any internal visit in this 2-node tree
    const firstInternal = order.indexOf('internal');
    const lastLeaf = order.lastIndexOf('leaf');
    expect(lastLeaf).toBeLessThan(firstInternal);
  });
});

// ─── visit ────────────────────────────────────────────────────────────────────

describe('quadtree — visit (top-down)', () => {
  it('visits all nodes when callback never prunes', () => {
    const points = [node(1, 1, 0), node(3, 1, 1), node(1, 3, 2), node(3, 3, 3)];
    const qt = createQuadtree();
    qt.addAll(points);
    const visitCount = { leaf: 0, internal: 0 };
    qt.visit((n) => {
      if (isLeaf(n)) visitCount.leaf++;
      else visitCount.internal++;
      return false; // never prune
    });
    expect(visitCount.leaf).toBe(4);
    expect(visitCount.internal).toBeGreaterThan(0);
  });

  it('returning true for an internal node prevents its leaf children being visited', () => {
    // NW has 1 point (leaf child of root), NE has 2 points (forces an internal NE node).
    // Pruning the NE internal node should prevent its 2 leaf children from being visited.
    const pts = [
      node(0.5, 0.5, 0), // NW of root
      node(2.5, 0.5, 1), // NE of root — shares NE quadrant with index 2
      node(3.5, 0.5, 2), // NE of root — forces NE to become an internal node
    ];
    const qt = createQuadtree();
    qt.addAll(pts);
    const visited: number[] = [];
    qt.visit((n, x0) => {
      if (isLeaf(n)) visited.push(n.data.index);
      // Prune any internal node sitting in the right half (x0 >= 2)
      if (isInternal(n) && x0 >= 2) return true;
      return false;
    });
    // Only the left-half leaf should be visited; the two right-half leaves are pruned
    expect(visited).toEqual([0]);
  });
});

// ─── bounds ───────────────────────────────────────────────────────────────────

describe('quadtree — bounds', () => {
  it('extent covers all added points', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.float({ min: -100, max: 100, noNaN: true }),
            y: fc.float({ min: -100, max: 100, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (pts) => {
          const nodes = pts.map((p, i) => node(p.x, p.y, i));
          const qt = createQuadtree();
          qt.addAll(nodes);
          expect(qt.x0).toBeLessThanOrEqual(Math.min(...pts.map((p) => p.x)));
          expect(qt.y0).toBeLessThanOrEqual(Math.min(...pts.map((p) => p.y)));
          expect(qt.x1).toBeGreaterThanOrEqual(Math.max(...pts.map((p) => p.x)));
          expect(qt.y1).toBeGreaterThanOrEqual(Math.max(...pts.map((p) => p.y)));
        },
      ),
    );
  });
});
