import { describe, expect, it } from 'bun:test';

import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';

import widget from '../js/widget.js';
import type { WidgetModel } from '../js/widget.js';

const spec: PlotSpec = {
  width: 360,
  height: 220,
  title: 'Dose response',
  data: [
    { dose: 1, response: 2 },
    { dose: 2, response: 4 },
  ],
  marks: [{ mark: 'dot', x: 'dose', y: 'response' }],
};

/** The slice of anywidget's model the widget uses, recording what it saves. */
function fakeModel(initial: PlotSpec) {
  let current = { spec: initial, error: '' };
  const listeners = new Set<() => void>();
  const saved: Array<string> = [];
  const model: WidgetModel = {
    get: (name) => current[name],
    set: (name, value) => {
      current = { ...current, [name]: value };
    },
    save_changes: () => {
      saved.push(current.error);
    },
    on: (_event, callback) => listeners.add(callback),
    off: (_event, callback) => listeners.delete(callback),
  };
  const change = (next: PlotSpec) => {
    current = { ...current, spec: next };
    for (const listener of listeners) listener();
  };
  return { model, change, saved, listeners };
}

describe('the anywidget module', () => {
  it('draws the spec as foldkit-viz draws it, with its summary and data table', () => {
    const { model } = fakeModel(spec);
    const el = { innerHTML: '' };
    widget.render({ model, el });
    expect(el.innerHTML).toBe(
      plotHtml(compilePlot(spec), { summary: true, table: plotTable(spec) }),
    );
  });

  it('redraws when Python changes the spec, and stops when the view goes', () => {
    const { model, change, listeners } = fakeModel(spec);
    const el = { innerHTML: '' };
    const cleanup = widget.render({ model, el });
    change({ ...spec, title: 'Updated' });
    expect(el.innerHTML).toContain('<title>Updated</title>');
    cleanup();
    expect(listeners.size).toBe(0);
  });

  it('shows a compile error in place and reports it to Python', () => {
    const { model, saved } = fakeModel({
      ...spec,
      marks: [{ mark: 'dot', x: 'dosage', y: 'response' }],
    });
    const el = { innerHTML: '' };
    widget.render({ model, el });
    expect(el.innerHTML).toStartWith('<pre class="foldkit-viz-error" role="alert">');
    expect(el.innerHTML).toContain('marks[0].x: field &quot;dosage&quot; is missing');
    expect(saved.at(-1)).toContain('marks[0].x: field "dosage" is missing');
  });

  it('clears a reported error once the spec compiles', () => {
    const { model, change, saved } = fakeModel({
      ...spec,
      marks: [{ mark: 'dot', x: 'dosage', y: 'response' }],
    });
    widget.render({ model, el: { innerHTML: '' } });
    change(spec);
    expect(saved.at(-1)).toBe('');
  });
});
