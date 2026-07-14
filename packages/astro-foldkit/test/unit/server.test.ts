import { describe, expect, it } from 'bun:test';

import { check, renderToStaticMarkup } from '../../src/server';

const component = Object.assign(() => {}, { __foldkit: true as const });

describe('astro-foldkit server renderer', () => {
  it('renders a deterministic FoldKit mount shell', async () => {
    const first = await renderToStaticMarkup(component, { id: 'ignored' }, {});
    const second = await renderToStaticMarkup(component, { id: 'different' }, {});

    expect(first).toEqual({ html: '<div data-foldkit-island="true"></div>' });
    expect(second).toEqual(first);
  });

  it('recognizes only FoldKit components', async () => {
    expect(await check(component)).toBe(true);
    expect(await check({ __foldkit: false })).toBe(false);
  });
});
