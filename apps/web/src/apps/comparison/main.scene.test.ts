import { Option, Schema } from 'effect';
import { Runtime } from 'foldkit';
import { assert, expect, it, onTestFinished, vi } from 'vitest';

import { FocusComparisonTarget } from './command';
import { Message } from './message';
import { init } from './model';
import type { Model } from './model';
import { update } from './update';
import { view } from './view';

function required<T>(value: T | null | undefined): T {
  assert(value !== null && value !== undefined);
  return value;
}

function holdRenderFrames() {
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id);
  });
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  return () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(performance.now());
  };
}

type Observation = {
  element: Element | null;
  disconnect: () => void;
  notify: (width: number) => void;
};

function observeWidths() {
  const observations: Observation[] = [];
  class Observer implements ResizeObserver {
    entry: Observation;
    constructor(callback: ResizeObserverCallback) {
      this.entry = {
        element: null,
        disconnect: vi.fn(),
        notify: (width) =>
          callback(
            [
              {
                target: required(this.entry.element),
                contentRect: new DOMRect(0, 0, width, 260),
                borderBoxSize: [],
                contentBoxSize: [],
                devicePixelContentBoxSize: [],
              },
            ],
            this,
          ),
      };
      observations.push(this.entry);
    }
    observe(element: Element) {
      this.entry.element = element;
    }
    disconnect() {
      this.entry.disconnect();
    }
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  onTestFinished(() => {
    vi.unstubAllGlobals();
  });
  return observations;
}

async function scene(initial: Model = init().model, missingTarget = false) {
  const host = document.createElement('div');
  const container = document.createElement('div');
  container.id = 'comparison-scene';
  host.append(container);
  document.body.append(host);
  let latest = initial;
  const messages: Message[] = [];
  const handle = Runtime.embed(
    Runtime.makeApplication({
      Model: Schema.declare<Model>(
        (value): value is Model =>
          value === initial || (typeof value === 'object' && value !== null && 'panels' in value),
      ),
      init: () => ({ model: initial }),
      update: (model: Model, message: Message) => {
        messages.push(message);
        const result = update(model, message);
        latest = result.model;
        if (missingTarget && message._tag === 'ClickedAddPanel') {
          latest = { ...model, panels: model.panels.filter(({ id }) => id !== 2) };
          return {
            model: latest,
            commands: [FocusComparisonTarget({ selector: '#comparison-panel-2' })],
          };
        }
        return result;
      },
      view,
      container,
      devTools: false,
    }),
  );
  onTestFinished(() => {
    handle.dispose();
    host.remove();
  });
  await vi.waitFor(() => expect(host.querySelector('#comparison-add-scatter')).not.toBeNull());
  const button = (name: string) => {
    const target = host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    expect(target).not.toBeNull();
    return required(target);
  };
  return { host, handle, button, messages, model: () => latest };
}

it('focuses additions and next, previous, then add after removals', async () => {
  const { host, button } = await scene();
  required(host.querySelector<HTMLButtonElement>('#comparison-add-scatter')).click();
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('comparison-panel-3'));
  button('Remove Histogram 2').click();
  await vi.waitFor(() => {
    expect(host.querySelector('#comparison-panel-2')).toBeNull();
    expect(document.activeElement?.id).toBe('comparison-panel-3');
  });
  button('Remove Scatter 3').click();
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('comparison-panel-1'));
  button('Remove Scatter 1').click();
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('comparison-add-scatter'));
});

it('keeps keyed nodes, local inspection and focused move control when reordered', async () => {
  const { host, button, model } = await scene();
  const target = button('Move Scatter 1 later');
  const heading = host.querySelector('#comparison-panel-1');
  const chart = required(host.querySelector<SVGElement>('svg'));
  chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await vi.waitFor(() => expect(host.textContent).toContain('1yr (1, 55000)'));
  target.focus();
  target.click();
  await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
  expect(model().panels.map(({ id }) => id)).toEqual([2, 1]);
  expect(host.querySelector('#comparison-panel-1')).toBe(heading);
  expect(button('Move Scatter 1 later')).toBe(target);
  expect(document.activeElement).toBe(target);
  expect(target.disabled).toBe(false);
  expect(target.getAttribute('aria-disabled')).toBe('true');
  expect(host.textContent).toContain('1yr (1, 55000)');
});

