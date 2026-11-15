import { Schema } from 'effect';
import { Runtime } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { expect, it, onTestFinished, vi } from 'vitest';

import { initModel } from '../../apps/request-diagnostics/model';
import { view as diagnosticsView } from '../../apps/request-diagnostics/view';
import * as PlotPanel from '../plot-panel';

async function focusScene<Model, Message extends { _tag: string }>(
  model: Model,
  view: (model: Model, h: HtmlBuilder<Message>) => Document,
  count: number,
) {
  const host = document.createElement('div');
  const container = document.createElement('div');
  container.id = 'shared-chart-focus';
  host.append(container);
  document.body.append(host);
  const handle = Runtime.embed(
    Runtime.makeApplication({
      Model: Schema.declare<Model>((value): value is Model => value === model),
      init: () => ({ model }),
      update: (model: Model, _message: Message) => ({ model }),
      view,
      container,
      devTools: false,
    }),
  );
  onTestFinished(() => {
    handle.dispose();
    host.remove();
  });
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
  await focusScene<PlotPanel.Model, PlotPanel.Message>(
    model,
    (current, h) => ({
      title: 'Plot panel',
      body: PlotPanel.view(
        { model: current, toParentMessage: (message) => message, ariaLabel: 'Points' },
        h,
      ),
    }),
    1,
  );
});

it('does not suppress focus on either diagnostics chart', async () => {
  await focusScene(initModel, diagnosticsView, 2);
});
