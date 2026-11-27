import { Html, HtmlServer } from '@effect/ui/html';
import { HtmlLocator, HtmlScene } from '@effect/ui/html/testing';
import { Locator } from '@effect/ui/testing';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import type { SnapshotResult } from './data';
import { Message } from './message';
import { initModel, State } from './model';
import { GlobePointerMount } from './mount';
import { update } from './update';
import { view } from './view';

const data = {
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
} satisfies SnapshotResult;
const initial = () => initModel(data);
const fixture = (model = initial()) => {
  const { data, ...state } = model;
  return Html.component({ name: 'GlobeFixture', model: State, message: Message }).make({
    init: () => state,
    update: ($, message) => {
      const { data: _data, ...next } = update({ ...$.model, data }, message).model;
      return next;
    },
    view: (h, current) => view({ ...current, data }, h),
  });
};

const rendered = async (model = initial()) => {
  const container = document.createElement('div');
  container.innerHTML = (await Effect.runPromise(HtmlServer.renderToHtml(fixture(model), {}))).html;
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
  it('wires table inspection and toolbar commands through Effect UI', () => {
    const exercise = Effect.gen(function* () {
      const scene = yield* HtmlScene.make(fixture(), {});
      scene.expectMount(GlobePointerMount());
      const button = (name: string) => HtmlLocator.role('button', { name });
      scene
        .click(button('Inspect back'))
        .expect(Locator.text('Back event'))
        .toExist()
        .click(button('Zoom in'))
        .expect(Locator.text('1.25x'))
        .toExist()
        .click(button('Reset globe'))
        .expect(Locator.text('1.00x'))
        .toExist()
        .expect(Locator.text('No earthquake selected'))
        .toExist();
    });
    exercise.pipe(Effect.scoped, Effect.runSync);
  });
  it('keeps empty and failure states truthful without fake markers', async () => {
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
