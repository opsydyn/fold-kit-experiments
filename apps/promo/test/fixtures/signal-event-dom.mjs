// Isolated process: real Foldkit patching without leaking DOM globals into SSR tests.
import assert from 'node:assert/strict';

import { Context } from 'effect';
import { Window } from 'happy-dom';

import { __htmlBuilder } from '../../node_modules/foldkit/dist/html/index.js';
import { setRuntime, clearRuntime } from '../../node_modules/foldkit/dist/html/runtimeSingleton.js';
import { deriveSignalChart } from '../../src/examples/signals/derive.ts';
import { eventPanel } from '../../src/examples/signals/event-view.ts';
import { Message } from '../../src/examples/signals/message.ts';
import { init } from '../../src/examples/signals/model.ts';
import { qualityProps } from '../../src/examples/signals/quality-data.ts';
import { update } from '../../src/examples/signals/update.ts';

async function verifyEventDom() {
  const window = new Window();
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Element = window.Element;
  const { patch } = await import('../../node_modules/foldkit/dist/vdom.js');
  const h = __htmlBuilder();
  const render = (model) => {
    setRuntime(() => {}, Context.empty());
    const panel = eventPanel(model, deriveSignalChart(model, 'latency').geometry.layout, h);
    clearRuntime();
    return panel;
  };
  let model = update(init(qualityProps).model, Message.ClickedEvent({ key: 'event-gap' })).model;
  assert.equal(model._tag, 'Ready');
  const host = document.createElement('section');
  document.body.append(host);
  let vnode = patch(host, render(model));
  const original = document.querySelector('.signal-event-announcement');
  const browser = document.querySelector('.signal-event-browser');
  assert(original && browser);
  const text = original.textContent;
  browser.open = true;
  const verify = (expectedText) => {
    assert.equal(
      document.querySelector('.signal-event-announcement'),
      original,
      'stable live region',
    );
    assert.equal(original.getAttribute('aria-live'), 'polite');
    assert.equal(original.textContent, expectedText);
    assert.equal(document.querySelector('.signal-event-browser'), browser, 'stable disclosure');
    assert.equal(browser.open, true, 'open disclosure retained');
  };
  model = { ...model, viewport: [1700000020000, 1700000030000] };
  vnode = patch(vnode, render(model));
  verify(text);
  model = { ...model, viewport: model.bounds };
  vnode = patch(vnode, render(model));
  verify(text);
  model = update(model, Message.ClickedClearEvent()).model;
  vnode = patch(vnode, render(model));
  verify('No event selected');
  model = update(model, Message.ClickedEvent({ key: 'event-gap' })).model;
  vnode = patch(vnode, render(model));
  verify(text);
  console.log('Event DOM identity preserved');
  window.happyDOM.abort();
}
await verifyEventDom();
