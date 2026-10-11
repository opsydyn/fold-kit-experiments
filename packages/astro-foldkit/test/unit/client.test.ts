import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { Data, Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import type { ClientRuntime } from '../../src/client';
import type { NavigationEvent } from '../../src/navigation';
import type { AppConfig, AppConfigContract } from '../../src/types';

mock.module('foldkit', () => ({ Runtime: {} }));

const BUILD_ID = 'client-test-build';

class TestRuntimeError extends Data.TaggedError('TestRuntimeError')<{
  readonly message: string;
}> {}

const { createClientRenderer } = await import('../../src/client');

type Model = { readonly count: number };
type Message = { readonly _tag: 'Increment' };
interface TestProps {
  readonly initialCount?: number;
  readonly noMeta?: boolean | '';
}
type RuntimeConfig = Parameters<ClientRuntime['makeApplication']>[0];
type RuntimeProgram = ReturnType<ClientRuntime['makeApplication']>;
type RuntimeHydrationOptions = NonNullable<Parameters<NonNullable<ClientRuntime['hydrate']>>[1]>;

const config = {
  Model: {},
  init: (props: TestProps) => ({ model: { count: Number(props.initialCount) } }),
  update: (model: Model, _message: Message) => ({ model }),
  view: (_model: Model, _h: HtmlBuilder<Message>): Document => ({ title: 'App', body: null }),
} satisfies AppConfig<TestProps, Model, Message> & AppConfigContract<TestProps>;

const makeEventTarget = () => {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener: (
      type: string,
      listener: EventListener,
      options?: { readonly once?: boolean },
    ) => {
      const current = listeners.get(type) ?? new Set<EventListener>();
      const wrapped: EventListener = options?.once
        ? (event) => {
            current.delete(wrapped);
            listener(event);
          }
        : listener;
      current.add(wrapped);
      listeners.set(type, current);
    },
    removeEventListener: (type: string, listener: EventListener) => {
      listeners.get(type)?.delete(listener);
    },
    dispatch: (type: string, eventProperties: EventProperties = {}) => {
      const event = Object.assign(new Event(type), eventProperties);
      for (const listener of Array.from(listeners.get(type) ?? [])) listener(event);
    },
    listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
  };
};

// Model the runtime's replacement semantics without adding a DOM dependency.
class TestNode {
  readonly children: TestNode[] = [];
  parentNode: TestNode | null = null;
  readonly events = makeEventTarget();
  readonly addEventListener = this.events.addEventListener;
  readonly removeEventListener = this.events.removeEventListener;
  readonly dispatch = this.events.dispatch;
  readonly listenerCount = this.events.listenerCount;
  readonly ownerDocument = {
    createElement: (tagName: string) => new TestNode(tagName),
  };

  constructor(
    readonly tagName: string,
    readonly attributes: Record<string, string> = {},
  ) {}

  get id() {
    return this.attributes.id ?? '';
  }

  set id(value: string) {
    this.attributes.id = value;
  }

  get isConnected(): boolean {
    return this.tagName === '#document' || (this.parentNode?.isConnected ?? false);
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  appendChild(child: TestNode) {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
      this.parentNode = null;
    }
  }

  replaceWith(next: TestNode) {
    const parent = this.parentNode;
    if (!parent) throw new TestRuntimeError({ message: 'Runtime mount must have a parent' });
    const index = parent.children.indexOf(this);
    this.remove();
    next.remove();
    parent.children.splice(index, 0, next);
    next.parentNode = parent;
  }

  closest(selector: string): TestNode | null {
    return this.tagName === selector ? this : (this.parentNode?.closest(selector) ?? null);
  }

