import { describe, expect, it } from 'bun:test';

import type { Document, HtmlBuilder } from 'foldkit/html';

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
      // SAFETY: The test fixture establishes this value before the assertion.
      Model: {} as AppConfig<Props, Model, Message>['Model'],
      init: (props: Props) => ({ model: { count: props.initialCount } }),
      update: (model: Model, _message: Message) => ({ model }),
      // SAFETY: The test fixture establishes this value before the assertion.
      view: (_model: Model, _h: HtmlBuilder<Message>) => ({}) as Document,
    } satisfies AppConfig<Props, Model, Message>;

    const app = defineApp<Props>(() => Promise.resolve(config));
    const loaded = await app.load();

    expect(loaded).toBe(config);
  });

  it('sets __foldkit: true', () => {
    // SAFETY: The test fixture establishes this value before the assertion.
    const app = defineApp(() => Promise.resolve({} as any));
    expect(app.__foldkit).toBe(true);
  });

  it('stores the loader as load', () => {
    // SAFETY: The test fixture establishes this value before the assertion.
    const loader = () => Promise.resolve({} as any);
    const app = defineApp(loader);
    expect(app.load).toBe(loader);
  });

  it('is callable as a function', () => {
    // SAFETY: The test fixture establishes this value before the assertion.
    const app = defineApp(() => Promise.resolve({} as any));
    expect(() => app()).not.toThrow();
  });

  it('load returns the config the loader resolves to', async () => {
    // SAFETY: The test fixture establishes this value before the assertion.
    const config = {} as AppConfig;
    const app = defineApp(() => Promise.resolve(config));
    expect(await app.load()).toBe(config);
  });
});
