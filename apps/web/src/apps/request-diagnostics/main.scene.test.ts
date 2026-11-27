import { Component } from '@effect/ui';
import { BrowserHost } from '@effect/ui/html';
import { Effect, Exit, Scope } from 'effect';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import app from './app';
import { RequestDiagnostics, update } from './main';
import { Message } from './message';
import { initModel } from './model';

/** The machine's own Commands: every message it takes is also reported to the observatory. */
const machineCommands = (commands: ReadonlyArray<{ readonly name: string }> | undefined) =>
  (commands ?? []).filter(({ name }) => name !== 'ReportToObservatory');

describe('request diagnostics navigation scene', () => {
  it('uses Effect UI for the Astro island', () => {
    expect(Component.isComponent(app)).toBe(true);
  });

  it('updates route metadata without rebuilding chart models', () => {
    const model = initModel;
    const { model: nextModel, commands } = update(
      model,
      Message.Navigated({
        phase: 'entered',
        path: '/request-diagnostics/acme/platform/docs/intro.md',
        previousPath: '/request-diagnostics',
      }),
    );

    expect(machineCommands(commands)).toEqual([]);
    expect(nextModel.histogram).toBe(model.histogram);
    expect(nextModel.scatter).toBe(model.scatter);
    expect(nextModel.route).toEqual({
      _tag: 'Document',
      repository: 'acme/platform',
      document: 'docs/intro.md',
    });
  });

  it('delivers Astro route changes through the native mount and releases its listener', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(Response.json([])));
    const host = document.createElement('div');
    document.body.append(host);
    const scope = Scope.makeUnsafe();
    onTestFinished(async () => {
      await Effect.runPromise(Scope.close(scope, Exit.void));
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      host.remove();
    });
    const mount = BrowserHost.mountEffect(RequestDiagnostics, {}, host, { head: false });
    await Effect.runPromise(Scope.provide(mount, scope));
    await vi.waitFor(() => expect(host.textContent).toContain('coldLoad'));
    const dispatch = (path: string) =>
      document.dispatchEvent(
        Object.assign(new Event('astro:before-swap'), { to: new URL(path, 'http://localhost') }),
      );
    dispatch('/request-diagnostics/acme/platform/docs/intro.md');
    await vi.waitFor(() =>
      expect(host.textContent).toContain('stayed /request-diagnostics/acme/platform/docs/intro.md'),
    );
    const removed = vi.spyOn(document, 'removeEventListener');
    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(removed.mock.calls.some(([name]) => name === 'astro:before-swap')).toBe(true);
  });
});
