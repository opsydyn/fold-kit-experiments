/* oxlint-disable linteffect/no-try-catch -- The fixture polls rendered DOM and closes the host scope on failure. */
// Run the native DOM host in an isolated process so the SSR tests retain their own globals.
import assert from 'node:assert/strict';

import { BrowserHost, Html } from '@effect/ui/html';
import { Effect, Exit, Scope } from 'effect';
import { Window } from 'happy-dom';

import { deriveSignalChart } from '../../src/examples/signals/derive.ts';
import { eventPanel } from '../../src/examples/signals/event-view.ts';
import { Message } from '../../src/examples/signals/message.ts';
import { init, Model } from '../../src/examples/signals/model.ts';
import { qualityProps } from '../../src/examples/signals/quality-data.ts';
import { update } from '../../src/examples/signals/update.ts';

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;
globalThis.Element = window.Element;
globalThis.HTMLElement = window.HTMLElement;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
const host = document.createElement('section');
document.body.append(host);
const scope = Scope.makeUnsafe();
const component = Html.component({
  name: 'SignalEventFixture',
  model: Model,
  message: Message,
}).make({
  init: () => update(init(qualityProps).model, Message.ClickedEvent({ key: 'event-gap' })).model,
  update: ($, message) => {
    const result = update($.model, message);
    return $.set(result.model).run(...(result.commands ?? []));
  },
  view: (h, model) => {
    assert.equal(model._tag, 'Ready');
    return h.div.children(
      eventPanel(model, deriveSignalChart(model, 'latency').geometry.layout, h),
    );
  },
});
const root = await Effect.runPromise(
  Scope.provide(BrowserHost.mountEffect(component, {}, host, { head: false }), scope),
);

async function settle(check) {
  for (let count = 0; count < 20; count++) {
    try {
      check();
      return;
    } catch (error) {
      if (count === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

try {
  const original = host.querySelector('.signal-event-announcement');
  const browser = host.querySelector('.signal-event-browser');
  assert(original && browser);
  const text = original.textContent;
  browser.open = true;
  const verify = (expectedText) => {
    assert.equal(host.querySelector('.signal-event-announcement'), original, 'stable live region');
    assert.equal(original.getAttribute('aria-live'), 'polite');
    assert.equal(original.textContent, expectedText);
    assert.equal(host.querySelector('.signal-event-browser'), browser, 'stable disclosure');
    assert.equal(browser.open, true, 'open disclosure retained');
  };
  for (const message of [Message.ClickedZoomIn(), Message.ClickedResetView()]) {
    const before = root.model();
    root.send(message);
    await settle(() => assert(root.model() !== before, 'viewport changed'));
    verify(text);
  }
  root.send(Message.ClickedClearEvent());
  await settle(() => verify('No event selected'));
  root.send(Message.ClickedEvent({ key: 'event-gap' }));
  await settle(() => verify(text));
  if (process.argv.includes('--focus')) {
    for (const open of [true, false]) {
      browser.open = open;
      const clear = [...host.querySelectorAll('.signal-event-selected button')].find(
        (button) => button.textContent === 'Clear event',
      );
      assert(clear, 'selected clear control');
      clear.focus();
      assert(document.activeElement === clear, 'clear control takes focus');
      root.send(Message.ClickedClearEvent());
      await settle(() =>
        assert(document.activeElement === browser.querySelector('summary'), 'clear returns focus'),
      );
      assert.equal(browser.open, open, 'focus does not toggle disclosure');
      assert.equal(original.textContent, 'No event selected');
      root.send(Message.ClickedEvent({ key: 'event-gap' }));
      await settle(() => assert.equal(original.textContent, text));
    }
    console.log('Event clear focus recovered');
  } else {
    console.log('Event DOM identity preserved');
  }
} finally {
  await Effect.runPromise(Scope.close(scope, Exit.void));
  await window.happyDOM.close();
}

// The native HTML scheduler keeps a process-level handle alive after the fixture closes.
process.exit(0);
