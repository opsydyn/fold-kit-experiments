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
});
