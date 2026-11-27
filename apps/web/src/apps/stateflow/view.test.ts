import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { mountStateflow } from './host.test-helper';
import { Stateflow } from './main';
import { Message } from './message';

function element<T extends Element = HTMLElement>(host: HTMLElement, selector: string) {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error('Missing expected test element ' + selector);
  return found;
}

const button = (host: HTMLElement, name: string) =>
  element<HTMLButtonElement>(host, `button[aria-label="${name}"]`);
const status = (host: HTMLElement, text: string) =>
  vi.waitFor(() => expect(host.textContent).toContain(text));

describe('Stateflow Observatory view', () => {
  it('renders the accessible graph, replay controls, and table before hydration', async () => {
    const { html } = await Effect.runPromise(HtmlServer.renderToHtml(Stateflow, { session: null }));
    const host = document.createElement('div');
    host.innerHTML = html;
    const graph = element(host, 'svg[role="application"]');
    expect(graph.getAttribute('aria-label')).toBe('Request diagnostics state graph');
    expect(graph.querySelector('title')?.textContent).toBe('Request diagnostics state graph');
    expect(graph.textContent).toContain('CompletedCancelFetchMetrics');
    expect(graph.hasAttribute('tabindex')).toBe(false);
    expect(element(host, '[aria-label="Select state Loading"]').getAttribute('tabindex')).toBe('0');
    expect(host.textContent).toContain('Current state: Loading');
    expect(host.textContent).toContain('Playback: paused');
    expect(host.textContent).toContain('Event 0 of 8');
    for (const name of ['Reset', 'Step back', 'Play', 'Step', 'To the end'])
      expect(button(host, name)).toBeDefined();
    expect(element(host, 'input[aria-label="Replay position"]')).toBeDefined();
    expect(element(host, 'select[aria-label="Machine"]')).toBeDefined();
    expect([...host.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual([
      'Sequence',
      'Event',
      'From',
      'Outcome',
      'Target',
      'Reason',
      'Commands',
    ]);
  });

  it('steps, steps back, plays, pauses, and resets through the runtime', async () => {
    const { host } = await mountStateflow();
    button(host, 'Play').click();
    await status(host, 'Playback: playing');
    button(host, 'Pause').click();
    await status(host, 'Playback: paused');
    button(host, 'Step').click();
    await status(host, 'Current state: Ready');
    await status(host, 'Outbound Port: emitted #1');
    button(host, 'Step back').click();
    await status(host, 'Current state: Loading');
    button(host, 'To the end').click();
    await status(host, 'Current state: Idle');
    button(host, 'Reset').click();
    await status(host, 'Current state: Loading');
    await status(host, 'Transitions: 0');
  });

  it('replays to a swimlane event and inspects historical events without moving the scrubber', async () => {
    const { host } = await mountStateflow();
    const row = element(host, 'g[aria-label^="Replay to event 5: ClickedReload"]');
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await status(host, 'Current state: Cancelling');
    await status(host, 'Event 5 of 8');
    expect(element(host, '[aria-label="Selected trace inspector"]').textContent).toContain(
      '#5 ClickedReload',
    );
    button(host, 'To the end').click();
    await status(host, 'Current state: Idle');
    button(host, 'Inspect event 5: ClickedReload').click();
    await status(host, 'Ready → Cancelling');
    expect(host.textContent).toContain('Current state: Idle');
    element(host, 'g[aria-label="Select state Ready"]').dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ' }),
    );
    await vi.waitFor(() => expect(host.querySelectorAll('[data-related="true"]')).toHaveLength(4));
  });

  it('lets keyboard users inspect untaken edges without moving replay', async () => {
    const { host } = await mountStateflow();
    const edge = element(host, 'g[aria-label^="Cancelling → Idle on CompletedCancelFetchMetrics"]');
    edge.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }),
    );
    await status(host, 'Guard: otherwise #1');
    await status(host, 'No recorded event for this transition.');
    expect(host.textContent).toContain('Current state: Loading');
  });

  it('shows ignored checkout events, dead edges, and generated tests', async () => {
    const { host, root } = await mountStateflow();
    const clipboard = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    root.send(Message.ChoseSpecimen({ specimen: 'checkout' }));
    root.send(Message.ScrubbedTo({ cursor: 11 }));
    await status(host, 'Ignored: 1');
    expect(
      element(host, 'g[aria-label="Select state Charging, ignored 1 messages"]'),
    ).toBeDefined();
    await status(host, 'NotApplicable');
    await status(host, 'Unreachable: Refunded');
    await status(host, 'dead: UnreachableSource');
    button(host, 'Copy a test for Charging → Declined on SettledCharge').click();
    await status(host, 'Test copied');
    expect(clipboard).toHaveBeenCalledWith(expect.stringContaining('checkoutExamples.declined'));
  });
});
