import { describe, expect, it } from 'bun:test';

import type { ThemeName } from '@opsydyn/foldkit-viz/chart/theme';
import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';

import widget from '../js/widget.js';
import type { WidgetModel, WidgetTraits } from '../js/widget.js';

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
function fakeModel(initial: PlotSpec, theme: ThemeName | null = null) {
  let current: WidgetTraits = { spec: initial, error: '', theme };
  const listeners = new Map<string, Set<() => void>>();
  const saved: Array<string> = [];
  const model: WidgetModel = {
    get: (name) => current[name],
    set: (name, value) => {
      current = { ...current, [name]: value };
    },
    save_changes: () => {
      saved.push(current.error);
    },
    on: (event, callback) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(callback));
    },
    off: (event, callback) => {
      listeners.get(event)?.delete(callback);
    },
  };
  const fire = (event: string) => {
    for (const listener of listeners.get(event) ?? []) listener();
  };
  const change = (next: PlotSpec) => {
    current = { ...current, spec: next };
    fire('change:spec');
  };
  const retheme = (next: ThemeName | null) => {
    current = { ...current, theme: next };
    fire('change:theme');
  };
  const listening = () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
  return { model, change, retheme, saved, listening };
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
    const { model, change, listening } = fakeModel(spec);
    const el = { innerHTML: '' };
    const cleanup = widget.render({ model, el });
    change({ ...spec, title: 'Updated' });
    expect(el.innerHTML).toContain('<title>Updated</title>');
    cleanup();
    expect(listening()).toBe(0);
  });

  it('draws in a named theme, on its own background, and redraws when the theme changes', () => {
    const { model, retheme } = fakeModel(spec, 'dark');
    const el = { innerHTML: '' };
    widget.render({ model, el });
    expect(el.innerHTML).toBe(
      plotHtml(compilePlot(spec), { summary: true, table: plotTable(spec), theme: 'dark' }),
    );
    retheme(null);
    expect(el.innerHTML).toBe(
      plotHtml(compilePlot(spec), { summary: true, table: plotTable(spec) }),
    );
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
