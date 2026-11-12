import { afterEach, describe, expect, it, spyOn } from 'bun:test';

import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { defineApp } from '../../src/define-app';
import { definePage } from '../../src/define-page';
import { check, renderToStaticMarkup } from '../../src/server';
import type { AstroProps } from '../../src/server';
import type { PageConfig } from '../../src/types';

const component = Object.assign(() => {}, { __foldkit: true as const });

type IslandProps = { readonly label: string; readonly noMeta?: boolean | '' };
type IslandModel = { readonly label: string };
type IslandMessage = { readonly _tag: 'NoOp' };

const islandConfig = {
  Model: {},
  init: (props: IslandProps) => ({
    model: { label: props.label },
    commands: [{ _tag: 'IgnoredCommand' }],
  }),
  update: (model: IslandModel, _message: IslandMessage) => ({ model }),
  view: (model: IslandModel, h: HtmlBuilder<IslandMessage>): Document => ({
    title: `Island ${model.label}`,
    body: h.section([], [`island:${model.label}`]),
  }),
};

// SAFETY: The test fixture establishes this value before the assertion.
const makeIsland = (options?: { readonly prerender?: boolean }) =>
  defineApp<IslandProps>(() => Promise.resolve(islandConfig as never), options);

type Flags = {
  readonly locale: string;
  readonly pathname: string;
  readonly routeLocale?: string;
};

type Model = Flags;

type Message = {
  readonly _tag: 'NoOp';
};

const Flags = Schema.Struct({
  locale: Schema.String,
  pathname: Schema.String,
  routeLocale: Schema.optional(Schema.String),
});

const pageConfig = {
  Flags,
  Model: {},
  init: (flags: Flags) => ({ model: flags, commands: [{ _tag: 'IgnoredCommand' }] }),
  update: (model: Model, _message: Message) => ({ model }),
  view: (model: Model, h: HtmlBuilder<Message>): Document => ({
    title: 'Server page',
    body: h.section([], [`${model.locale}:${model.pathname}:${model.routeLocale ?? 'missing'}`]),
  }),
} satisfies PageConfig<Flags, Model, Message>;

const makePage = () =>
  definePage<{ readonly locale: string }, Flags>(() => Promise.resolve(pageConfig), {
    flags: ({ request, url, params, props }) => ({
      locale: props.locale,
      pathname: `${request.method}:${url.pathname}`,
      routeLocale: params.locale,
    }),
  });

const makeResult = () => {
  const request = new Request('https://example.com/en?preview=true', { method: 'POST' });
  return {
    request,
    params: { locale: 'en' },
    createAstro: (props: AstroProps) => ({
      request,
      url: new URL(request.url),
      params: { locale: 'en' },
      props,
    }),
  };
};

