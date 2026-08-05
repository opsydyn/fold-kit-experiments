import { Option, Schema } from 'effect';
import { Runtime } from 'foldkit';
import { describe, expect, onTestFinished, test, vi } from 'vitest';

import { Locale, Model, Name, init } from './model';
import { update } from './update';
import { view } from './view';

const BrowserDirection = Schema.Literals(['ltr', 'rtl']);
const englishLanguage = Schema.decodeSync(Locale)('en');
const arabicLanguage = Schema.decodeSync(Locale)('ar');
const leftToRight = Schema.decodeSync(BrowserDirection)('ltr');
const rightToLeft = Schema.decodeSync(BrowserDirection)('rtl');

describe('greeting document metadata', () => {
  test('applies locale changes to the browser document root', async () => {
    const previousLang = document.documentElement.lang;
    const previousDir = document.documentElement.getAttribute('dir');
    const host = document.createElement('div');
    const container = document.createElement('div');
    container.id = 'greeting-runtime-test';
    host.appendChild(container);
    document.body.appendChild(host);
    const name = Schema.decodeSync(Name)('astronaut');
    const handle = Runtime.embed(
      Runtime.makeApplication({
        Model,
        init: () => init({ name }),
        update,
        view,
        container,
      }),
    );
    onTestFinished(() => {
      handle.dispose();
      host.remove();
      document.documentElement.lang = previousLang;
      Option.fromNullishOr(previousDir).pipe(
        Option.match({
          onNone: () => document.documentElement.removeAttribute('dir'),
          onSome: (dir) => document.documentElement.setAttribute('dir', dir),
        }),
      );
    });

    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe(englishLanguage);
      expect(document.documentElement.dir).toBe(leftToRight);
    });
    const arabicButton = host.querySelector<HTMLButtonElement>('button[aria-pressed="false"]');
    expect(arabicButton).toBeDefined();
    arabicButton?.click();
    await vi.waitFor(() => {
      expect(document.documentElement.lang).toBe(arabicLanguage);
      expect(document.documentElement.dir).toBe(rightToLeft);
    });
  });
});
