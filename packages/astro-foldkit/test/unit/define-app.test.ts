import { describe, expect, it } from 'bun:test';

import { defineApp } from '../../src/define-app';

describe('defineApp', () => {
  it('sets __foldkit: true', () => {
    const app = defineApp(() => Promise.resolve({} as any));
    expect(app.__foldkit).toBe(true);
  });

  it('stores the loader as load', () => {
    const loader = () => Promise.resolve({} as any);
    const app = defineApp(loader);
    expect(app.load).toBe(loader);
  });

  it('is callable as a function', () => {
    const app = defineApp(() => Promise.resolve({} as any));
    expect(() => app()).not.toThrow();
  });

  it('load returns the config the loader resolves to', async () => {
    const config = {
      Model: null,
      init: () => [null, []] as any,
      update: () => [null, []] as any,
      view: () => ({}) as any,
    };
    const app = defineApp(() => Promise.resolve(config));
    expect(await app.load()).toBe(config);
  });
});
