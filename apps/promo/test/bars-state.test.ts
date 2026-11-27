import { expect, it } from 'bun:test';

import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';

import { barData } from '../src/examples/bars/data';
import { Bars } from '../src/examples/bars/main';
import { Message } from '../src/examples/bars/message';
import { init } from '../src/examples/bars/model';
import { update } from '../src/examples/bars/update';

it('bar controls and reset retain caller data, measured width and stable inspection identity', () => {
  const initial = init({ data: barData });
  const resized = update(initial, Message.RecordedWidth({ width: 320 }));
  const stacked = update(resized, Message.SelectedMode({ mode: 'stacked' }));
  const horizontal = update(stacked, Message.SelectedOrientation({ orientation: 'horizontal' }));
  const painted = update(horizontal, Message.SelectedPaint({ paint: 'hatch' }));
  const inspected = update(painted, Message.InspectedBar({ key: 'Jan-Core' }));
  expect(inspected).toMatchObject({
    mode: 'stacked',
    orientation: 'horizontal',
    paint: 'hatch',
    width: 320,
    activeKey: 'Jan-Core',
  });
  expect(inspected.data).toBe(barData);
  const reset = update(inspected, Message.ClickedReset());
  expect(reset).toMatchObject({
    mode: 'grouped',
    orientation: 'vertical',
    paint: 'solid',
    activeKey: null,
    width: 320,
  });
  expect(reset.data).toBe(barData);
  expect(update(reset, Message.RecordedWidth({ width: NaN }))).toBe(reset);
  expect(update(reset, Message.RecordedWidth({ width: 0 }))).toBe(reset);
  expect(update(reset, Message.RecordedWidth({ width: 320 }))).toBe(reset);
  expect(update(reset, Message.InspectedBar({ key: 'missing' }))).toBe(reset);
});

it('renders keyboard-inspectable bars, pressed control state and a complete accessible table', async () => {
  const result = await Effect.runPromise(HtmlServer.renderToHtml(Bars, { data: barData }));
  expect(result.html).toContain('aria-pressed="true">grouped</button>');
  expect(result.html).toContain('<title>Jan, Core: 12</title>');
  expect(result.html.match(/tabindex="0"/g)).toHaveLength(12);
  expect(result.html).toContain('<caption>Illustrative monthly activity</caption>');
  expect(result.html.match(/<tr>/g)).toHaveLength(13);
  expect(result.html).not.toMatch(/NaN|Infinity/);
  expect(result.html).not.toMatch(/<li style="color:/);
  expect(result.html.match(/class="primitive-series-swatch"/g)).toHaveLength(3);
  expect(result.html).toContain('role="group"');
  expect(result.html.match(/role="img"/g)).toHaveLength(12);
});
