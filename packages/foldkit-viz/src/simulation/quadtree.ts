import type { SimNode } from './types';

// ─── node types ───────────────────────────────────────────────────────────────
// Mirrors D3's quadtree: internal nodes are arrays-of-4; leaf nodes are objects.
// Both may carry .x .y .value set by Barnes-Hut accumulate phase.

export interface LeafQuad {
  data: SimNode;
  next?: LeafQuad;
  x?: number;
  y?: number;
  value?: number;
}

export type InternalQuad = Array<QuadNode | undefined> & {
  x?: number;
  y?: number;
  value?: number;
};

export type QuadNode = InternalQuad | LeafQuad;

export function isInternal(n: QuadNode): n is InternalQuad {
  return Array.isArray(n);
}

export function isLeaf(n: QuadNode): n is LeafQuad {
  return !Array.isArray(n);
}

// ─── quadtree state ───────────────────────────────────────────────────────────

export interface Quadtree {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  root: QuadNode | undefined;
  addAll(nodes: ReadonlyArray<SimNode>): void;
  visit(
    cb: (node: QuadNode, x0: number, y0: number, x1: number, y1: number) => boolean | undefined,
  ): void;
  visitAfter(cb: (node: QuadNode, x0: number, y0: number, x1: number, y1: number) => void): void;
}

