import { afterEach, describe, expect, it } from 'bun:test';

import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';

import { shouldSkipMetadata } from '../../src/client-helpers';
import { definePage } from '../../src/define-page';
import { resolvePageDocument } from '../../src/server-public';
import type { PageConfig } from '../../src/types';

type Flags = {
  readonly locale: string;
  readonly pathname: string;
  readonly routeLocale?: string;
  readonly noMeta: boolean;
};

type Model = Flags;

type Message = {
  readonly _tag: 'NoOp';
};

const Flags = Schema.Struct({
  locale: Schema.String,
  pathname: Schema.String,
  routeLocale: Schema.optional(Schema.String),
  noMeta: Schema.Boolean,
});
const textDirectionByLocale: Readonly<Record<string, 'Rtl' | 'Auto'>> = {
  ar: 'Rtl',
};

const pageConfig = {
  Flags,
  Model: {},
  init: (flags: Flags) => [flags, [{ _tag: 'IgnoredCommand' }]] as const,
  update: (model: Model, _message: Message) => [model, []] as const,
  view: (model: Model, h: HtmlBuilder<Message>): Document => ({
    title: `Server page ${model.locale}`,
    lang: model.locale,
    dir: textDirectionByLocale[model.locale] ?? 'Auto',
    canonical: '',
    ogUrl: `https://example.com${model.pathname}`,
    body: h.section([], [`${model.locale}:${model.pathname}:${model.routeLocale ?? 'missing'}`]),
  }),
} satisfies PageConfig<Flags, Model, Message>;

const makePage = () =>
  definePage<{ readonly locale: string; readonly noMeta?: boolean | '' }, Flags>(
    () => Promise.resolve(pageConfig),
    {
      flags: ({ request, url, params, props }) => ({
        locale: props.locale,
        pathname: `${request.method}:${url.pathname}`,
        routeLocale: params.locale,
        noMeta: shouldSkipMetadata(props),
      }),
    },
  );

const context: {
  readonly request: Request;
  readonly url: URL;
  readonly params: { readonly locale: string };
  readonly props: { readonly locale: string; readonly noMeta: true };
} = {
  request: new Request('https://example.com/ar/dashboard?preview=true', { method: 'POST' }),
  url: new URL('https://example.com/ar/dashboard?preview=true'),
  params: { locale: 'ar' },
  props: { locale: 'ar', noMeta: true },
};

afterEach(() => {
  delete process.env.FOLDKIT_BUILD_ID;
});

describe('resolvePageDocument', () => {
  it('derives Flags from request/url/params/props and returns rendered document metadata', async () => {
    process.env.FOLDKIT_BUILD_ID = 'resolver-build';

    const resolved = await resolvePageDocument(makePage(), context);

    expect(resolved).toEqual({
      title: 'Server page ar',
      lang: 'ar',
      dir: 'rtl',
      canonical: '',
      ogUrl: 'https://example.comPOST:/ar/dashboard',
    });
  });

  it('returns only the public document metadata fields when a build identity is configured', async () => {
    process.env.FOLDKIT_BUILD_ID = 'resolver-build-123';

    const resolved = await resolvePageDocument(makePage(), context);

    expect('buildId' in resolved).toBe(false);
    expect(resolved.title).toBe('Server page ar');
  });

  it('preserves absent optional metadata fields instead of filling them in', async () => {
    process.env.FOLDKIT_BUILD_ID = 'resolver-build';

    const page = definePage<{ readonly locale: string }, { readonly locale: string }>(
      () =>
        Promise.resolve({
          Flags: Schema.Struct({ locale: Schema.String }),
          Model: {},
          init: (flags: { readonly locale: string }) => [flags, []] as const,
          update: (model: { readonly locale: string }, _message: Message) => [model, []] as const,
          view: (model: { readonly locale: string }, h: HtmlBuilder<Message>): Document => ({
            title: `Only title ${model.locale}`,
            body: h.main([], [model.locale]),
          }),
        } satisfies PageConfig<{ readonly locale: string }, { readonly locale: string }, Message>),
      { flags: ({ props }) => ({ locale: props.locale }) },
    );

    const resolved = await resolvePageDocument(page, {
      request: new Request('https://example.com/en'),
      url: new URL('https://example.com/en'),
      params: {},
      props: { locale: 'en' },
    });

    expect(resolved).toEqual({ title: 'Only title en' });
    expect('lang' in resolved).toBe(false);
    expect('dir' in resolved).toBe(false);
    expect('canonical' in resolved).toBe(false);
    expect('ogUrl' in resolved).toBe(false);
  });

  it('returns page document metadata even when client noMeta logic would suppress island metadata writes', async () => {
    process.env.FOLDKIT_BUILD_ID = 'resolver-build';

    expect(shouldSkipMetadata(context.props)).toBe(true);
    const resolved = await resolvePageDocument(makePage(), context);

    expect(resolved.title).toBe('Server page ar');
    expect(resolved.lang).toBe('ar');
  });

  it('fails closed when the build identity is missing', async () => {
    await expect(resolvePageDocument(makePage(), context)).rejects.toThrow('FOLDKIT_BUILD_ID');
  });
});
