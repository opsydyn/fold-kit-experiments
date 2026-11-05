import type { StateFlowGraph } from '@opsydyn/foldkit-viz/stateflow';
import { describe, expect, it } from 'vitest';

import { graphFor } from './graph';
import { layoutLayered, nodeHalf } from './layered';
import { initModel } from './model';
import { checkoutSpecimen } from './specimens/checkout';

const diagnostics = graphFor(initModel);
const checkout = graphFor({
  ...initModel,
  specimen: checkoutSpecimen.id,
  events: checkoutSpecimen.sample,
});

describe('layered state layout', () => {
  it('ranks states along the flow from the initial state', () => {
    const { nodes } = layoutLayered(diagnostics, 'Loading', 'across');
    const x = (id: string) => nodes.find((node) => node.id === id)?.x ?? Number.NaN;

    expect(x('Loading')).toBeLessThan(x('Ready'));
    expect(x('Ready')).toBe(x('Failed'));
    expect(x('Ready')).toBeLessThan(x('Selecting'));
    expect(x('Selecting')).toBeLessThan(x('Filtered'));
    expect(x('Cancelling')).toBeLessThan(x('Idle'));
  });

  it('runs the ranks down the page when asked to', () => {
    const { nodes } = layoutLayered(diagnostics, 'Loading', 'down');
    const y = (id: string) => nodes.find((node) => node.id === id)?.y ?? Number.NaN;

    expect(y('Loading')).toBeLessThan(y('Ready'));
    expect(y('Filtered')).toBeLessThan(y('Cancelling'));
  });

  it('keeps every state, label and route inside the canvas, and no two states overlapping', () => {
    [diagnostics, checkout].forEach((graph) =>
      (['across', 'down'] as const).forEach((orientation) => {
        const placed = layoutLayered(graph, graph.nodes[0]?.id ?? '', orientation);
        placed.nodes.forEach((node) => {
          expect(node.x - nodeHalf.width).toBeGreaterThanOrEqual(0);
          expect(node.x + nodeHalf.width).toBeLessThanOrEqual(placed.width);
          expect(node.y - nodeHalf.height).toBeGreaterThanOrEqual(0);
          expect(node.y + nodeHalf.height).toBeLessThanOrEqual(placed.height);
          placed.nodes
            .filter((other) => other.id !== node.id)
            .forEach((other) => {
              const apart =
                Math.abs(other.x - node.x) >= nodeHalf.width * 2 ||
                Math.abs(other.y - node.y) >= nodeHalf.height * 2;
              expect(apart).toBe(true);
            });
        });
        placed.routes.forEach((route) => {
          expect(route.label.x - route.labelWidth / 2).toBeGreaterThanOrEqual(0);
          expect(route.label.x + route.labelWidth / 2).toBeLessThanOrEqual(placed.width);
          expect(route.path).toMatch(/^M[\d.-]+,[\d.-]+ C/);
        });
        expect(placed.routes).toHaveLength(graph.edges.length);
        expect([...placed.order].sort()).toEqual(graph.nodes.map(({ id }) => id).sort());
      }),
    );
  });

  // A crowded label would sit on a state or another label; the settling pass moves it clear.
  it('keeps every label clear of the states and of the other labels', () => {
    [diagnostics, checkout].forEach((graph) =>
      (['across', 'down'] as const).forEach((orientation) => {
        const placed = layoutLayered(graph, graph.nodes[0]?.id ?? '', orientation);
        const clear = (
          a: { readonly x: number; readonly y: number },
          b: { readonly x: number; readonly y: number },
          halfWidth: number,
          halfHeight: number,
        ) => Math.abs(a.x - b.x) >= halfWidth || Math.abs(a.y - b.y) >= halfHeight;
        placed.routes.forEach((route, index) => {
          placed.nodes.forEach((node) =>
            expect(
              clear(route.label, node, route.labelWidth / 2 + nodeHalf.width, 9 + nodeHalf.height),
            ).toBe(true),
          );
          placed.routes
            .slice(index + 1)
            .forEach((other) =>
              expect(
                clear(route.label, other.label, (route.labelWidth + other.labelWidth) / 2, 18),
              ).toBe(true),
            );
        });
      }),
    );
  });

  it('orders each rank to uncross the edges into it', () => {
    // Declared in this order, D would sit above E and the two edges into them would cross.
    const graph: StateFlowGraph = {
      nodes: ['A', 'B', 'C', 'D', 'E'].map((id) => ({
        id,
        label: id,
        role: 'normal',
        visitCount: 0,
      })),
      edges: [
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'E'],
        ['C', 'D'],
      ].map(([source = '', target = '']) => ({
        id: `${source}${target}`,
        source,
        target,
        event: `${source}to${target}`,
        guard: 'unguarded',
        transitionCount: 0,
      })),
    };
    const { nodes, order } = layoutLayered(graph, 'A', 'across');
    const y = (id: string) => nodes.find((node) => node.id === id)?.y ?? Number.NaN;

    expect(y('B')).toBeLessThan(y('C'));
    expect(y('E')).toBeLessThan(y('D'));
    expect(order.indexOf('E')).toBeLessThan(order.indexOf('D'));
  });

  it('gives edges between the same two states a lane each', () => {
    const placed = layoutLayered(checkout, 'Browsing', 'across');
    const between = (a: string, b: string) =>
      placed.routes.filter(
        ({ edge }) => [edge.source, edge.target].sort().join() === [a, b].sort().join(),
      );
    const pairs = checkout.edges
      .map((edge) => [edge.source, edge.target].sort().join())
      .filter(
        (pair, index, all) =>
          all.indexOf(pair) !== index && !pair.split(',').every((id) => id === pair.split(',')[0]),
      );
    const [a = '', b = ''] = (pairs[0] ?? '').split(',');
    const routes = between(a, b);

    expect(routes.length).toBeGreaterThan(1);
    expect(new Set(routes.map(({ path }) => path)).size).toBe(routes.length);
  });
});
