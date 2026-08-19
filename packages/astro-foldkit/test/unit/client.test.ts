import { describe, expect, it, mock } from 'bun:test';

import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import type { AppConfig, AppConfigShape } from '../../src/types';

mock.module('foldkit', () => ({ Runtime: {} }));

const BUILD_ID = 'client-test-build';
process.env.FOLDKIT_BUILD_ID = BUILD_ID;

const { createClientRenderer } = await import('../../src/client');

type Model = { readonly count: number };
type Message = { readonly _tag: 'Increment' };

const config = {
  Model: {},
  init: (props: Record<string, unknown>) => [{ count: Number(props.initialCount) }, []] as const,
  update: (model: Model, _message: Message) => [model, []] as const,
  view: (_model: Model, _h: HtmlBuilder<Message>) => ({}) as Document,
} satisfies AppConfig<Record<string, unknown>, Model, Message> &
  AppConfigShape<Record<string, unknown>>;

const makeEventTarget = () => {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: (type: string, listener: EventListener) => {
      const current = listeners.get(type) ?? new Set<EventListener>();
      current.add(listener);
      listeners.set(type, current);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatch: (type: string, eventProperties: Record<string, unknown> = {}) => {
      const event = Object.assign(new Event(type), eventProperties);
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
};

type TestChild = {
  readonly attributes: Readonly<Record<string, string>>;
};

const makeFoldkitRoot = (
  attributes: Readonly<Record<string, string>> = { 'data-foldkit-build': BUILD_ID },
): TestChild => ({
  attributes: {
    'data-foldkit-app': 'app',
    ...attributes,
  },
});

const matchesSelector = (child: TestChild, selector: string): boolean =>
  selector === '[data-foldkit-app]' && child.attributes['data-foldkit-app'] !== undefined;

const makeElement = (uid = 'island-test', children: readonly TestChild[] = []) => ({
  id: '',
  getAttribute: (name: string) => (name === 'uid' ? uid : null),
  querySelectorAll: (selector: string) =>
    children.filter((child) => matchesSelector(child, selector)),
  ...makeEventTarget(),
});

const makeDocument = (uids: readonly string[] = []) => ({
  title: 'Test page',
  querySelector: (selector: string) => {
    const uid = selector.match(/\[uid="([^"]+)"\]/)?.[1];
    return uid && uids.includes(uid)
      ? { getAttribute: (name: string) => (name === 'uid' ? uid : null) }
      : null;
  },
  ...makeEventTarget(),
});

const renderWith = async (
  runtime: Parameters<typeof createClientRenderer>[0],
  options: {
    readonly navigation?: AppConfigShape<Record<string, unknown>>['navigation'];
    readonly element?: ReturnType<typeof makeElement>;
    readonly document?: ReturnType<typeof makeDocument>;
    readonly window?: { readonly location: { href: string } };
  } = {},
) => {
  const element = options.element ?? makeElement();
  const appConfig = {
    ...config,
    ...(options.navigation ? { navigation: options.navigation } : {}),
  };
  const app = Object.assign((_props?: Record<string, unknown>) => {}, {
    __foldkit: true as const,
    load: async () => appConfig,
  });

  await createClientRenderer(runtime, {
    document: options.document ?? makeDocument(),
    window: options.window ?? { location: { href: 'https://example.test/' } },
  })(element as unknown as HTMLElement)(app, {}, {}, { client: 'load' });
  return element;
};

describe('astro-foldkit client renderer', () => {
  it('hydrates page owners with the loaded config and build identity without embedding', async () => {
    const root = makeFoldkitRoot();
    const element = makeElement('page-island', [root]);
    const application = { kind: 'application' };
    const pageConfig = {
      ...config,
      Flags: Schema.Struct({ initialCount: Schema.Number }),
      customField: 'preserved',
    };
    const page = Object.assign((_props?: Record<string, unknown>) => {}, {
      __foldkitPage: true as const,
      load: async () => pageConfig,
      flags: () => ({ initialCount: 9 }),
    });
    let makeApplicationInput: unknown;
    let hydrateArgs: unknown;
    let embedCalls = 0;
    let disposeCalls = 0;

    const runtime = {
      makeApplication: (input: unknown) => {
        makeApplicationInput = input;
        return application;
      },
      embed: (_program: unknown) => {
        embedCalls += 1;
        return { dispose: () => (disposeCalls += 1) };
      },
      hydrate: (program: unknown, options: unknown) => {
        hydrateArgs = [program, options];
      },
    };

    await createClientRenderer(runtime)(element as unknown as HTMLElement)(
      page,
      { initialCount: 9 },
      {},
      { client: 'load' },
    );
    element.dispatch('astro:unmount');

    expect(makeApplicationInput).toMatchObject({
      Flags: pageConfig.Flags,
      Model: pageConfig.Model,
      customField: 'preserved',
      init: pageConfig.init,
      update: pageConfig.update,
      view: pageConfig.view,
      container: root,
    });
    expect(hydrateArgs).toEqual([application, { buildId: BUILD_ID }]);
    expect(embedCalls).toBe(0);
    expect(disposeCalls).toBe(0);
  });

  it('lets Runtime.hydrate reject missing or mismatching page build stamps', async () => {
    const pageConfig = {
      ...config,
      Flags: Schema.Struct({ initialCount: Schema.Number }),
    };
    const page = Object.assign((_props?: Record<string, unknown>) => {}, {
      __foldkitPage: true as const,
      load: async () => pageConfig,
      flags: () => ({ initialCount: 9 }),
    });

    for (const root of [
      makeFoldkitRoot({}),
      makeFoldkitRoot({ 'data-foldkit-build': 'other-build' }),
    ]) {
      let hydrateArgs: unknown;
      let embedCalls = 0;
      const runtime = {
        makeApplication: (input: unknown) => input,
        embed: (_program: unknown) => {
          embedCalls += 1;
          return { dispose: () => {} };
        },
        hydrate: (program: unknown, options: unknown) => {
          hydrateArgs = [program, options];
        },
      };

      await createClientRenderer(runtime)(
        makeElement('page-island', [root]) as unknown as HTMLElement,
      )(page, { initialCount: 9 }, {}, { client: 'load' });

      expect(hydrateArgs).toEqual([{ ...pageConfig, container: root }, { buildId: BUILD_ID }]);
      expect(embedCalls).toBe(0);
    }
  });

  it('refuses page hydration unless exactly one stamped FoldKit root is inside the island', async () => {
    const pageConfig = {
      ...config,
      Flags: Schema.Struct({ initialCount: Schema.Number }),
    };
    const page = Object.assign((_props?: Record<string, unknown>) => {}, {
      __foldkitPage: true as const,
      load: async () => pageConfig,
      flags: () => ({ initialCount: 9 }),
    });

    for (const children of [
      [],
      [makeFoldkitRoot(), makeFoldkitRoot({ 'data-foldkit-build': 'other-build' })],
    ]) {
      let makeApplicationCalls = 0;
      let embedCalls = 0;
      let hydrateCalls = 0;
      const runtime = {
        makeApplication: (input: unknown) => {
          makeApplicationCalls += 1;
          return input;
        },
        embed: (_program: unknown) => {
          embedCalls += 1;
          return { dispose: () => {} };
        },
        hydrate: () => {
          hydrateCalls += 1;
        },
      };

      await expect(
        createClientRenderer(runtime)(
          makeElement('page-island', children) as unknown as HTMLElement,
        )(page, { initialCount: 9 }, {}, { client: 'load' }),
      ).rejects.toThrow('exactly one stamped FoldKit root');
      expect(makeApplicationCalls).toBe(0);
      expect(embedCalls).toBe(0);
      expect(hydrateCalls).toBe(0);
    }
  });

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

  it('sends coldLoad through the configured inbound port', async () => {
    const sent: unknown[] = [];
    const runtime = {
      makeApplication: (input: unknown) => input,
      embed: (_program: unknown) => ({
        ports: { navigation: { send: (value: unknown) => sent.push(value) } },
        dispose: () => {},
      }),
    };

    await renderWith(runtime, {
      navigation: { port: 'navigation', map: (event) => event },
    });

    expect(sent).toEqual([{ phase: 'coldLoad', path: '/', previousPath: null }]);
  });

  it('stops forwarding and disposes once after unmount', async () => {
    const events: unknown[] = [];
    const element = makeElement('lifecycle-order-island');
    const document = makeDocument();
    const runtime = {
      makeApplication: (input: unknown) => input,
      embed: (_program: unknown) => ({
        ports: {
          navigation: {
            send: (value: unknown) => events.push(['navigation', value]),
          },
        },
        dispose: () => events.push(['dispose']),
      }),
    };

    await renderWith(runtime, {
      navigation: { port: 'navigation', map: (event) => event },
      element,
      document,
    });
    element.dispatch('astro:unmount');
    document.dispatch('astro:page-load');

    expect(events).toEqual([
      ['navigation', { phase: 'coldLoad', path: '/', previousPath: null }],
      ['navigation', { phase: 'exited', path: '/', previousPath: '/' }],
      ['dispose'],
    ]);
  });

  it('maps Astro swap and page-load events with the previous path', async () => {
    const sent: unknown[] = [];
    const document = makeDocument();
    const window = { location: { href: 'https://example.test/start' } };
    const runtime = {
      makeApplication: (input: unknown) => input,
      embed: (_program: unknown) => ({
        ports: { navigation: { send: (value: unknown) => sent.push(value) } },
        dispose: () => {},
      }),
    };

    await renderWith(runtime, {
      navigation: { port: 'navigation', map: (event) => event },
      document,
      element: makeElement('mapping-island'),
      window,
    });
    document.dispatch('astro:before-swap', {
      detail: {
        newDocument: makeDocument(['mapping-island']),
        to: { href: 'https://example.test/next' },
      },
    });
    document.dispatch('astro:page-load');

    expect(sent).toEqual([
      { phase: 'coldLoad', path: '/start', previousPath: null },
      { phase: 'stayed', path: '/next', previousPath: '/start' },
    ]);
  });

  it('uses the before-swap destination when window.location is still the old URL', async () => {
    const sent: unknown[] = [];
    const document = makeDocument();
    const window = { location: { href: 'https://example.test/old' } };
    const runtime = {
      makeApplication: (input: unknown) => input,
      embed: (_program: unknown) => ({
        ports: { navigation: { send: (value: unknown) => sent.push(value) } },
        dispose: () => {},
      }),
    };

    await renderWith(runtime, {
      navigation: { port: 'navigation', map: (event) => event },
      document,
      element: makeElement('destination-island'),
      window,
    });
    document.dispatch('astro:before-swap', {
      detail: {
        newDocument: makeDocument(['destination-island']),
        to: { href: 'https://example.test/new' },
      },
    });

    expect(sent.at(-1)).toEqual({ phase: 'stayed', path: '/new', previousPath: '/old' });
  });

  it('forwards stayed only when the island is retained by the next document', async () => {
    const sent: unknown[] = [];
    const document = makeDocument();
    const runtime = {
      makeApplication: (input: unknown) => input,
      embed: (_program: unknown) => ({
        ports: { navigation: { send: (value: unknown) => sent.push(value) } },
        dispose: () => {},
      }),
    };

    await renderWith(runtime, {
      navigation: { port: 'navigation', map: (event) => event },
      document,
      element: makeElement('removed-island'),
    });
    document.dispatch('astro:before-swap', { newDocument: makeDocument() });
    document.dispatch('astro:page-load');

    expect(sent).toEqual([{ phase: 'coldLoad', path: '/', previousPath: null }]);
  });

  it('sends exited for a removed island and entered for a subsequent remount', async () => {
    const firstSent: unknown[] = [];
    const firstElement = makeElement('remounted-island');
    const firstDocument = makeDocument();
    const runtime = {
      makeApplication: (input: unknown) => input,
      embed: (_program: unknown) => ({
        ports: { navigation: { send: (value: unknown) => firstSent.push(value) } },
        dispose: () => {},
      }),
    };

    await renderWith(runtime, {
      navigation: { port: 'navigation', map: (event) => event },
      document: firstDocument,
      element: firstElement,
    });
    firstDocument.dispatch('astro:before-swap', { newDocument: makeDocument() });
    firstElement.dispatch('astro:unmount');

    const remountSent: unknown[] = [];
    await renderWith(
      {
        makeApplication: (input: unknown) => input,
        embed: (_program: unknown) => ({
          ports: { navigation: { send: (value: unknown) => remountSent.push(value) } },
          dispose: () => {},
        }),
      },
      {
        navigation: { port: 'navigation', map: (event) => event },
        element: makeElement('remounted-island'),
      },
    );

    expect(firstSent).toEqual([
      { phase: 'coldLoad', path: '/', previousPath: null },
      { phase: 'exited', path: '/', previousPath: '/' },
    ]);
    expect(remountSent).toEqual([{ phase: 'entered', path: '/', previousPath: null }]);
  });

  it('warns once and still disposes when the navigation port is missing', async () => {
    const sent: unknown[] = [];
    let disposeCalls = 0;
    const originalWarn = console.warn;
    const warn = mock(() => {});
    console.warn = warn;
    const element = await renderWith(
      {
        makeApplication: (input: unknown) => input,
        embed: (_program: unknown) => ({
          ports: { other: { send: (value: unknown) => sent.push(value) } },
          dispose: () => {
            disposeCalls += 1;
          },
        }),
      },
      { navigation: { port: 'navigation', map: (event) => event } },
    );
    element.dispatch('astro:unmount');
    console.warn = originalWarn;

    expect(warn).toHaveBeenCalledTimes(1);
    expect(sent).toEqual([]);
    expect(disposeCalls).toBe(1);
  });
});
