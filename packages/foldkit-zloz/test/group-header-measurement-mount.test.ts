import { afterEach, expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  bindBoxMeasurement,
  groupHeaderMeasurementTarget,
  type BoxMeasurementBatch,
} from '../src/box-measurement-mount';

const bindGroupHeaderMeasurement = (
  probe: Element,
  ids: readonly string[],
  emit: (batch: BoxMeasurementBatch) => void,
  timeoutMs = 3000,
) => bindBoxMeasurement(probe, ids, emit, timeoutMs, groupHeaderMeasurementTarget);
const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => {
  if (previous) Object.defineProperty(globalThis, 'document', previous);
  else Reflect.deleteProperty(globalThis, 'document');
});
test('heading observation isolates nested native canvases and does not collect edge label targets', async () => {
  const window = new Window();
  Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
  const scope = document.createElement('div');
  scope.setAttribute('data-flow-surface', '');
  scope.setAttribute('data-zloz-group-header-measurement-scope', '');
  scope.innerHTML =
    '<button data-zloz-group-header="g"></button><div data-zloz-measured-label="g"></div><div data-flow-surface><button data-zloz-group-header="g"></button></div><span></span>';
  document.body.append(scope);
  const target = scope.firstElementChild,
    probe = scope.lastElementChild;
  assert(target && probe);
  let callback: ResizeObserverCallback | undefined,
    instance: ResizeObserver | undefined,
    disconnects = 0;
  const observed: Element[] = [];
  Object.defineProperty(window, 'ResizeObserver', {
    value: class implements ResizeObserver {
      constructor(next: ResizeObserverCallback) {
        callback = next;
        instance = this;
      }
      observe(target: Element) {
        observed.push(target);
      }
      unobserve() {}
      disconnect() {
        disconnects++;
      }
    },
  });
  const batches: Parameters<Parameters<typeof bindGroupHeaderMeasurement>[2]>[0][] = [];
  const release = bindGroupHeaderMeasurement(probe, ['g'], (batch) => batches.push(batch));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(observed).toEqual([target]);
  assert(callback && instance);
  callback(
    [
      {
        target,
        borderBoxSize: [{ inlineSize: 401.25, blockSize: 92.5 }],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
        contentRect: {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 390,
          bottom: 80,
          width: 390,
          height: 80,
          toJSON: () => ({}),
        },
      },
    ],
    instance,
  );
  expect(batches).toEqual([
    { type: 'measured', labels: [{ id: 'g', size: { width: 401.25, height: 92.5 } }] },
  ]);
  release();
  expect(disconnects).toBe(1);
  const missing: typeof batches = [];
  bindGroupHeaderMeasurement(probe, ['other'], (batch) => missing.push(batch));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(missing).toEqual([
    { type: 'failed', reason: 'Render every requested group heading before measuring.' },
  ]);
});

import { groupHeaderMeasurementProbe } from '../src/effect-ui';
import {
  createEditor,
  startGroupHeaderMeasurement,
  type LayoutGroupHeaderSpec,
} from '../src/index';
const spec: LayoutGroupHeaderSpec = {
  id: 'g',
  padding: { top: 24, right: 24, bottom: 24, left: 24 },
  gap: 24,
};
const state = createEditor({
  nodes: [
    {
      id: 'g',
      kind: 'group',
      label: 'C4 group',
      position: { x: 0, y: 0 },
      size: { width: 800, height: 400 },
      ports: [],
      architecture: { family: 'c4', role: 'software-system' },
    },
  ],
  edges: [],
});
async function render(enabled: boolean, timeoutMs = 3000) {
  const pending = startGroupHeaderMeasurement(state, 'ssr-group', 'renderer', [spec]);
  assert(pending.type === 'pending');
  const View = Html.component({
    name: 'Measurement',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      h.div.attr('data-zloz-group-header-measurement-scope', enabled ? '' : undefined).children(
        h.button
          .attr('data-zloz-group-header', 'g')
          .style({ width: 'max-content' })
          .children('C4 group'),
        enabled
          ? groupHeaderMeasurementProbe(h, pending.request, (result) => result.type, {
              timeoutMs,
            })
          : null,
      ),
  });
  return (await Effect.runPromise(HtmlServer.renderToHtml(View, {}, { static: true }))).html;
}
test('group measurement hooks are opt-in and SSR inert; intrinsic sizing and deadline validation are public', async () => {
  const plain = await render(false),
    measured = await render(true);
  expect(plain).not.toContain('data-zloz-group-header-measurement-scope');
  expect(plain).not.toContain('hidden');
  expect(measured).toContain('hidden');
  expect(measured).toContain('data-zloz-group-header-measurement-scope');
  expect(measured).toContain('data-zloz-group-header="g"');
  expect(measured).toContain('max-content');
  expect(await render(true, 0)).not.toContain('<div hidden');
});