export function createQuadtree(): Quadtree {
  let _x0 = NaN,
    _y0 = NaN,
    _x1 = NaN,
    _y1 = NaN;
  let _root: QuadNode | undefined;

  // ── cover ──────────────────────────────────────────────────────────────────
  // Expand the tree bounds to include (x, y). D3 cover.js parity.

  function cover(x: number, y: number): void {
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    if (Number.isNaN(_x0)) {
      // First point initialises extent to a unit square around floor(x)
      _x0 = Math.floor(x);
      _x1 = _x0 + 1;
      _y0 = Math.floor(y);
      _y1 = _y0 + 1;
      return;
    }

    // Double the extent until (x, y) is inside, wrapping the existing tree
    let z = _x1 - _x0 || 1;
    let node = _root;

    while (_x0 > x || x >= _x1 || _y0 > y || y >= _y1) {
      // Which quadrant does the existing content live in relative to the expansion?
      // i = (existing content is south) << 1 | (existing content is east)
      // equivalently: new point is north/west → i where existing is opposite
      const i = (((y < _y0) as unknown as number) << 1) | ((x < _x0) as unknown as number);
      const parent: InternalQuad = Object.assign(new Array(4) as InternalQuad, {
        x: undefined,
        y: undefined,
        value: undefined,
      });
      parent[i ^ 3] = node;
      node = parent;
      z *= 2;
      switch (i) {
        case 0:
          _x1 = _x0 + z;
          _y1 = _y0 + z;
          break;
        case 1:
          _x0 = _x1 - z;
          _y1 = _y0 + z;
          break;
        case 2:
          _x1 = _x0 + z;
          _y0 = _y1 - z;
          break;
        case 3:
          _x0 = _x1 - z;
          _y0 = _y1 - z;
          break;
      }
    }

    // Only replace root if tree had content and we wrapped it
    if (_root && isInternal(_root)) _root = node;
  }

  // ── add ────────────────────────────────────────────────────────────────────
  // D3 add.js parity — Verlet insertion with linked-list coincident chaining.

  function add(datum: SimNode, px: number, py: number): void {
    const leaf: LeafQuad = { data: datum };

    if (!_root) {
      _root = leaf;
      return;
    }

    let x0 = _x0,
      y0 = _y0,
      x1 = _x1,
      y1 = _y1;
    let parent: InternalQuad | undefined;
    let node = _root;
    let i = 0;

    // Walk down internal nodes to find the right slot
    while (isInternal(node)) {
      const xm = (x0 + x1) / 2;
      const ym = (y0 + y1) / 2;
      const right = px >= xm;
      const bottom = py >= ym;
      i = ((bottom ? 1 : 0) << 1) | (right ? 1 : 0);
      parent = node;
      const child = node[i];
      if (!child) {
        node[i] = leaf;
        return;
      }
      if (right) x0 = xm;
      else x1 = xm;
      if (bottom) y0 = ym;
      else y1 = ym;
      node = child;
    }

    // We've hit a leaf
    const lx = node.data.x;
    const ly = node.data.y;

    if (px === lx && py === ly) {
      // Coincident: prepend new leaf to the linked list (D3 parity)
      leaf.next = node.next ? node.next : undefined;
      node.next = leaf;
      return;
    }

    // Not coincident: subdivide until new and existing leaf separate
    do {
      const internal: InternalQuad = Object.assign(new Array(4) as InternalQuad, {
        x: undefined,
        y: undefined,
        value: undefined,
      });
      if (parent) parent[i] = internal;
      else _root = internal;
      parent = internal;

      const xm = (x0 + x1) / 2;
      const ym = (y0 + y1) / 2;
      const ri = ((py >= ym ? 1 : 0) << 1) | (px >= xm ? 1 : 0);
      const li2 = ((ly >= ym ? 1 : 0) << 1) | (lx >= xm ? 1 : 0);
      i = ri;

      if (ri !== li2) {
        internal[li2] = node;
        internal[ri] = leaf;
        return;
      }

      // Still same quadrant — narrow bounds and repeat
      if (ri & 1) x0 = xm;
      else x1 = xm;
      if (ri >> 1) y0 = ym;
      else y1 = ym;
    } while (true); // eslint-disable-line no-constant-condition
  }

  // ── addAll ─────────────────────────────────────────────────────────────────
  // Compute bounds first, cover, then insert each node. D3 addAll parity.

  function addAll(nodes: ReadonlyArray<SimNode>): void {
    if (nodes.length === 0) return;

    let x0min = Infinity,
      y0min = Infinity,
      x1max = -Infinity,
      y1max = -Infinity;
    const xs: number[] = [];
    const ys: number[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      const x = n.x,
        y = n.y;
      if (Number.isNaN(x) || Number.isNaN(y)) {
        xs.push(NaN);
        ys.push(NaN);
        continue;
      }
      xs.push(x);
      ys.push(y);
      if (x < x0min) x0min = x;
      if (x > x1max) x1max = x;
      if (y < y0min) y0min = y;
      if (y > y1max) y1max = y;
    }

    if (x0min > x1max) return; // all NaN

    cover(x0min, y0min);
    cover(x1max, y1max);

    for (let i = 0; i < nodes.length; i++) {
      const xi = xs[i]!;
      const yi = ys[i]!;
      if (!Number.isNaN(xi) && !Number.isNaN(yi)) add(nodes[i]!, xi, yi);
    }
  }

  // ── visit ──────────────────────────────────────────────────────────────────
  // Top-down traversal. Callback returning true prunes the subtree.

  function visit(
    cb: (node: QuadNode, x0: number, y0: number, x1: number, y1: number) => boolean | undefined,
  ): void {
    if (!_root) return;

    interface Frame {
      node: QuadNode;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }
    const stack: Frame[] = [{ node: _root, x0: _x0, y0: _y0, x1: _x1, y1: _y1 }];

    while (stack.length > 0) {
      const frame = stack.pop()!;
      const { node, x0, y0, x1, y1 } = frame;
      const prune = cb(node, x0, y0, x1, y1);
      if (!prune && isInternal(node)) {
        const xm = (x0 + x1) / 2;
        const ym = (y0 + y1) / 2;
        // Push children (D3 visit pushes 3,2,1,0 so they pop 0,1,2,3)
        if (node[3]) stack.push({ node: node[3]!, x0: xm, y0: ym, x1, y1 });
        if (node[2]) stack.push({ node: node[2]!, x0, y0: ym, x1: xm, y1 });
        if (node[1]) stack.push({ node: node[1]!, x0: xm, y0, x1, y1: ym });
        if (node[0]) stack.push({ node: node[0]!, x0, y0, x1: xm, y1: ym });
      }
    }
  }

  // ── visitAfter ─────────────────────────────────────────────────────────────
  // Post-order traversal (children before parents). D3 visitAfter.js parity.

  function visitAfter(
    cb: (node: QuadNode, x0: number, y0: number, x1: number, y1: number) => void,
  ): void {
    if (!_root) return;

    interface Frame {
      node: QuadNode;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }
    const quads: Frame[] = [];
    const next: Frame[] = [];

    quads.push({ node: _root, x0: _x0, y0: _y0, x1: _x1, y1: _y1 });

    while (quads.length > 0) {
      const frame = quads.pop()!;
      next.push(frame);
      if (isInternal(frame.node)) {
        const { node, x0, y0, x1, y1 } = frame;
        const xm = (x0 + x1) / 2;
        const ym = (y0 + y1) / 2;
        if (node[0]) quads.push({ node: node[0]!, x0, y0, x1: xm, y1: ym });
        if (node[1]) quads.push({ node: node[1]!, x0: xm, y0, x1, y1: ym });
        if (node[2]) quads.push({ node: node[2]!, x0, y0: ym, x1: xm, y1 });
        if (node[3]) quads.push({ node: node[3]!, x0: xm, y0: ym, x1, y1 });
      }
    }

    while (next.length > 0) {
      const frame = next.pop()!;
      cb(frame.node, frame.x0, frame.y0, frame.x1, frame.y1);
    }
  }

  return {
    get x0() {
      return _x0;
    },
    get y0() {
      return _y0;
    },
    get x1() {
      return _x1;
    },
    get y1() {
      return _y1;
    },
    get root() {
      return _root;
    },
    addAll,
    visit,
    visitAfter,
  };
}