it('routes actual histogram keys and pointer hover to equivalent interval facts', async () => {
  const initial = init().model;
  const fixtures: Model = {
    ...initial,
    panels: initial.panels.map((panel) =>
      panel._tag === 'Histogram'
        ? {
            ...panel,
            chart: {
              ...panel.chart,
              bins: [
                { x0: 10, x1: 20, count: 1 },
                { x0: 20, x1: 30, count: 2 },
              ],
            },
          }
        : panel,
    ),
  };
  const { host, model } = await scene(fixtures);
  const chart = required(host.querySelectorAll('svg')[1]);
  chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true }));
  expect(model().panels[1]).toEqual(fixtures.panels[1]);
  chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({
      inspection: { value: { value: { lower: 10, upper: 20, includeEnd: false } } },
    }),
  );
  chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({
      inspection: { value: { value: { lower: 20, upper: 30, includeEnd: true } } },
    }),
  );
  const keyboard = model().linking;
  const bars = chart.querySelectorAll('g[style="cursor: default;"]');
  required(bars[0]).dispatchEvent(new MouseEvent('mouseenter'));
  await vi.waitFor(() => expect(model().linking).not.toEqual(keyboard));
  required(bars[1]).dispatchEvent(new MouseEvent('mouseenter'));
  await vi.waitFor(() => expect(model().linking).toEqual(keyboard));
});

it('disposes chart Mount observers and pointer listeners when removed and on host disposal', async () => {
  const observers = observeWidths();
  const { host, button, handle } = await scene();
  await vi.waitFor(() => expect(observers).toHaveLength(2));
  const overlay = required(host.querySelector('rect[fill="transparent"]'));
  const removed = vi.spyOn(overlay, 'removeEventListener');
  button('Remove Scatter 1').click();
  await vi.waitFor(() => expect(required(observers[0]).disconnect).toHaveBeenCalledTimes(1));
  expect(removed.mock.calls.some(([name]) => name === 'pointermove')).toBe(true);
  handle.dispose();
  await vi.waitFor(() => expect(required(observers[1]).disconnect).toHaveBeenCalledTimes(1));
});

it('a focus target removed before commit completes harmlessly without stealing focus', async () => {
  const { host, messages } = await scene(init().model, true);
  const add = required(host.querySelector<HTMLButtonElement>('#comparison-add-scatter'));
  expect(host.querySelector('#comparison-panel-2')).not.toBeNull();
  add.focus();
  add.click();
  await vi.waitFor(() =>
    expect(messages.some(({ _tag }) => _tag === 'CompletedFocusComparisonTarget')).toBe(true),
  );
  expect(document.activeElement).toBe(add);
  expect(host.querySelectorAll('h2')).toHaveLength(1);
  expect(host.textContent).not.toContain('crashed');
});

it('uses fresh plot geometry after reorder and nested scroll, independent of browser chrome', async () => {
  const observations = observeWidths();
  const { host, button, model } = await scene();
  await vi.waitFor(() => expect(observations).toHaveLength(2));
  const overlay = required(host.querySelector('rect[fill="transparent"]'));
  let rect = new DOMRect(396, 69, 308, 184);
  vi.spyOn(overlay, 'getBoundingClientRect').mockImplementation(() => rect);
  const pointer = () =>
    overlay.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX: 410,
        clientY: 200,
        screenX: 1900,
        screenY: 1200,
      }),
    );
  pointer();
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({
      inspection: { value: { value: { key: 'salary-1' } } },
    }),
  );
  button('Move Scatter 1 later').click();
  await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
  rect = new DOMRect(130, 183, 308, 184);
  host.scrollTop = 300;
  host.dispatchEvent(new Event('scroll'));
  pointer();
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({
      inspection: { value: { value: { key: 'salary-30' } } },
    }),
  );
  const active = model().panels[1];
  assert(active?._tag === 'Scatter');
  expect(active.chart.activeIndex).toEqual(Option.some(29));
  required(observations[0]).notify(0);
  required(observations[0]).notify(300);
  await vi.waitFor(() => expect(model().panels[1]?.chart.layout.dims.width).toBe(300));
  expect(model().panels[1]).toMatchObject({ chart: { activeIndex: Option.some(29) } });
  required(observations[1]).notify(300);
  await vi.waitFor(() => expect(model().panels[0]?.chart.layout.dims.width).toBe(300));
  expect(observations).toHaveLength(2);
});

