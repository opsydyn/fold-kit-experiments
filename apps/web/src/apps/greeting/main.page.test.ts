import { Schema } from 'effect';
import { describe, expect, test } from 'vitest';

import { Props } from './model';
import { localeFromUrl, presentationFor } from './presentation';

describe('Greeting page presentation', () => {
  test('accepts English and Arabic and falls back to English', () => {
    for (const [query, locale] of [
      ['ar', 'ar'],
      ['en', 'en'],
      ['fr', 'en'],
    ] as const)
      expect(localeFromUrl(new URL('https://example.test/greeting?locale=' + query))).toBe(locale);
  });

  test('uses the same metadata on the server and the client', () => {
    const props = Schema.decodeSync(Props)({ name: 'Ada', locale: 'ar' });
    expect(presentationFor(props)).toEqual({
      greeting: 'مرحبا، Ada!',
      title: 'مرحبا، Ada! — Astro + Effect UI',
      lang: 'ar',
      dir: 'rtl',
      canonical: 'https://opsydyn-web.opsydyn.workers.dev/greeting?locale=ar',
      ogUrl: 'https://opsydyn-web.opsydyn.workers.dev/greeting?locale=ar',
    });
  });
});
