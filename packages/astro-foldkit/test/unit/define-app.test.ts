import { describe, expect, it } from 'bun:test';

import type { Document } from 'foldkit/html';

import * as defineAppModule from '../../src/define-app';
import { defineApp } from '../../src/define-app';
import type { AppConfig } from '../../src/types';

describe('defineApp', () => {
  it('exports lazyApp as the preferred lazy-loader API', () => {
    expect(defineAppModule).toHaveProperty('lazyApp', defineApp);
  });

  it('preserves typed props, model, and message contracts', async () => {
    type Props = { readonly initialCount: number };
    type Model = { readonly count: number };
    type Message = { readonly _tag: 'Increment' };

    const config = {
      Model: {} as AppConfig<Props, Model, Message>['Model'],
      init: (props: Props) => [{ count: props.initialCount }, []] as const,
      update: (model: Model, _message: Message) => [model, []] as const,
      view: (_model: Model) => ({}) as Document,
    } satisfies AppConfig<Props, Model, Message>;

    const app = defineApp<Props>(() => Promise.resolve(config));
    const loaded = await app.load();

    expect(loaded).toBe(config);
  });

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
    const config = {} as AppConfig;
    const app = defineApp(() => Promise.resolve(config));
    expect(await app.load()).toBe(config);
  });
});
