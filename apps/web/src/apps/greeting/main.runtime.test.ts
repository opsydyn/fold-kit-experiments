import { BrowserHost } from '@effect/ui/html';
import { Effect, Exit, Schema, Scope } from 'effect';
import { expect, onTestFinished, test, vi } from 'vitest';

import { Greeting } from './main';
import { Props } from './model';

test('updates document metadata through the native Greeting component', async () => {
  const previousLang = document.documentElement.lang;
  const previousDir = document.documentElement.getAttribute('dir');
  const previousTitle = document.title;
  const host = document.createElement('div');
  document.body.append(host);
  const scope = Scope.makeUnsafe();
  onTestFinished(async () => {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    host.remove();
    document.title = previousTitle;
    document.documentElement.lang = previousLang;
    if (previousDir === null) document.documentElement.removeAttribute('dir');
    else document.documentElement.dir = previousDir;
  });
  const props = Schema.decodeSync(Props)({ name: 'astronaut', locale: 'en' });
  const mount = BrowserHost.mountEffect(Greeting, props, host, { head: false });
  await Effect.runPromise(Scope.provide(mount, scope));
  const arabic = host.querySelector<HTMLButtonElement>('button[aria-pressed="false"]');
  expect(arabic?.textContent).toBe('Arabic');
  arabic?.click();
  await vi.waitFor(() => {
    expect(host.textContent).toContain('مرحبا، astronaut!');
    expect(arabic?.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.title).toBe('مرحبا، astronaut! — Astro + Effect UI');
  });
});
