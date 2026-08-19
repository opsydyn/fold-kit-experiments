import { describe, expect, it } from 'bun:test';

import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { definePage } from '../../src/define-page';
import { check, renderToStaticMarkup } from '../../src/server';
import type { PageConfig } from '../../src/types';

const component = Object.assign(() => {}, { __foldkit: true as const });

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
  init: (flags: Flags) => [flags, [{ _tag: 'IgnoredCommand' }]] as const,
  update: (model: Model, _message: Message) => [model, []] as const,
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
    createAstro: (props: Record<string, unknown>) => ({
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

  it('fails closed for page rendering when the build identity is missing', async () => {
    delete process.env.FOLDKIT_BUILD_ID;
    await expect(
      renderToStaticMarkup.call({ result: makeResult() }, makePage(), { locale: 'en' }, {}),
    ).rejects.toThrow('FOLDKIT_BUILD_ID');
  });
});
