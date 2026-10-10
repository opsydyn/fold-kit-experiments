import { expect, it } from 'bun:test';

import { Effect } from 'effect';
import { renderToString } from 'foldkit/experimental/server';

import { barData } from '../src/examples/bars/data';
import { Message } from '../src/examples/bars/message';
import { init, Props } from '../src/examples/bars/model';
import { update } from '../src/examples/bars/update';
import { view } from '../src/examples/bars/view';

it('bar controls and reset retain caller data, measured width and stable inspection identity', () => {
  const initial = init({ data: barData }).model;
  const resized = update(initial, Message.RecordedWidth({ width: 320 })).model;
  const stacked = update(resized, Message.SelectedMode({ mode: 'stacked' })).model;
  const horizontal = update(
    stacked,
    Message.SelectedOrientation({ orientation: 'horizontal' }),
  ).model;
  const painted = update(horizontal, Message.SelectedPaint({ paint: 'hatch' })).model;
  const inspected = update(painted, Message.InspectedBar({ key: 'Jan-Core' })).model;
  expect(inspected).toMatchObject({
    mode: 'stacked',
    orientation: 'horizontal',
    paint: 'hatch',
    width: 320,
    activeKey: 'Jan-Core',
  });
  expect(inspected.data).toBe(barData);
  const reset = update(inspected, Message.ClickedReset()).model;
  expect(reset).toMatchObject({
    mode: 'grouped',
    orientation: 'vertical',
    paint: 'solid',
    activeKey: null,
    width: 320,
  });
  expect(reset.data).toBe(barData);
  expect(update(reset, Message.RecordedWidth({ width: NaN })).model).toBe(reset);
  expect(update(reset, Message.RecordedWidth({ width: 0 })).model).toBe(reset);
  expect(update(reset, Message.InspectedBar({ key: 'missing' })).model).toBe(reset);
});

it('renders keyboard-inspectable bars, pressed control state and a complete accessible table', async () => {
  const model = update(
    init({ data: barData }).model,
    Message.SelectedMode({ mode: 'stacked' }),
  ).model;
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Props,
        init: () => ({ model }),
        view,
      },
      { flags: { data: barData }, isHydratable: false },
    ),
  );
  expect(result.html).toContain('aria-pressed="true"');
  expect(result.html.match(/tabindex="0"/g)).toHaveLength(12);
  expect(result.html).toContain('<caption>Illustrative monthly activity</caption>');
  expect(result.html.match(/<tr>/g)).toHaveLength(13);
  expect(result.html).not.toMatch(/NaN|Infinity/);
  expect(result.html).not.toMatch(/<li style="color:/);
  expect(result.html.match(/class="primitive-series-swatch"/g)).toHaveLength(3);
  expect(result.html).toContain('role="group"');
  expect(result.html.match(/role="img"/g)).toHaveLength(12);
});
