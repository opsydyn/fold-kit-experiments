import { Scene } from 'foldkit';
import { describe, expect, it } from 'vitest';

import { renderChart } from '../../ui/shared/render-chart.test-helper';
import type { SnapshotResult } from './data';
import { Message } from './message';
import { initModel } from './model';
import { GlobePointerMount } from './mount';
import { update } from './update';
import { view } from './view';

const data: SnapshotResult = {
  _tag: 'Ready',
  snapshot: {
    provenance: {
      sourceUrl: 'https://earthquake.usgs.gov/',
      capturedAt: '2026-10-14T12:00:00Z',
      generatedAtMs: 1000,
      originalCount: 3,
      sha256: '0'.repeat(64),
    },
    excluded: {},
    warnings: {},
    window: [1000, 1000],
    events: [
      {
        id: 'front',
        longitude: 180,
        latitude: 0,
        magnitude: -1,
        depthKm: 0,
        timeMs: 1000,
        place: 'Front event',
        url: null,
      },
      {
        id: 'back',
        longitude: 0,
        latitude: 0,
        magnitude: 8,
        depthKm: -1.5,
        timeMs: 1000,
        place: 'Back event',
        url: null,
      },
      {
        id: 'unknown',
        longitude: 170,
        latitude: 20,
        magnitude: null,
        depthKm: null,
        timeMs: 1000,
        place: null,
        url: null,
      },
    ],
  },
};
const initial = () => initModel(data);
const rendered = async (model = initial()) => {
  const container = document.createElement('div');
  container.innerHTML = await renderChart<Message>((h) => view(model, h).body);
  return container;
};

describe('earthquake globe view', () => {
  it('hides rear markers and exposes all observations through the table', async () => {
    const root = await rendered();
    expect(root.querySelector('[data-event-id="front"] circle')?.getAttribute('r')).toBe('3');
    expect(root.querySelector('[data-event-id="back"]')).toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(root.textContent).toContain('2026-10-14T12:00:00Z');
    expect(root.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
  });
  it('renders unknown measurements distinctly and retains raw depth after selection moves behind', async () => {
    const root = await rendered();
    expect(root.querySelector('[data-event-id="unknown"] circle')?.getAttribute('fill')).toBe(
      'none',
    );
    let model = update(initial(), Message.ClickedEventRow({ id: 'back' })).model;
    const centred = await rendered(model);
    expect(centred.querySelector('[data-event-id="back"] circle')?.getAttribute('r')).toBe('10');
    for (let i = 0; i < 12; i++)
      model = update(model, Message.ClickedTurn({ direction: 'east' })).model;
    const rotated = await rendered(model);
    expect(rotated.querySelector('[data-event-id="back"]')).toBeNull();
    expect(rotated.querySelector('[aria-label="Selected earthquake"]')?.textContent).toContain(
      '-1.5 km',
    );
  });
  it('wires table inspection and toolbar commands through the actual FoldKit view', () => {
    Scene.scene(
      { view, update },
      Scene.given(initial()),
      Scene.Mount.resolveAll([GlobePointerMount, Message.CompletedGlobePointerMount()]),
      Scene.click(Scene.role('button', { name: 'Inspect back' })),
      Scene.expect(Scene.text('Back event')).toExist(),
      Scene.click(Scene.role('button', { name: 'Zoom in' })),
      Scene.expect(Scene.text('1.25x')).toExist(),
      Scene.click(Scene.role('button', { name: 'Reset globe' })),
      Scene.expect(Scene.text('1.00x')).toExist(),
      Scene.expect(Scene.text('No earthquake selected')).toExist(),
    );
  });
  it('keeps empty and failure states truthful without fake markers', async () => {
    if (data._tag !== 'Ready') throw new Error('Invalid test fixture');
    const empty = await rendered(
      initModel({
        _tag: 'Ready',
        snapshot: {
          ...data.snapshot,
          events: [],
          window: null,
          provenance: { ...data.snapshot.provenance, originalCount: 0 },
        },
      }),
    );
    expect(empty.textContent).toContain('No earthquakes in this recorded snapshot');
    expect(empty.querySelectorAll('[data-event-id]')).toHaveLength(0);
    const failed = await rendered(initModel({ _tag: 'Failure', reason: 'Invalid recorded feed' }));
    expect(failed.textContent).toContain('Invalid recorded feed');
    expect(failed.querySelector('svg')).toBeNull();
  });
});
