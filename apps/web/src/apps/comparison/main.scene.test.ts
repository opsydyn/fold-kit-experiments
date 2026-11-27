import { BrowserHost, Html, HtmlCommand } from '@effect/ui/html';
import { Effect, Exit, Option, Scope } from 'effect';
import { assert, expect, it, onTestFinished, vi } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel/core';
import { linkedDots } from '../../ui/plot-panel/highlights.test-helper';
import { histogramSpec } from './data';
import { headingRef, workbenchCommands } from './workbench-focus';
import { init, Message, Model, update } from './workbench-state';
import { workbenchView } from './workbench-view';

function required<T>(value: T | null | undefined): T {
  assert(value !== null && value !== undefined);
  return value;
}

/** The panel elements, which take pointer and key input, in page order. */
const panelsIn = (host: ParentNode): ReadonlyArray<HTMLElement> => [
  ...host.querySelectorAll<HTMLElement>('.plot-panel'),
];

/**
 * Pins a panel's drawing to a box, so client positions map to plot pixels
 * through it: at the drawing's own size and origin, they are plot pixels.
 */
function placeDrawing(panel: Element, box: () => DOMRect) {
  const drawing = required(panel.querySelector('svg'));
  vi.spyOn(drawing, 'getBoundingClientRect').mockImplementation(box);
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
}

/** The client position of a scatter point, for a drawing pinned at `box`. */
function pointerOver(chart: PlotPanel.Model, key: string, box: DOMRect) {
  const target = required(PlotPanel.targetsOf(chart).find((t) => t.key === key));
  const scale = box.width / chart.spec.width;
  return { clientX: box.left + target.cx * scale, clientY: box.top + target.cy * scale };
}

const liveText = (panel: Element) => panel.querySelector('[aria-live="polite"]')?.textContent;

