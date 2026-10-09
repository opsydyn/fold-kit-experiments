import { Schema } from 'effect';
import { Runtime } from 'foldkit';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { expect, it, onTestFinished, vi } from 'vitest';

import { initModel } from '../../apps/request-diagnostics/model';
import { view as diagnosticsView } from '../../apps/request-diagnostics/view';
import * as Histogram from '../histogram-chart';
import * as Scatter from '../scatter-chart';

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
  await vi.waitFor(() => expect(host.querySelectorAll('svg')).toHaveLength(count));
  expect(host.querySelector('.comparison')).toBeNull();
  const charts = host.querySelectorAll<SVGElement>('svg[tabindex="0"]');
  expect(charts).toHaveLength(count);
  for (const chart of charts) {
    chart.focus();
    expect(document.activeElement).toBe(chart);
    expect(chart.style.outline).not.toMatch(/\bnone\b/);
    expect(getComputedStyle(chart).outline).not.toMatch(/\bnone\b/);
  }
}

it('does not suppress native histogram focus outside comparison', async () => {
  await focusScene<Histogram.Model, Histogram.Message>(
    Histogram.init({ data: [] }).model,
    (model, h) => ({
      title: 'Histogram',
      body: Histogram.view({ model, toParentMessage: (message) => message }, h),
    }),
    1,
  );
});

it('does not suppress native scatter focus outside comparison', async () => {
  await focusScene<Scatter.Model, Scatter.Message>(
    Scatter.init({ points: [] }).model,
    (model, h) => ({
      title: 'Scatter',
      body: Scatter.view({ model, toParentMessage: (message) => message }, h),
    }),
    1,
  );
});

it('does not suppress focus on either diagnostics chart', async () => {
  await focusScene(initModel, diagnosticsView, 2);
});