it('native linking changes retain local inspection and clear only the derived overlay', async () => {
  const { host, model } = await scene();
  required(host.querySelector('svg')).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
  );
  await vi.waitFor(() =>
    expect(host.querySelectorAll('circle[data-linked-highlight]')).toHaveLength(1),
  );
  const checkbox = required(host.querySelector<HTMLInputElement>('input[type="checkbox"]'));
  checkbox.click();
  await vi.waitFor(() =>
    expect(host.querySelectorAll('circle[data-linked-highlight]')).toHaveLength(0),
  );
  expect(model().linking._tag).toBe('Independent');
  expect(checkbox.checked).toBe(false);
  expect(host.querySelectorAll('circle[data-linked-highlight]')).toHaveLength(0);
  expect(host.textContent).toContain('1yr (1, 55000)');
  checkbox.click();
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({ _tag: 'Linked', inspection: Option.none() }),
  );
  expect(checkbox.checked).toBe(true);
});

it('schedules reorder focus protection only for valid moves, with data-only arguments', () => {
  const model = init().model;
  const valid = update(model, Message.ClickedMovePanel({ id: 1, direction: 'later' }));
  expect(valid.commands).toHaveLength(1);
  expect(valid.commands?.[0]).toMatchObject({
    name: 'RestoreComparisonFocus',
    args: { panelId: 1 },
  });
  for (const message of [
    Message.ClickedMovePanel({ id: 1, direction: 'earlier' }),
    Message.ClickedMovePanel({ id: 2, direction: 'later' }),
    Message.ClickedMovePanel({ id: 99, direction: 'later' }),
  ])
    expect(update(model, message)).toEqual({ model });
});

it('does not steal focus when an unfocused panel is moved programmatically', async () => {
  const { host, button, messages } = await scene();
  const add = required(host.querySelector<HTMLButtonElement>('#comparison-add-scatter'));
  add.focus();
  button('Move Scatter 1 later').click();
  await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
  await vi.waitFor(() =>
    expect(messages.some(({ _tag }) => _tag === 'CompletedRestoreComparisonFocus')).toBe(true),
  );
  expect(document.activeElement).toBe(add);
});

it.each([false, true])(
  'does not reclaim focus after another target takes it (then blurs: %s)',
  async (blurAfterFocus) => {
    const { host, button, messages } = await scene();
    const commit = holdRenderFrames();
    const listeners = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    const target = button('Move Scatter 1 later');
    target.focus();
    target.click();
    await vi.waitFor(() =>
      expect(listeners.mock.calls.some(([type]) => type === 'focusin')).toBe(true),
    );
    const other = required(host.querySelector<HTMLButtonElement>('#comparison-add-histogram'));
    other.focus();
    if (blurAfterFocus) other.blur();
    const focusBeforeCommit = document.activeElement;
    commit();
    await vi.waitFor(() =>
      expect(messages.some(({ _tag }) => _tag === 'CompletedRestoreComparisonFocus')).toBe(true),
    );
    expect(button('Move Scatter 1 later')).toBe(target);
    expect(document.activeElement).toBe(focusBeforeCommit);
    const registration = required(listeners.mock.calls.find(([type]) => type === 'focusin'));
    expect(removed).toHaveBeenCalledWith('focusin', registration[1], registration[2]);
  },
);

it('does not refocus a keyed control removed before the reorder commits', async () => {
  const { host, button, messages, model } = await scene();
  const commit = holdRenderFrames();
  const listeners = vi.spyOn(document, 'addEventListener');
  const target = button('Move Scatter 1 later');
  target.focus();
  target.click();
  await vi.waitFor(() =>
    expect(listeners.mock.calls.some(([type]) => type === 'focusin')).toBe(true),
  );
  const focusedAgain = vi.spyOn(target, 'focus');
  button('Remove Scatter 1').click();
  await vi.waitFor(() => expect(model().panels.map(({ id }) => id)).toEqual([2]));
  commit();
  await vi.waitFor(() =>
    expect(messages.some(({ _tag }) => _tag === 'CompletedRestoreComparisonFocus')).toBe(true),
  );
  await vi.waitFor(() => {
    // A separately queued remove-focus Command may start after the first held frame.
    commit();
    expect(messages.some(({ _tag }) => _tag === 'CompletedFocusComparisonTarget')).toBe(true);
  });
  expect(document.activeElement?.id).toBe('comparison-panel-2');
  expect(target.isConnected).toBe(false);
  expect(focusedAgain).not.toHaveBeenCalled();
  expect(host.querySelector('#comparison-panel-1')).toBeNull();
});
