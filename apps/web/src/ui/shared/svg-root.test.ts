import { BrowserHost, Html } from '@effect/ui/html';
import { Effect, Exit, Schema, Scope } from 'effect';
import { expect, it, onTestFinished, vi } from 'vitest';

import { RequestDiagnostics } from '../../apps/request-diagnostics/main';
import * as PlotPanel from '../plot-panel/core';
import { view as plotPanelView } from '../plot-panel/effect-ui';

async function focusScene(
  mount: (host: HTMLElement, scope: Scope.Scope) => Promise<void>,
  count: number,
) {
  const host = document.createElement('div');
  document.body.append(host);
  const scope = Scope.makeUnsafe();
  onTestFinished(async () => {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    host.remove();
  });
  await mount(host, scope);
  await vi.waitFor(() => expect(host.querySelectorAll('.plot-panel')).toHaveLength(count));
  expect(host.querySelector('.comparison')).toBeNull();
  const charts = host.querySelectorAll<HTMLElement>('.plot-panel[tabindex="0"]');
  expect(charts).toHaveLength(count);
  for (const chart of charts) {
    chart.focus();
    expect(document.activeElement).toBe(chart);
    expect(chart.style.outline).not.toMatch(/\bnone\b/);
    expect(getComputedStyle(chart).outline).not.toMatch(/\bnone\b/);
  }
}

it('does not suppress native plot panel focus outside comparison', async () => {
  const model = PlotPanel.init({
    spec: {
      width: 300,
      height: 200,
      data: [{ x: 1, y: 2 }],
      marks: [{ mark: 'dot', x: 'x', y: 'y' }],
    },
  }).model;
  const Fixture = Html.component({
    name: 'ChartFocusFixture',
    model: Schema.Null,
    message: PlotPanel.Message,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      plotPanelView({ model, toParentMessage: (message) => message, ariaLabel: 'Points' }, h),
  });
  await focusScene(async (host, scope) => {
    const mount = BrowserHost.mountEffect(Fixture, {}, host, { head: false });
    await Effect.runPromise(Scope.provide(mount, scope));
  }, 1);
});

it('does not suppress focus on either diagnostics chart', async () => {
  vi.stubGlobal('fetch', () => Promise.resolve(Response.json([])));
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  await focusScene(async (host, scope) => {
    const mount = BrowserHost.mountEffect(RequestDiagnostics, {}, host, { head: false });
    await Effect.runPromise(Scope.provide(mount, scope));
  }, 2);
});
