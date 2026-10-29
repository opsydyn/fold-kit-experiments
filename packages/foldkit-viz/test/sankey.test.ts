import { describe, expect, test } from 'bun:test';

import { sankey } from '../src/shape/sankey';

const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'x' }, { id: 'y' }, { id: 'z' }];
// The small nodes come first, so ordering by value would move them down.
const links = [
  { source: 'a', target: 'z', value: 1 },
  { source: 'b', target: 'y', value: 2 },
  { source: 'c', target: 'x', value: 8 },
];
const config = { width: 300, height: 200, nodePadding: 10 };
const topToBottom = (layout: ReturnType<typeof sankey>, ids: ReadonlyArray<string>) =>
  ids
    .map((id) => layout.nodes.find((node) => node.id === id))
    .sort((p, q) => (p?.y0 ?? 0) - (q?.y0 ?? 0))
    .map((node) => node?.id);

describe('sankey nodeSort', () => {
  test('null keeps each column in the input order, as d3-sankey does', () => {
    const layout = sankey(nodes, links, { ...config, nodeSort: null });
    expect(topToBottom(layout, ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(topToBottom(layout, ['x', 'y', 'z'])).toEqual(['x', 'y', 'z']);
  });

  test('left out, columns settle by the layout, the largest node first here', () => {
    const layout = sankey(nodes, links, config);
    expect(topToBottom(layout, ['a', 'b', 'c'])[0]).toBe('c');
  });

  test('null still fits each column in the height, with the padding between nodes', () => {
    const layout = sankey(nodes, links, { ...config, nodeSort: null });
    const column = layout.nodes.filter(({ column }) => column === 0);
    expect(Math.min(...column.map(({ y0 }) => y0))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...column.map(({ y1 }) => y1))).toBeLessThanOrEqual(200);
  });
});
