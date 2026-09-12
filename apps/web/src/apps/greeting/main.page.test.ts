import { resolvePageDocument } from '@opsydyn/astro-foldkit/server';
import { Schema } from 'effect';
import { inertHtml } from 'foldkit/html';
import type { HtmlBuilder } from 'foldkit/html';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Message } from './message';
import { Flags, Name, init } from './model';
import GreetingPage from './page';
import { view } from './view';

const props = (name: string) => ({ name: Schema.decodeSync(Name)(name) });

const context = (url: string, name: string) => ({
  request: new Request(url),
  url: new URL(url),
  params: {},
  props: props(name),
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GreetingPage', () => {
  test('derives Flags from validated props and the accepted request URL locale', () => {
    const ada = Schema.decodeSync(Name)('Ada');

    expect(GreetingPage.flags(context('https://example.com/greeting?locale=ar', 'Ada'))).toEqual({
      name: ada,
      locale: 'ar',
    });
    expect(GreetingPage.flags(context('https://example.com/greeting?locale=en', 'Ada'))).toEqual({
      name: ada,
      locale: 'en',
    });
    expect(GreetingPage.flags(context('https://example.com/greeting?locale=fr', 'Ada'))).toEqual({
      name: ada,
      locale: 'en',
    });
  });

  test('initialises directly from Flags instead of rebuilding request defaults', () => {
    const flags = Schema.decodeSync(Flags)({ name: 'Ada', locale: 'ar' });

    expect(init(flags).model).toEqual({
      name: Schema.decodeSync(Name)('Ada'),
      locale: 'ar',
    });
  });

  test('resolves the FoldKit document metadata used by the Astro layout', async () => {
    vi.stubEnv('FOLDKIT_BUILD_ID', 'greeting-page-test');

    await expect(
      resolvePageDocument(GreetingPage, context('https://example.com/greeting?locale=ar', 'Ada')),
    ).resolves.toEqual({
      title: 'مرحبا، Ada! — Astro + FoldKit',
      lang: 'ar',
      dir: 'rtl',
      canonical: 'https://opsydyn-web.opsydyn.workers.dev/greeting?locale=ar',
      ogUrl: 'https://opsydyn-web.opsydyn.workers.dev/greeting?locale=ar',
    });
  });

  test('view metadata remains deterministic from the model only', () => {
    const document = view(
      { name: Schema.decodeSync(Name)('Ada'), locale: 'en' },
      inertHtml as unknown as HtmlBuilder<Message>,
    );

    expect(document.title).toBe('Hello, Ada! — Astro + FoldKit');
    expect(document.lang).toBe('en');
    expect(document.canonical).toBe('https://opsydyn-web.opsydyn.workers.dev/greeting');
    expect(document.ogUrl).toBe('https://opsydyn-web.opsydyn.workers.dev/greeting');
  });
});
