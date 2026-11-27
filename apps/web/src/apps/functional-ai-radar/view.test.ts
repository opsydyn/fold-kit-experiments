import { Html, HtmlServer } from '@effect/ui/html';
import { HtmlLocator, HtmlScene } from '@effect/ui/html/testing';
import { Locator } from '@effect/ui/testing';
import { demoNotice, loadDemoRadar } from '@opsydyn/effect-three-samples/radar/data';
import { Effect, Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { FunctionalAiRadar } from './main';
import { Message } from './message';
import { initModel, type Model } from './model';
import { RadarPointerMount } from './mount';
import { update } from './update';
import { view } from './view';

const initial = () => initModel(loadDemoRadar());
async function rendered(model = initial()) {
  const root = document.createElement('div');
  const Fixture = Html.component({
    name: 'RadarFixture',
    model: Schema.Number,
    message: Message,
  }).make({
    init: () => 0,
    update: ({ model }) => model,
    view: (h) => h.div.children(view(model, h)),
  });
  root.innerHTML = (await Effect.runPromise(HtmlServer.renderToHtml(Fixture, {}))).html;
  return root;
}

describe('functional AI radar rendered contract', () => {
  it('shows provenance, all 32 entries and only front markers in a finite wireframe', async () => {
    const root = await rendered();
    expect(root.textContent).toContain(demoNotice);
    expect(root.querySelectorAll('[data-entry-id]')).toHaveLength(32);
    expect(root.querySelectorAll('[data-shell]')).toHaveLength(4);
    const marks = root.querySelectorAll('[data-blip-id]');
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.length).toBeLessThan(32);
    expect(root.querySelector('svg')?.outerHTML).not.toMatch(/NaN|Infinity/);
    expect(root.querySelectorAll('[aria-live="polite"][aria-atomic="true"]')).toHaveLength(1);
    expect(root.textContent).toContain('No technology selected');
  });
  it('retains actual metadata behind the scene and paints a visible selection last', async () => {
    let model = update(initial(), Message.ClickedEntryRow({ id: 'effect' })).model;
    const front = await rendered(model);
    expect(
      front.querySelector('[data-selected-paint-id]')?.getAttribute('data-selected-paint-id'),
    ).toBe('effect');
    expect(
      front
        .querySelector('[data-selected-paint-id]')
        ?.parentElement?.previousElementSibling?.querySelectorAll('[data-blip-id]').length,
    ).toBeGreaterThan(0);
    expect(
      front.querySelector('[data-selected-paint-id]')?.parentElement?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(front.querySelector('[data-selected-paint-id] [role="button"]')).toBeNull();
    expect(front.querySelector('[data-blip-id="effect"] [data-selected-outline]')).not.toBeNull();
    const source = front.querySelector('[aria-label="Selected technology"] a');
    expect(source?.getAttribute('href')).toBe('https://effect.website/');
    expect(source?.getAttribute('target')).toBe('_blank');
    expect(source?.getAttribute('rel')).toBe('noopener noreferrer');
    for (let i = 0; i < 12; i++)
      model = update(model, Message.ClickedTurn({ direction: 'east' })).model;
    const rear = await rendered(model);
    expect(rear.querySelector('[data-blip-id="effect"]')).toBeNull();
    const details = rear.querySelector('[aria-label="Selected technology"]');
    expect(details?.textContent).toContain('Effect');
    expect(details?.textContent).toContain('Languages & Frameworks');
    expect(details?.textContent).toContain('Adopt');
  });
  it('distinguishes separate entries even when one is hidden or filtered away', async () => {
    const model = initModel({
      _tag: 'Ready',
      dataset: {
        authoredOn: '2026-10-14',
        entries: [
          {
            id: 'alpha',
            name: 'Alpha',
            category: 'tools',
            ring: 'adopt',
            description: 'First',
            sourceUrl: 'https://example.com/alpha',
          },
          {
            id: 'beta',
            name: 'Beta',
            category: 'tools',
            ring: 'caution',
            description: 'Second',
            sourceUrl: 'https://example.com/beta',
          },
        ],
      },
    });
    for (const [id, name, ring] of [
      ['alpha', 'Alpha', 'Adopt'],
      ['beta', 'Beta', 'Caution'],
    ]) {
      const root = await rendered(update(model, Message.ClickedEntryRow({ id })).model);
      expect(root.querySelectorAll('[data-entry-id]')).toHaveLength(2);
      expect(root.querySelector('[aria-label="Selected technology"]')?.textContent).toContain(name);
      expect(root.querySelector('[aria-label="Selected technology"]')?.textContent).toContain(ring);
    }
    const filtered = await rendered(update(model, Message.ChangedQuery({ query: 'Alpha' })).model);
    expect(filtered.querySelector('[data-entry-id="beta"]')).toBeNull();
    expect(filtered.querySelector('[data-blip-id="beta"]')).toBeNull();
  });
  it('wires search, category, checkboxes and inspection through the real view', () => {
    const exercise = Effect.gen(function* () {
      const scene = yield* HtmlScene.make(FunctionalAiRadar, {});
      scene.expectMount(RadarPointerMount());
      const button = (name: string) => HtmlLocator.role('button', { name });
      scene
        .type(
          HtmlLocator.role('searchbox', { name: 'Search technologies' }),
          'Algebraic data types',
        )
        .expect(Locator.text('1 matching technology'))
        .toExist()
        .click(button('Inspect Algebraic data types'))
        .expect(Locator.text('Adopt'))
        .toExist()
        .click(HtmlLocator.role('checkbox', { name: 'Adopt (1)' }))
        .expect(Locator.text('No matching technologies'))
        .toExist()
        .expect(Locator.text('Selection cleared by filters'))
        .toExist()
        .click(button('Clear filters'))
        .change(HtmlLocator.role('combobox', { name: 'Category' }), 'tools')
        .expect(Locator.text('8 matching technologies'))
        .toExist()
        .click(button('Zoom in'))
        .expect(Locator.text('1.25x'))
        .toExist()
        .click(button('Reset view'))
        .expect(Locator.text('1.00x'))
        .toExist()
        .expect(Locator.text('8 matching technologies'))
        .toExist();
    });
    exercise.pipe(Effect.scoped, Effect.runSync);
  });
  it('renders four complete inert shell outlines at every pose and scales their radii', async () => {
    const root = await rendered({ ...initial(), center: [35, 55], zoom: 1.25 });
    const outlines = Array.from(root.querySelectorAll('[data-shell-outline]'));
    expect(outlines.map((node) => Number(node.getAttribute('r')))).toEqual([130, 195, 260, 325]);
    for (const node of outlines) {
      expect(node.getAttribute('cx')).toBe('300');
      expect(node.getAttribute('cy')).toBe('300');
      expect(node.getAttribute('fill')).toBe('none');
      expect(node.parentElement?.getAttribute('aria-hidden')).toBe('true');
      expect(node.parentElement?.getAttribute('style')).toMatch(/pointer-events:\s*none/);
    }
  });
  it('keeps failed, empty and zero-match states distinct with no fake points', async () => {
    const failed = await rendered(initModel({ _tag: 'Failure', reason: 'Broken fixture' }));
    expect(failed.textContent).toContain('Broken fixture');
    expect(failed.querySelector('svg')).toBeNull();
    const empty = await rendered(
      initModel({ _tag: 'Ready', dataset: { authoredOn: '2026-10-14', entries: [] } }),
    );
    expect(empty.textContent).toContain('No technologies in this demo dataset');
    const zero: Model = { ...initial(), enabledRings: [] };
    const filtered = await rendered(zero);
    expect(filtered.textContent).toContain('No matching technologies');
    expect(filtered.querySelectorAll('[data-shell]')).toHaveLength(4);
    for (const root of [failed, empty, filtered])
      expect(root.querySelectorAll('[data-blip-id]')).toHaveLength(0);
  });
});
