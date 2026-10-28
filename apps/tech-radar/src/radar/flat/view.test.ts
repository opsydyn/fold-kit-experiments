import { Scene } from 'foldkit';
import { describe, expect, it } from 'vitest';

import { renderChart } from '../../test/render-chart.test-helper';
import { demoNotice, loadDemoRadar } from '../three/data';
import { Message } from './message';
import { initModel, type Model } from './model';
import { RadarPointerMount } from './mount';
import { update } from './update';
import { view } from './view';

const initial = () => initModel(loadDemoRadar());
async function rendered(model = initial()) {
  const root = document.createElement('div');
  root.innerHTML = await renderChart<Message>((h) => view(model, h).body);
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
    ] as const) {
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
    Scene.scene(
      { view, update },
      Scene.given(initial()),
      Scene.Mount.resolveAll([RadarPointerMount, Message.CompletedRadarPointerMount()]),
      Scene.type(Scene.role('searchbox', { name: 'Search technologies' }), 'Algebraic data types'),
      Scene.expect(Scene.text('1 matching technology')).toExist(),
      Scene.click(Scene.role('button', { name: 'Inspect Algebraic data types' })),
      Scene.expect(Scene.role('region', { name: 'Selected technology' })).toContainText('Adopt'),
      Scene.click(Scene.role('checkbox', { name: 'Adopt (1)' })),
      Scene.expect(Scene.text('No matching technologies')).toExist(),
      Scene.expect(Scene.text('Selection cleared by filters')).toExist(),
      Scene.click(Scene.role('button', { name: 'Clear filters' })),
      Scene.change(Scene.role('combobox', { name: 'Category' }), 'tools'),
      Scene.expect(Scene.text('8 matching technologies')).toExist(),
      Scene.click(Scene.role('button', { name: 'Zoom in' })),
      Scene.expect(Scene.text('1.25x')).toExist(),
      Scene.click(Scene.role('button', { name: 'Reset view' })),
      Scene.expect(Scene.text('1.00x')).toExist(),
      Scene.expect(Scene.text('8 matching technologies')).toExist(),
    );
  });
  it('acknowledges root keys but ignores unhandled keys', () => {
    Scene.scene(
      { view, update },
      Scene.given(initial()),
      Scene.Mount.resolveAll([RadarPointerMount, Message.CompletedRadarPointerMount()]),
      Scene.keydown(Scene.role('group', { name: 'Functional and AI radar' }), 'ArrowRight'),
      Scene.expectHandled(),
      Scene.expect(Scene.role('group', { name: 'Functional and AI radar' })).toHaveAttr(
        'data-longitude',
        '15',
      ),
      Scene.keydown(Scene.role('group', { name: 'Functional and AI radar' }), 'x'),
      Scene.expectIgnored(),
    );
  });
  it.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }])(
    'leaves browser modifier shortcuts untouched: %j',
    (modifiers) => {
      Scene.scene(
        { view, update },
        Scene.given(initial()),
        Scene.Mount.resolveAll([RadarPointerMount, Message.CompletedRadarPointerMount()]),
        Scene.keydown(Scene.role('group', { name: 'Functional and AI radar' }), '+', modifiers),
        Scene.expectIgnored(),
        Scene.expect(Scene.text('1.00x')).toExist(),
        Scene.keydown(
          Scene.role('group', { name: 'Functional and AI radar' }),
          'ArrowLeft',
          modifiers,
        ),
        Scene.expectIgnored(),
        Scene.expect(Scene.role('group', { name: 'Functional and AI radar' })).toHaveAttr(
          'data-longitude',
          '0',
        ),
        Scene.keydown(Scene.role('group', { name: 'Functional and AI radar' }), '+', {
          shiftKey: true,
        }),
        Scene.expectHandled(),
        Scene.expect(Scene.text('1.25x')).toExist(),
      );
    },
  );
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
