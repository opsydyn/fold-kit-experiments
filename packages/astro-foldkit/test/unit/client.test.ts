import { describe, expect, it, mock } from 'bun:test';

import type { Document } from 'foldkit/html';

import type { AppConfig, AppConfigShape } from '../../src/types';

mock.module('foldkit', () => ({ Runtime: {} }));

const { createClientRenderer } = await import('../../src/client');

type Model = { readonly count: number };
type Message = { readonly _tag: 'Increment' };

const config = {
  Model: {},
  init: (props: Record<string, unknown>) => [{ count: Number(props.initialCount) }, []] as const,
  update: (model: Model, _message: Message) => [model, []] as const,
  view: (_model: Model) => ({}) as Document,
} satisfies AppConfig<Record<string, unknown>, Model, Message> &
  AppConfigShape<Record<string, unknown>>;

const makeElement = () => {
  const listeners = new Map<string, EventListener>();
  return {
    id: '',
    getAttribute: () => null,
    addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
    dispatch: (type: string) => listeners.get(type)?.(new Event(type)),
  };
};

describe('astro-foldkit client renderer', () => {
  it('loads once, forwards props, embeds once, and disposes once', async () => {
    const element = makeElement();
    const props = { initialCount: 3 };
    let loadCalls = 0;
    let initProps: unknown;
    let makeApplicationCalls = 0;
    let embedCalls = 0;
    let disposeCalls = 0;

    const runtime = {
      makeApplication: (input: unknown) => {
        makeApplicationCalls += 1;
        initProps = (input as { init: () => readonly [Model, ReadonlyArray<unknown>] }).init();
        return input;
      },
      embed: (_program: unknown) => {
        embedCalls += 1;
        return { dispose: () => (disposeCalls += 1) };
      },
    };

    const app = Object.assign((_props?: typeof props) => {}, {
      __foldkit: true as const,
      load: async () => {
        loadCalls += 1;
        return config;
      },
    });

    await createClientRenderer(runtime)(element as unknown as HTMLElement)(
      app,
      props,
      {},
      { client: 'load' },
    );
    element.dispatch('astro:unmount');
    element.dispatch('astro:unmount');

    expect(loadCalls).toBe(1);
    expect(makeApplicationCalls).toBe(1);
    expect(initProps).toEqual([{ count: 3 }, []]);
    expect(embedCalls).toBe(1);
    expect(disposeCalls).toBe(1);
  });
});