describe('astro-foldkit server renderer', () => {
  it('renders a deterministic FoldKit mount shell', async () => {
    const first = await renderToStaticMarkup.call({}, component, { id: 'ignored' }, {});
    const second = await renderToStaticMarkup.call({}, component, { id: 'different' }, {});

    expect(first).toEqual({ html: '<div data-foldkit-island="true"></div>' });
    expect(second).toEqual(first);
  });

  it('recognizes only FoldKit components', async () => {
    expect(await check(component)).toBe(true);
    expect(await check(makePage())).toBe(true);
    expect(await check({ __foldkit: false })).toBe(false);
  });

  it('renders a definePage component through the FoldKit server path', async () => {
    process.env.FOLDKIT_BUILD_ID = 'unit-build';
    const result = makeResult();
    const rendered = await renderToStaticMarkup.call({ result }, makePage(), { locale: 'en' }, {});
    delete process.env.FOLDKIT_BUILD_ID;

    expect(rendered.html).toContain('en:POST:/en:en');
    expect(rendered.html).toContain('data-foldkit-app="app"');
    expect(rendered.html).toContain('data-foldkit-build="unit-build"');
  });

  it('rejects a second page owner for the same Astro result', async () => {
    process.env.FOLDKIT_BUILD_ID = 'unit-build';
    const result = makeResult();
    await renderToStaticMarkup.call({ result }, makePage(), { locale: 'en' }, {});
    await expect(
      renderToStaticMarkup.call({ result }, makePage(), { locale: 'en' }, {}),
    ).rejects.toThrow('one FoldKit page');
    delete process.env.FOLDKIT_BUILD_ID;
  });

  it('still renders the empty shell for an island that did not opt in', async () => {
    const rendered = await renderToStaticMarkup.call({}, makeIsland(), { label: 'a' }, {});
    expect(rendered).toEqual({ html: '<div data-foldkit-island="true"></div>' });
  });

  it('renders an opted-in island into the mount the client already looks for', async () => {
    const rendered = await renderToStaticMarkup.call(
      {},
      makeIsland({ prerender: true }),
      { label: 'a' },
      {},
    );

    expect(rendered.html).toStartWith('<div data-foldkit-island="true">');
    expect(rendered.html).toEndWith('</div>');
    expect(rendered.html).toContain('island:a');
  });

  it('renders island markup from the props, so two islands differ', async () => {
    const first = await renderToStaticMarkup.call(
      {},
      makeIsland({ prerender: true }),
      { label: 'a' },
      {},
    );
    const second = await renderToStaticMarkup.call(
      {},
      makeIsland({ prerender: true }),
      { label: 'b' },
      {},
    );

    expect(first.html).toContain('island:a');
    expect(second.html).toContain('island:b');
  });

  it('stamps no hydration root on a pre-rendered island, so several may share a page', async () => {
    const rendered = await renderToStaticMarkup.call(
      {},
      makeIsland({ prerender: true }),
      { label: 'a' },
      {},
    );

    expect(rendered.html).not.toContain('data-foldkit-app');
    expect(rendered.html).not.toContain('data-foldkit-flags');
  });

  it('needs no build identity, because nothing hydrates the markup', async () => {
    delete process.env.FOLDKIT_BUILD_ID;
    const rendered = await renderToStaticMarkup.call(
      {},
      makeIsland({ prerender: true }),
      { label: 'a' },
      {},
    );

    expect(rendered.html).toContain('island:a');
    expect(rendered.html).not.toContain('data-foldkit-build');
  });

  it('needs no Astro result, because an island reads no request', async () => {
    const rendered = await renderToStaticMarkup.call(
      undefined,
      makeIsland({ prerender: true }),
      { label: 'a' },
      {},
    );
    expect(rendered.html).toContain('island:a');
  });

  it('does not claim page ownership, so an opted-in island may repeat', async () => {
    const result = makeResult();
    await renderToStaticMarkup.call(
      { result },
      makeIsland({ prerender: true }),
      { label: 'a' },
      {},
    );
    const second = await renderToStaticMarkup.call(
      { result },
      makeIsland({ prerender: true }),
      { label: 'b' },
      {},
    );

    expect(second.html).toContain('island:b');
  });

  it('fails closed when an opted-in island cannot render', async () => {
    const broken = defineApp<IslandProps>(
      () =>
        // SAFETY: The test fixture establishes this value before the assertion.
        Promise.resolve({
          ...islandConfig,
          init: () => {
            // oxlint-disable-next-line linteffect/no-adhoc-domain-error -- the throw is the fixture: it stands for an init that touches a browser-only resource during a server render.
            throw new Error('init touched the browser');
          },
        } as never),
      { prerender: true },
    );

    await expect(renderToStaticMarkup.call({}, broken, { label: 'a' }, {})).rejects.toThrow(
      'init touched the browser',
    );
  });

  it('fails closed for page rendering when the build identity is missing', async () => {
    delete process.env.FOLDKIT_BUILD_ID;
    await expect(
      renderToStaticMarkup.call({ result: makeResult() }, makePage(), { locale: 'en' }, {}),
    ).rejects.toMatchObject({ _tag: 'MissingBuildId' });
  });
});

describe('astro-foldkit island diagnostics', () => {
  // Each test names its own component: warnings are deduplicated per component
  // for the life of the module, as they would be across a dev session.
  const render = (name: string, hydrate: string | undefined, prerender: boolean) =>
    renderToStaticMarkup.call(
      {},
      makeIsland({ prerender }),
      { label: 'a' },
      {},
      hydrate === undefined ? { displayName: name } : { displayName: name, hydrate },
    );

  let restoreWarn: (() => void) | undefined;

  const warnings = () => {
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    restoreWarn = () => spy.mockRestore();
    return spy;
  };

  afterEach(() => {
    restoreWarn?.();
    restoreWarn = undefined;
  });

  it('warns when an island has no directive and is not pre-rendered, because it can never show anything', async () => {
    const warn = warnings();
    await render('DeadIsland', undefined, false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('DeadIsland');
    expect(String(warn.mock.calls[0]?.[0])).toContain('prerender: true');
  });

  it('warns when client:visible is used without pre-rendering, because the empty mount never intersects', async () => {
    const warn = warnings();
    await render('InvisibleIsland', 'visible', false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('client:visible');
    expect(String(warn.mock.calls[0]?.[0])).toContain('InvisibleIsland');
  });

  it('warns when client:interaction is used without pre-rendering, because the empty mount has nothing to wait on', async () => {
    const warn = warnings();
    await render('UntouchableIsland', 'interaction', false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('client:interaction');
    expect(String(warn.mock.calls[0]?.[0])).toContain('UntouchableIsland');
  });

  it('stays quiet for client:load without pre-rendering, which hydrates whatever its size', async () => {
    const warn = warnings();
    await render('LoadIsland', 'load', false);
    await render('IdleIsland', 'idle', false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays quiet for a pre-rendered island, with or without a directive', async () => {
    const warn = warnings();
    await render('StaticIsland', undefined, true);
    await render('VisibleIsland', 'visible', true);
    await render('InteractionIsland', 'interaction', true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once per component, not once per render', async () => {
    const warn = warnings();
    await render('RepeatedIsland', undefined, false);
    await render('RepeatedIsland', undefined, false);
    await render('RepeatedIsland', undefined, false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('still renders the shell it warned about, so a warning never breaks a build', async () => {
    warnings();
    const rendered = await render('ShellIsland', undefined, false);
    expect(rendered).toEqual({ html: '<div data-foldkit-island="true"></div>' });
  });
});
