import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Schema } from 'effect';
import { Runtime } from 'foldkit';
import { assert, expect, it, onTestFinished, vi } from 'vitest';

import { Workbench } from '../../stories/comparison.stories';
import type { FoldkitAppConfig } from '../../stories/mount';
import * as config from './main';
import { observeWidths } from './observe-widths.test-helper';

function required<T>(value: T | null | undefined): T {
  assert(value !== null && value !== undefined);
  return value;
}

function names(host: HTMLElement) {
  return [...host.querySelectorAll('section[aria-labelledby]')].map(
    (panel) =>
      required(host.querySelector(`#${panel.getAttribute('aria-labelledby')}`)).textContent,
  );
}

it('initialises deterministic settings instead of interpreting Astro props as settings', () => {
  for (const props of [undefined, {}, { panels: [], nextPanelId: 99, linkInspections: false }]) {
    const { model } = config.init(props);
    expect(model.panels.map(({ id, _tag }) => ({ id, _tag }))).toEqual([
      { id: 1, _tag: 'Scatter' },
      { id: 2, _tag: 'Histogram' },
    ]);
    expect(model.nextPanelId).toBe(3);
    expect(model.linking._tag).toBe('Linked');
    expect(Schema.is(config.Model)(model)).toBe(true);
  }
});

it('hosts keyed inspection, caps additions, preserves order and stops updates on disposal', async () => {
  const observations = observeWidths();
  const host = document.createElement('div');
  const container = document.createElement('div');
  container.id = 'comparison-host-test';
  host.append(container);
  document.body.append(host);
  const update = vi.fn(config.update);
  const hostConfig: FoldkitAppConfig = { ...config, update };
  const handle = Runtime.embed(
    Runtime.makeApplication({ ...hostConfig, container, devTools: false }),
  );
  onTestFinished(() => {
    handle.dispose();
    host.remove();
  });
  const button = (name: string) =>
    required(host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`));
  await vi.waitFor(() => expect(names(host)).toEqual(['Scatter 1', 'Histogram 2']));
  const scatter = required(host.querySelector('#comparison-panel-1'));
  const addScatter = required(host.querySelector<HTMLButtonElement>('#comparison-add-scatter'));
  const addHistogram = required(host.querySelector<HTMLButtonElement>('#comparison-add-histogram'));
  addScatter.click();
  await vi.waitFor(() => expect(names(host)).toEqual(['Scatter 1', 'Histogram 2', 'Scatter 3']));
  addHistogram.click();
  await vi.waitFor(() =>
    expect(names(host)).toEqual(['Scatter 1', 'Histogram 2', 'Scatter 3', 'Histogram 4']),
  );
  expect(addScatter.disabled).toBe(true);
  expect(addHistogram.disabled).toBe(true);
  addScatter.click();
  addHistogram.click();
  expect(names(host)).toHaveLength(4);

  const histogram = required(
    host.querySelector('svg[aria-label="Histogram 2: salary distribution"]'),
  );
  histogram.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await vi.waitFor(() => expect(host.textContent).toContain('2 matching points'));
  expect(host.querySelectorAll('circle[data-linked-highlight]')).toHaveLength(4);
  const move = button('Move Histogram 2 earlier');
  move.focus();
  move.click();
  await vi.waitFor(() =>
    expect(names(host)).toEqual(['Histogram 2', 'Scatter 1', 'Scatter 3', 'Histogram 4']),
  );
  expect(host.querySelector('#comparison-panel-1')).toBe(scatter);
  expect(button('Move Histogram 2 earlier')).toBe(move);
  expect(host.textContent).toContain('2 matching points');
  button('Remove Histogram 2').click();
  await vi.waitFor(() => expect(names(host)).toEqual(['Scatter 1', 'Scatter 3', 'Histogram 4']));
  expect(host.textContent).toContain('0 matching points');
  expect(host.querySelectorAll('circle[data-linked-highlight]')).toHaveLength(0);
  for (const name of ['Scatter 1', 'Scatter 3', 'Histogram 4']) {
    button(`Remove ${name}`).click();
    await vi.waitFor(() => expect(names(host)).not.toContain(name));
  }
  expect(host.textContent).toContain('No panels');
  addScatter.click();
  await vi.waitFor(() => expect(names(host)).toEqual(['Scatter 5']));
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('comparison-panel-5'));

  const chart = required(host.querySelector('svg'));
  const overlay = required(chart.querySelector('rect[fill="transparent"]'));
  const removed = vi.spyOn(overlay, 'removeEventListener');
  await vi.waitFor(() => expect(observations).toHaveLength(5));
  handle.dispose();
  await vi.waitFor(() => {
    for (const observation of observations) expect(observation.disconnect).toHaveBeenCalledTimes(1);
    expect(removed.mock.calls.some(([type]) => type === 'pointermove')).toBe(true);
  });
  const calls = update.mock.calls.length;
  const disposedHtml = host.innerHTML;
  addScatter.click();
  chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  overlay.dispatchEvent(new PointerEvent('pointermove', { clientX: 100, clientY: 100 }));
  for (const observation of observations) observation.notify(640);
  window.dispatchEvent(new Event('resize'));
  // Cross one event-loop task after exercising disposed targets; cleanup was already observed.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(update).toHaveBeenCalledTimes(calls);
  expect(host.innerHTML).toBe(disposedHtml);
});

it('mounts the maintained application through the Story helper', async () => {
  const host = Workbench.render();
  document.body.append(host);
  onTestFinished(() => host.remove());
  await vi.waitFor(() => expect(names(host)).toEqual(['Scatter 1', 'Histogram 2']));
  required(host.querySelector<HTMLButtonElement>('#comparison-add-histogram')).click();
  await vi.waitFor(() => expect(names(host)).toEqual(['Scatter 1', 'Histogram 2', 'Histogram 3']));
});

it('registers one client-loaded comparison island under Layout and links from Charts', () => {
  const pageUrl = resolve(import.meta.dirname, '../../pages/comparison.astro');
  expect(existsSync(pageUrl), 'The comparison route must exist').toBe(true);
  const page = readFileSync(pageUrl, 'utf8');
  expect(page).toMatch(/import ComparisonApp from ['"]\.\.\/apps\/comparison\/app['"]/);
  expect(page).toMatch(/<Layout\b/);
  expect(page.match(/<ComparisonApp\b/g)).toHaveLength(1);
  expect(page).toMatch(/<ComparisonApp\s+client:load\s*\/>/);
  const charts = readFileSync(resolve(import.meta.dirname, '../../pages/charts.astro'), 'utf8');
  expect(charts).toMatch(/<a\s+href="\/comparison"[^>]*>Chart comparison<\/a>/);
  const app = readFileSync(resolve(import.meta.dirname, './app.ts'), 'utf8');
  expect(app).toContain("lazyApp(() => import('./main'))");
});