// Each scene owns a real renderer scope and exposes its host and observed messages.
// oxlint-disable-next-line linteffect/no-effect-wrapper-alias
async function scene(
  initial: Model = init(),
  options: {
    readonly missingTarget?: boolean;
    readonly beforeMoveCommit?: () => void;
    readonly removeDuringMove?: boolean;
  } = {},
) {
  const host = document.createElement('div');
  document.body.append(host);
  const scope = Scope.makeUnsafe();
  const dispose = () => {
    const close = Scope.close(scope, Exit.void);
    return Effect.runPromise(close);
  };
  onTestFinished(async () => {
    await dispose();
    host.remove();
  });
  let latest = initial;
  const messages: Message[] = [];
  const Scene = Html.component({
    name: 'ComparisonScene',
    model: Model,
    message: Message,
  }).make({
    init: () => initial,
    update: ($, message) => {
      messages.push(message);
      if (options.missingTarget && message._tag === 'ClickedAddPanel') {
        latest = { ...$.model, panels: $.model.panels.filter(({ id }) => id !== 2) };
        return $.set(latest).run(
          HtmlCommand.focus(headingRef(2), () => Message.ChangedLinkInspections({ enabled: true })),
        );
      }

      const result = update($.model, message);
      if (message._tag === 'ObservedPanelMove') {
        options.beforeMoveCommit?.();
        if (options.removeDuringMove) {
          const removed = update(result.model, Message.ClickedRemovePanel({ id: message.id }));
          latest = removed.model;
          return $.set(latest).run(...workbenchCommands(removed));
        }
      }
      latest = result.model;
      return $.set(latest).run(...workbenchCommands(result));
    },
    view: (h, model) => workbenchView(h, model, (message) => message),
  });
  await Effect.runPromise(
    Scope.provide(BrowserHost.mountEffect(Scene, {}, host, { head: false }), scope),
  );
  await vi.waitFor(() =>
    expect(
      messages.filter(
        (message) =>
          message._tag === 'ReceivedPanelMessage' &&
          message.message._tag === 'CompletedForwardPointer',
      ),
    ).toHaveLength(initial.panels.length),
  );
  const button = (name: string) =>
    required(host.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`));
  return { host, dispose, button, messages, model: () => latest };
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
  const chart = required(panelsIn(host)[0]);
  chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await vi.waitFor(() => expect(liveText(chart)).toBe('1yr'));
  target.focus();
  target.click();
  await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
  expect(model().panels.map(({ id }) => id)).toEqual([2, 1]);
  expect(host.querySelector('#comparison-panel-1')).toBe(heading);
  expect(button('Move Scatter 1 later')).toBe(target);
  await vi.waitFor(() => expect(document.activeElement).toBe(target));
  expect(target.disabled).toBe(false);
  expect(target.getAttribute('aria-disabled')).toBe('true');
  expect(liveText(chart)).toBe('1yr');
});

it('routes actual histogram keys and pointer hover to equivalent interval facts', async () => {
  const initial = init();
  // Two bins, [10, 20) and [20, 30], so the facts are easy to read.
  const twoBins = PlotPanel.init({
    spec: {
      ...histogramSpec,
      data: [{ y: 10 }, { y: 15 }, { y: 25 }, { y: 30 }],
      marks: [{ mark: 'rect', x: 'y', inset: 1, transform: { type: 'bin', thresholds: [20] } }],
    },
  }).model;
  const fixtures: Model = {
    ...initial,
    panels: initial.panels.map((panel) =>
      panel._tag === 'Histogram' ? { ...panel, chart: twoBins } : panel,
    ),
  };
  const { host, model } = await scene(fixtures);
  const chart = required(panelsIn(host)[1]);
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
  const box = new DOMRect(0, 0, twoBins.spec.width, twoBins.spec.height);
  placeDrawing(chart, () => box);
  const [first, second] = PlotPanel.targetsOf(twoBins);
  const hover = (x: number) =>
    chart.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: 100 }));
  hover(first?.cx ?? 0);
  await vi.waitFor(() => expect(model().linking).not.toEqual(keyboard));
  hover(second?.cx ?? 0);
  await vi.waitFor(() => expect(model().linking).toEqual(keyboard));
});

it.each(['leave', 'histogram pointer', 'scatter key', 'histogram key'] as const)(
  'preserves same-task scatter movement order before %s',
  async (nextInput) => {
    const listeners = vi.spyOn(Element.prototype, 'addEventListener');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    const { host, model, messages } = await scene();
    await vi.waitFor(() =>
      expect(listeners.mock.calls.some(([type]) => type === 'pointermove')).toBe(true),
    );
    const [scatter, histogram] = panelsIn(host);
    assert(scatter !== undefined && histogram !== undefined);
    const box = new DOMRect(0, 0, 380, 260);
    placeDrawing(scatter, () => box);
    const firstPoint = model().panels[0];
    assert(firstPoint?._tag === 'Scatter');
    const at = pointerOver(firstPoint.chart, 'salary-1', box);
    messages.length = 0;
    // No yield between user facts: a queued movement must not overtake later input.
    scatter.dispatchEvent(new PointerEvent('pointermove', at));
    if (nextInput === 'leave' || nextInput === 'histogram pointer')
      scatter.dispatchEvent(new PointerEvent('pointerleave'));
    if (nextInput === 'histogram pointer') {
      const bins = new DOMRect(0, 0, 360, 260);
      placeDrawing(histogram, () => bins);
      const histogramPanel = model().panels[1];
      assert(histogramPanel?._tag === 'Histogram');
      const [bin] = PlotPanel.targetsOf(histogramPanel.chart);
      histogram.dispatchEvent(
        new PointerEvent('pointermove', { clientX: bin?.cx ?? 0, clientY: 100 }),
      );
    }
    if (nextInput === 'scatter key' || nextInput === 'histogram key')
      (nextInput === 'scatter key' ? scatter : histogram).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    const inputFacts = () =>
      messages.flatMap((message) => {
        if (message._tag !== 'ReceivedPanelMessage') return [];
        const child = message.message;
        return ['MovedPointer', 'LeftPlot', 'PressedKeyNav'].includes(child._tag)
          ? [`${message.id}:${child._tag}`]
          : [];
      });
    const expected =
      nextInput === 'histogram pointer'
        ? ['1:MovedPointer', '1:LeftPlot', '2:MovedPointer']
        : [
            '1:MovedPointer',
            nextInput === 'leave'
              ? '1:LeftPlot'
              : nextInput === 'scatter key'
                ? '1:PressedKeyNav'
                : '2:PressedKeyNav',
          ];
    await vi.waitFor(() => expect(inputFacts()).toHaveLength(expected.length));
    expect(inputFacts()).toEqual(expected);
    if (nextInput === 'leave') {
      expect(model().panels[0]).toMatchObject({ chart: { active: Option.none() } });
      expect(model().linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
    } else if (nextInput === 'scatter key') {
      expect(model().panels[0]).toMatchObject({ chart: { active: Option.some(1) } });
      expect(model().linking).toMatchObject({
        inspection: { value: { sourceId: 1, value: { key: 'salary-2' } } },
      });
    } else {
      expect(model().linking).toMatchObject({ inspection: { value: { sourceId: 2 } } });
      if (nextInput === 'histogram pointer')
        expect(model().panels[0]).toMatchObject({ chart: { active: Option.none() } });
    }
  },
);

it('clears scatter inspection when movement and leave occur in separate tasks', async () => {
  const { host, model } = await scene();
  const scatter = required(panelsIn(host)[0]);
  const box = new DOMRect(0, 0, 380, 260);
  placeDrawing(scatter, () => box);
  const panel = model().panels[0];
  assert(panel?._tag === 'Scatter');
  scatter.dispatchEvent(new PointerEvent('pointermove', pointerOver(panel.chart, 'salary-1', box)));
  await vi.waitFor(() =>
    expect(model().panels[0]).toMatchObject({ chart: { active: Option.some(0) } }),
  );
  scatter.dispatchEvent(new PointerEvent('pointerleave'));
  await vi.waitFor(() => {
    expect(model().panels[0]).toMatchObject({ chart: { active: Option.none() } });
    expect(model().linking).toEqual({ _tag: 'Linked', inspection: Option.none() });
  });
});

it('removes a panel’s pointer listeners when it is removed and on host disposal', async () => {
  const { host, button, dispose } = await scene();
  const [scatter, histogram] = panelsIn(host);
  assert(scatter !== undefined && histogram !== undefined);
  const removedFromScatter = vi.spyOn(scatter, 'removeEventListener');
  const removedFromHistogram = vi.spyOn(histogram, 'removeEventListener');
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  button('Remove Scatter 1').click();
  await vi.waitFor(() =>
    expect(removedFromScatter.mock.calls.some(([name]) => name === 'pointermove')).toBe(true),
  );
  expect(removedFromHistogram.mock.calls.some(([name]) => name === 'pointermove')).toBe(false);
  await dispose();
  await vi.waitFor(() =>
    expect(removedFromHistogram.mock.calls.some(([name]) => name === 'pointermove')).toBe(true),
  );
});

it('a focus target removed before commit completes harmlessly without stealing focus', async () => {
  const { host, messages } = await scene(init(), { missingTarget: true });
  const add = required(host.querySelector<HTMLButtonElement>('#comparison-add-scatter'));
  expect(host.querySelector('#comparison-panel-2')).not.toBeNull();
  add.focus();
  add.click();
  await vi.waitFor(() =>
    expect(messages.some(({ _tag }) => _tag === 'ChangedLinkInspections')).toBe(true),
  );
  expect(document.activeElement).toBe(add);
  expect(host.querySelectorAll('h2')).toHaveLength(1);
  expect(host.textContent).not.toContain('crashed');
});

it('uses fresh plot geometry after reorder, nested scroll and resizing', async () => {
  const { host, button, model } = await scene();
  const scatter = required(panelsIn(host)[0]);
  let box = new DOMRect(396, 69, 380, 260);
  placeDrawing(scatter, () => box);
  const chart = () => {
    const panel = model().panels.find(({ id }) => id === 1);
    assert(panel?._tag === 'Scatter');
    return panel.chart;
  };
  scatter.dispatchEvent(new PointerEvent('pointermove', pointerOver(chart(), 'salary-1', box)));
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({
      inspection: { value: { value: { key: 'salary-1' } } },
    }),
  );
  button('Move Scatter 1 later').click();
  await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
  // Moved, scrolled and drawn at a smaller size: positions follow the drawing's box.
  box = new DOMRect(130, 183, 300, 205);
  host.scrollTop = 300;
  host.dispatchEvent(new Event('scroll'));
  scatter.dispatchEvent(new PointerEvent('pointermove', pointerOver(chart(), 'salary-30', box)));
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({
      inspection: { value: { value: { key: 'salary-30' } } },
    }),
  );
  expect(chart().active).toEqual(Option.some(29));
});

it('native linking changes retain local inspection and clear only the derived overlay', async () => {
  const { host, model } = await scene();
  const scatter = required(panelsIn(host)[0]);
  scatter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await vi.waitFor(() => expect(linkedDots(host)).toHaveLength(1));
  const checkbox = required(host.querySelector<HTMLInputElement>('input[type="checkbox"]'));
  checkbox.click();
  await vi.waitFor(() => expect(linkedDots(host)).toHaveLength(0));
  expect(model().linking._tag).toBe('Independent');
  expect(checkbox.checked).toBe(false);
  expect(linkedDots(host)).toHaveLength(0);
  expect(liveText(scatter)).toBe('1yr');
  checkbox.click();
  await vi.waitFor(() =>
    expect(model().linking).toMatchObject({ _tag: 'Linked', inspection: Option.none() }),
  );
  expect(checkbox.checked).toBe(true);
});

it('captures focus only for a valid move and keeps the command arguments serializable', () => {
  const model = init();
  const valid = update(model, Message.ClickedMovePanel({ id: 1, direction: 'later' }));
  expect(valid.model).toBe(model);
  expect(workbenchCommands(valid)).toHaveLength(1);
  expect(workbenchCommands(valid)[0]).toMatchObject({
    name: 'MoveComparisonPanel',
    args: { id: 1, direction: 'later' },
  });
  for (const facts of [
    { id: 1, direction: 'earlier' },
    { id: 2, direction: 'later' },
    { id: 99, direction: 'later' },
  ] as const) {
    expect(update(model, Message.ClickedMovePanel(facts))).toEqual({ model });
    expect(update(model, Message.ObservedPanelMove(facts))).toEqual({ model });
  }
});

it('does not steal focus when an unfocused panel is moved programmatically', async () => {
  const { host, button } = await scene();
  const add = required(host.querySelector<HTMLButtonElement>('#comparison-add-scatter'));
  add.focus();
  button('Move Scatter 1 later').click();
  await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
  expect(document.activeElement).toBe(add);
});

it.each([false, true])(
  'does not reclaim focus after another target takes it (then blurs: %s)',
  async (blurAfterFocus) => {
    const { host, button } = await scene(init(), {
      beforeMoveCommit: () => {
        const other = required(host.querySelector<HTMLButtonElement>('#comparison-add-histogram'));
        other.focus();
        if (blurAfterFocus) other.blur();
      },
    });
    const listeners = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    onTestFinished(() => {
      vi.restoreAllMocks();
    });
    const target = button('Move Scatter 1 later');
    target.focus();
    target.click();
    await vi.waitFor(() => expect(host.querySelector('h2')?.id).toBe('comparison-panel-2'));
    const registration = required(listeners.mock.calls.find(([type]) => type === 'focusin'));
    await vi.waitFor(() =>
      expect(removed).toHaveBeenCalledWith('focusin', registration[1], registration[2]),
    );
    expect(button('Move Scatter 1 later')).toBe(target);
    expect(document.activeElement).toBe(
      blurAfterFocus ? document.body : host.querySelector('#comparison-add-histogram'),
    );
  },
);

it('does not refocus a keyed control removed during the reorder commit', async () => {
  const { host, button, model } = await scene(init(), { removeDuringMove: true });
  const target = button('Move Scatter 1 later');
  target.focus();
  const focusedAgain = vi.spyOn(target, 'focus');
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  target.click();
  await vi.waitFor(() => expect(document.activeElement?.id).toBe('comparison-panel-2'));
  expect(model().panels.map(({ id }) => id)).toEqual([2]);
  expect(target.isConnected).toBe(false);
  expect(focusedAgain).not.toHaveBeenCalled();
  expect(host.querySelector('#comparison-panel-1')).toBeNull();
});