  querySelectorAll(selector: string): TestNode[] {
    return this.children.flatMap((child) => [
      ...(selector === '[data-foldkit-app]' && child.getAttribute('data-foldkit-app') !== null
        ? [child]
        : []),
      ...(selector === '[data-foldkit-island="true"]' &&
      child.getAttribute('data-foldkit-island') === 'true'
        ? [child]
        : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

interface EventProperties {
  readonly detail?: {
    readonly newDocument?: ReturnType<typeof makeDocument>;
    readonly to?: { readonly href?: string };
  };
  readonly newDocument?: ReturnType<typeof makeDocument>;
}

const makeFoldkitRoot = (
  attributes: Readonly<Record<string, string>> = { 'data-foldkit-build': BUILD_ID },
): TestNode =>
  new TestNode('section', {
    'data-foldkit-app': 'app',
    ...attributes,
  });

const makeElement = (
  uid = 'island-test',
  children: readonly TestNode[] = [new TestNode('div', { 'data-foldkit-island': 'true' })],
) => {
  const element = new TestNode('astro-island', { uid });
  for (const child of children) element.appendChild(child);
  new TestNode('#document').appendChild(element);
  return element;
};

type TestElement = ReturnType<typeof makeElement> & HTMLElement;

function toTestElement(value: ReturnType<typeof makeElement>): TestElement {
  // SAFETY: The test fixture supplies the DOM element expected by the renderer boundary.
  return value as TestElement;
}

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
    readonly navigation?: AppConfigContract<TestProps>['navigation'];
    readonly element?: ReturnType<typeof makeElement>;
    readonly document?: ReturnType<typeof makeDocument>;
    readonly window?: { readonly location: { href: string } };
    readonly props?: TestProps;
    readonly renderer?: ReturnType<typeof createClientRenderer>;
  } = {},
) => {
  const element = options.element ?? makeElement();
  const appConfig = {
    ...config,
  };
  if (options.navigation !== undefined)
    Object.assign(appConfig, { navigation: options.navigation });
  const app = Object.assign((_props?: TestProps) => {}, {
    __foldkit: true as const,
    load: async () => appConfig,
  });

  const renderer =
    options.renderer ??
    createClientRenderer(runtime, {
      document: options.document ?? makeDocument(),
      window: options.window ?? { location: { href: 'https://example.test/' } },
    });
  await renderer(toTestElement(element))(app, options.props ?? {}, {}, { client: 'load' });
  return element;
};

const replacingRuntime = () => {
  const sent: NavigationEvent[] = [];
  const renderedRoot = new TestNode('section', { 'aria-label': 'Rendered application' });
  let mount: TestNode | undefined;
  let input: RuntimeConfig | undefined;
  let initCalls = 0;
  let embedCalls = 0;
  let disposeCalls = 0;
  const runtime: ClientRuntime = {
    makeApplication: (config) => {
      input = config;
      return config;
    },
    embed: (program) => {
      // SAFETY: The renderer creates the runtime config consumed by this test double.
      const config = program as {
        readonly container: TestNode;
        readonly init: () => { readonly model: Model };
      };
      mount = config.container;
      if (!mount.id) throw new TestRuntimeError({ message: 'FoldKit runtime requires a mount ID' });
      config.init();
      initCalls += 1;
      embedCalls += 1;
      mount.replaceWith(renderedRoot);
      return {
        ports: { navigation: { send: (event) => sent.push(event) } },
        dispose: () => {
          disposeCalls += 1;
          renderedRoot.replaceWith(config.container);
        },
      };
    },
  };
  return {
    runtime,
    sent,
    renderedRoot,
    get mount() {
      return mount;
    },
    get input() {
      return input;
    },
    get counts() {
      return { initCalls, embedCalls, disposeCalls };
    },
  };
};

describe('astro-foldkit client renderer', () => {
  let previousBuildId: string | undefined;
  beforeEach(() => {
    previousBuildId = process.env.FOLDKIT_BUILD_ID;
    process.env.FOLDKIT_BUILD_ID = BUILD_ID;
  });
  afterEach(() => {
    if (previousBuildId === undefined) delete process.env.FOLDKIT_BUILD_ID;
    else process.env.FOLDKIT_BUILD_ID = previousBuildId;
  });

  it.each([true, false])(
    'gives the runtime a stable distinct mount identity (SSR: %s)',
    async (ssr) => {
      const mountIds: string[] = [];
      for (const uid of ['identity-a', 'identity-b', 'identity-a']) {
        const element = ssr ? makeElement(uid) : makeElement(uid, []);
        const replacement = replacingRuntime();
        await renderWith(replacement.runtime, { element });
        expect(replacement.mount?.id).toBeTruthy();
        expect(replacement.mount?.id).not.toBe(element.id);
        mountIds.push(replacement.mount?.id ?? '');
      }
      expect(mountIds[0]).not.toBe(mountIds[1]);
      expect(mountIds[0]).toBe(mountIds[2]);
    },
  );

  it('preserves a pre-existing inner runtime mount ID', async () => {
    const shell = new TestNode('div', { 'data-foldkit-island': 'true', id: 'custom-mount' });
    const replacement = replacingRuntime();
    await renderWith(replacement.runtime, { element: makeElement('custom-host', [shell]) });
    expect(replacement.mount?.id).toBe('custom-mount');
  });

  it('replaces only the SSR mount and preserves the connected Astro lifecycle host', async () => {
    const shell = new TestNode('div', { 'data-foldkit-island': 'true' });
    const element = makeElement('replacement-host', [shell]);
    element.setAttribute('props', '{"initialCount":3}');
    element.setAttribute('client', 'load');
    element.setAttribute('data-astro-transition-persist', 'analysis');
    const replacement = replacingRuntime();

    await renderWith(replacement.runtime, { element });

    expect(element.isConnected).toBe(true);
    expect(element.attributes).toEqual({
      id: 'replacement-host',
      uid: 'replacement-host',
      props: '{"initialCount":3}',
      client: 'load',
      'data-astro-transition-persist': 'analysis',
    });
    expect(replacement.mount).toBe(shell);
    expect(shell.isConnected).toBe(false);
    expect(element.children).toEqual([replacement.renderedRoot]);
    expect(replacement.renderedRoot.isConnected).toBe(true);
  });

  it('creates an inner replaceable mount for an empty client-only host', async () => {
    const element = makeElement('client-only-host', []);
    const replacement = replacingRuntime();

    await renderWith(replacement.runtime, { element });

    expect(element.isConnected).toBe(true);
    expect(replacement.mount).not.toBe(element);
    expect(replacement.mount?.getAttribute('data-foldkit-island')).toBe('true');
    expect(element.children).toEqual([replacement.renderedRoot]);
  });

  it('rejects multiple owned shells before initialization or embedding', async () => {
    const first = new TestNode('div', { 'data-foldkit-island': 'true' });
    const second = new TestNode('div', { 'data-foldkit-island': 'true' });
    const wrapper = new TestNode('div');
    wrapper.appendChild(second);
    const element = makeElement('ambiguous-host', [first, wrapper]);
    const replacement = replacingRuntime();

    await expect(renderWith(replacement.runtime, { element })).rejects.toThrow(
      'at most one owned FoldKit island mount',
    );
    expect(replacement.input).toBeUndefined();
    expect(replacement.counts).toEqual({ initCalls: 0, embedCalls: 0, disposeCalls: 0 });
    expect(element.children).toEqual([first, wrapper]);
  });

  it.each([true, false])('never uses a nested island shell (own shell: %s)', async (hasOwn) => {
    const nestedShell = new TestNode('div', { 'data-foldkit-island': 'true' });
    const nested = makeElement('nested-host', [nestedShell]);
    const ownShell = new TestNode('div', { 'data-foldkit-island': 'true' });
    const element = makeElement('outer-host', hasOwn ? [nested, ownShell] : [nested]);
    const replacement = replacingRuntime();

    await renderWith(replacement.runtime, { element });

    expect(element.isConnected).toBe(true);
    expect(nested.isConnected).toBe(true);
    expect(nested.children).toEqual([nestedShell]);
    expect(replacement.mount).not.toBe(nestedShell);
    if (hasOwn) expect(replacement.mount).toBe(ownShell);
    else expect(replacement.mount?.getAttribute('data-foldkit-island')).toBe('true');
    expect(replacement.renderedRoot.parentNode).toBe(element);
  });

  it.each([true, ''] as const)(
    'keeps noMeta title pinning on the inner mount (%s)',
    async (noMeta) => {
      const replacement = replacingRuntime();
      const element = await renderWith(replacement.runtime, { props: { noMeta } });
      // SAFETY: The renderer config supplies the wrapped view at this boundary.
      const input = replacement.input as { readonly view: typeof config.view };

      // SAFETY: This fixture view never uses its builder; only document metadata is exercised.
      expect(input.view({ count: 0 }, {} as HtmlBuilder<Message>)).toEqual({
        title: 'Test page',
        body: null,
      });
      expect(element.isConnected).toBe(true);
    },
  );

  it('retains the runtime across repeated swaps and disposes once on genuine route removal', async () => {
    const uid = 'replacement-navigation-host';
    const element = makeElement(uid);
    const document = makeDocument();
    const window = { location: { href: 'https://example.test/start' } };
    const replacement = replacingRuntime();
    const renderer = createClientRenderer(replacement.runtime, { document, window });

    await renderWith(replacement.runtime, {
      renderer,
      element,
      document,
      window,
      navigation: { port: 'navigation', map: (event) => event },
    });
    document.dispatch('astro:page-load');
    for (const path of ['/next', '/start', '/next']) {
      document.dispatch('astro:before-swap', {
        newDocument: makeDocument([uid]),
        detail: { to: { href: `https://example.test${path}` } },
      });
      // Astro emits unmount after swap only if its lifecycle host is disconnected.
      if (!element.isConnected) element.dispatch('astro:unmount');
      window.location.href = `https://example.test${path}`;
      // Reconnecting a persisted Astro custom element invokes its hydrator again.
      await renderWith(replacement.runtime, {
        renderer,
        element,
        navigation: { port: 'navigation', map: (event) => event },
      });
      document.dispatch('astro:page-load');
      expect(element.children).toEqual([replacement.renderedRoot]);
      expect(replacement.renderedRoot.isConnected).toBe(true);
      expect(replacement.counts).toEqual({ initCalls: 1, embedCalls: 1, disposeCalls: 0 });
    }
    expect(replacement.sent).toEqual([
      { phase: 'coldLoad', path: '/start', previousPath: null },
      { phase: 'stayed', path: '/next', previousPath: '/start' },
      { phase: 'stayed', path: '/start', previousPath: '/next' },
      { phase: 'stayed', path: '/next', previousPath: '/start' },
    ]);

    document.dispatch('astro:before-swap', { newDocument: makeDocument() });
    element.remove();
    element.dispatch('astro:unmount');
    element.dispatch('astro:unmount');
    expect(replacement.sent.at(-1)).toEqual({
      phase: 'exited',
      path: '/next',
      previousPath: '/next',
    });
    expect(replacement.counts).toEqual({ initCalls: 1, embedCalls: 1, disposeCalls: 1 });
    expect(document.listenerCount('astro:page-load')).toBe(0);
    expect(document.listenerCount('astro:before-swap')).toBe(0);
    expect(element.listenerCount('astro:unmount')).toBe(0);
    document.dispatch('astro:page-load');
    document.dispatch('astro:before-swap', { newDocument: makeDocument([uid]) });
    expect(replacement.sent).toHaveLength(5);

    const remount = replacingRuntime();
    await renderWith(remount.runtime, {
      element: makeElement(uid),
      document,
      window,
      navigation: { port: 'navigation', map: (event) => event },
    });
    expect(remount.sent).toEqual([{ phase: 'entered', path: '/next', previousPath: null }]);
  });

  it('shares an in-flight island load across concurrent hydration callbacks', async () => {
    const replacement = replacingRuntime();
    const renderer = createClientRenderer(replacement.runtime, { document: makeDocument() });
    const element = makeElement('concurrent-host');
    const loaded = Promise.withResolvers<typeof config>();
    let loadCalls = 0;
    const app = Object.assign((_props?: TestProps) => {}, {
      __foldkit: true as const,
      load: () => {
        loadCalls += 1;
        return loaded.promise;
      },
    });
    const first = renderer(toTestElement(element))(app, {}, {}, { client: 'load' });
    const second = renderer(toTestElement(element))(app, {}, {}, { client: 'load' });
    loaded.resolve(config);
    await Promise.all([first, second]);
    expect(loadCalls).toBe(1);
    expect(replacement.counts).toEqual({ initCalls: 1, embedCalls: 1, disposeCalls: 0 });
    expect(element.children).toEqual([replacement.renderedRoot]);
  });

  it('allows hydration to retry after a failed load and after a genuine unmount', async () => {
    const replacement = replacingRuntime();
    const document = makeDocument();
    const renderer = createClientRenderer(replacement.runtime, { document });
    const element = makeElement('retry-host');
    let loadCalls = 0;
    const app = Object.assign((_props?: TestProps) => {}, {
      __foldkit: true as const,
      load: async () => {
        loadCalls += 1;
        if (loadCalls === 1) throw new TestRuntimeError({ message: 'Transient load failure' });
        return config;
      },
    });
    await expect(renderer(toTestElement(element))(app, {}, {}, { client: 'load' })).rejects.toThrow(
      'Transient load failure',
    );
    await renderer(toTestElement(element))(app, {}, {}, { client: 'load' });
    element.remove();
    element.dispatch('astro:unmount');
    new TestNode('#document').appendChild(element);
    await renderer(toTestElement(element))(app, {}, {}, { client: 'load' });
    expect(loadCalls).toBe(3);
    expect(replacement.counts).toEqual({ initCalls: 2, embedCalls: 2, disposeCalls: 1 });
    expect(element.children).toEqual([replacement.renderedRoot]);
  });

  it('does not initialize a host removed while its component is still loading', async () => {
    const replacement = replacingRuntime();
    const renderer = createClientRenderer(replacement.runtime, { document: makeDocument() });
    const element = makeElement('pending-removal-host');
    const loaded = Promise.withResolvers<typeof config>();
    const app = Object.assign((_props?: TestProps) => {}, {
      __foldkit: true as const,
      load: () => loaded.promise,
    });
    const pending = renderer(toTestElement(element))(app, {}, {}, { client: 'load' });
    element.remove();
    element.dispatch('astro:unmount');
    loaded.resolve(config);
    await pending;
    expect(replacement.counts).toEqual({ initCalls: 0, embedCalls: 0, disposeCalls: 0 });
    expect(element.listenerCount('astro:unmount')).toBe(0);
    new TestNode('#document').appendChild(element);
    await renderer(toTestElement(element))(app, {}, {}, { client: 'load' });
    expect(replacement.counts).toEqual({ initCalls: 1, embedCalls: 1, disposeCalls: 0 });
  });

  it('cleans up an embedded runtime if initial navigation forwarding fails', async () => {
    const replacement = replacingRuntime();
    const document = makeDocument();
    const renderer = createClientRenderer(replacement.runtime, {
      document,
      window: { location: { href: 'https://example.test/' } },
    });
    const element = makeElement('failed-bridge-host');
    await expect(
      renderWith(replacement.runtime, {
        renderer,
        element,
        navigation: {
          port: 'navigation',
          map: () => {
            throw new TestRuntimeError({ message: 'Navigation mapping failed' });
          },
        },
      }),
    ).rejects.toThrow('Navigation mapping failed');
    expect(replacement.counts).toEqual({ initCalls: 1, embedCalls: 1, disposeCalls: 1 });
    expect(element.listenerCount('astro:unmount')).toBe(0);
    expect(document.listenerCount('astro:page-load')).toBe(0);
    expect(document.listenerCount('astro:before-swap')).toBe(0);
    await renderWith(replacement.runtime, { renderer, element });
    expect(replacement.counts).toEqual({ initCalls: 2, embedCalls: 2, disposeCalls: 1 });
  });

  it('hydrates page owners with the loaded config and build identity without embedding', async () => {
    const root = makeFoldkitRoot();
    const element = makeElement('page-island', [root]);
    const application = { kind: 'application' };
    const pageConfig = {
      ...config,
      Flags: Schema.Struct({ initialCount: Schema.Number }),
      customField: 'preserved',
    };
    const page = Object.assign((_props?: TestProps) => {}, {
      __foldkitPage: true as const,
      load: async () => pageConfig,
      flags: () => ({ initialCount: 9 }),
    });
    let makeApplicationInput: unknown;
    let hydrateArgs: [RuntimeProgram, RuntimeHydrationOptions] | undefined;
    let embedCalls = 0;
    let disposeCalls = 0;

    const runtime = {
      makeApplication: (input: RuntimeConfig) => {
        makeApplicationInput = input;
        return application;
      },
      embed: (_program: RuntimeProgram) => {
        embedCalls += 1;
        return { dispose: () => (disposeCalls += 1) };
      },
      hydrate: (program: RuntimeProgram, options: RuntimeHydrationOptions) => {
        hydrateArgs = [program, options];
      },
    };

    // SAFETY: The test fixture establishes this value before the assertion.
    await createClientRenderer(runtime)(element as TestElement)(
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
    const page = Object.assign((_props?: TestProps) => {}, {
      __foldkitPage: true as const,
      load: async () => pageConfig,
      flags: () => ({ initialCount: 9 }),
    });

    for (const root of [
      makeFoldkitRoot({}),
      makeFoldkitRoot({ 'data-foldkit-build': 'other-build' }),
    ]) {
      let hydrateArgs: [RuntimeProgram, RuntimeHydrationOptions] | undefined;
      let embedCalls = 0;
      const runtime = {
        makeApplication: (input: RuntimeConfig) => input,
        embed: (_program: RuntimeProgram) => {
          embedCalls += 1;
          return { dispose: () => {} };
        },
        hydrate: (program: RuntimeProgram, options: RuntimeHydrationOptions) => {
          hydrateArgs = [program, options];
        },
      };

      await createClientRenderer(runtime)(
        // SAFETY: The test fixture establishes this value before the assertion.
        makeElement('page-island', [root]) as TestElement,
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
    const page = Object.assign((_props?: TestProps) => {}, {
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
        makeApplication: (input: RuntimeConfig) => {
          makeApplicationCalls += 1;
          return input;
        },
        embed: (_program: RuntimeProgram) => {
          embedCalls += 1;
          return { dispose: () => {} };
        },
        hydrate: () => {
          hydrateCalls += 1;
        },
      };

      await expect(
        createClientRenderer(runtime)(
          // SAFETY: The test fixture establishes this value before the assertion.
          makeElement('page-island', children) as TestElement,
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
      makeApplication: (input: RuntimeConfig) => {
        makeApplicationCalls += 1;
        // SAFETY: The test fixture establishes this value before the assertion.
        initProps = (input as { init: () => { readonly model: Model } }).init();
        return input;
      },
      embed: (_program: RuntimeProgram) => {
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

    // SAFETY: The test fixture establishes this value before the assertion.
    await createClientRenderer(runtime)(element as TestElement)(app, props, {}, { client: 'load' });
    element.dispatch('astro:unmount');
    element.dispatch('astro:unmount');

    expect(loadCalls).toBe(1);
    expect(makeApplicationCalls).toBe(1);
    expect(initProps).toEqual({ model: { count: 3 } });
    expect(embedCalls).toBe(1);
    expect(disposeCalls).toBe(1);
  });

  it('sends coldLoad through the configured inbound port', async () => {
    const sent: unknown[] = [];
    const runtime = {
      makeApplication: (input: RuntimeConfig) => input,
      embed: (_program: RuntimeProgram) => ({
        ports: { navigation: { send: (value: NavigationEvent) => sent.push(value) } },
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
      makeApplication: (input: RuntimeConfig) => input,
      embed: (_program: RuntimeProgram) => ({
        ports: {
          navigation: {
            send: (value: NavigationEvent) => events.push(['navigation', value]),
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
      makeApplication: (input: RuntimeConfig) => input,
      embed: (_program: RuntimeProgram) => ({
        ports: { navigation: { send: (value: NavigationEvent) => sent.push(value) } },
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
      makeApplication: (input: RuntimeConfig) => input,
      embed: (_program: RuntimeProgram) => ({
        ports: { navigation: { send: (value: NavigationEvent) => sent.push(value) } },
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
      makeApplication: (input: RuntimeConfig) => input,
      embed: (_program: RuntimeProgram) => ({
        ports: { navigation: { send: (value: NavigationEvent) => sent.push(value) } },
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
      makeApplication: (input: RuntimeConfig) => input,
      embed: (_program: RuntimeProgram) => ({
        ports: { navigation: { send: (value: NavigationEvent) => firstSent.push(value) } },
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
        makeApplication: (input: RuntimeConfig) => input,
        embed: (_program: RuntimeProgram) => ({
          ports: { navigation: { send: (value: NavigationEvent) => remountSent.push(value) } },
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
        makeApplication: (input: RuntimeConfig) => input,
        embed: (_program: RuntimeProgram) => ({
          ports: { other: { send: (value: NavigationEvent) => sent.push(value) } },
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
