import type { ThemeName } from '@opsydyn/foldkit-viz/chart/theme';
import { compilePlot, plotTable } from '@opsydyn/foldkit-viz/plot';
import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { plotHtml } from '@opsydyn/foldkit-viz/svg/plot';

/**
 * The anywidget front end of the Python `foldkit_viz.Plot`: it draws the
 * widget's `spec` trait with foldkit-viz, the same markup every other renderer
 * produces, and redraws whenever Python changes it. Python checks a spec
 * against the published schema; what depends on the data (a field that is not
 * there) only compilePlot can find, so its error is shown in place and written
 * back to the `error` trait for Python to read. A `theme` trait names a theme
 * from chart/theme; null follows the notebook.
 */

/** The widget's synced traits; `theme` is null to follow the notebook. */
export type WidgetTraits = { spec: PlotSpec; error: string; theme: ThemeName | null };

/** The slice of anywidget's model this widget uses. */
export type WidgetModel = Readonly<{
  get: <K extends keyof WidgetTraits>(name: K) => WidgetTraits[K];
  set: <K extends keyof WidgetTraits>(name: K, value: WidgetTraits[K]) => void;
  save_changes: () => void;
  on: (event: 'change:spec' | 'change:theme', callback: () => void) => void;
  off: (event: 'change:spec' | 'change:theme', callback: () => void) => void;
}>;

/** The widget's output element: only its markup is written. */
export type WidgetElement = { innerHTML: string };

const escapeText = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const messageOf = (error: Error | string): string =>
  error instanceof Error ? error.message : error;

function draw(model: WidgetModel, el: WidgetElement): void {
  const spec = model.get('spec');
  const theme = model.get('theme');
  let error = '';
  // oxlint-disable-next-line linteffect/no-try-catch -- An anywidget front end runs outside any Effect runtime, and compilePlot reports a bad spec by throwing.
  try {
    const options = { summary: true, table: plotTable(spec) };
    el.innerHTML = plotHtml(compilePlot(spec), theme === null ? options : { ...options, theme });
  } catch (caught) {
    // SAFETY: compilePlot throws RangeErrors naming the spec path; anything else is reported by its text.
    error = messageOf(caught as Error | string);
    el.innerHTML = `<pre class="foldkit-viz-error" role="alert">${escapeText(error)}</pre>`;
  }
  if (model.get('error') !== error) {
    model.set('error', error);
    model.save_changes();
  }
}

export default {
  render({ model, el }: Readonly<{ model: WidgetModel; el: WidgetElement }>): () => void {
    const redraw = () => draw(model, el);
    redraw();
    model.on('change:spec', redraw);
    model.on('change:theme', redraw);
    return () => {
      model.off('change:spec', redraw);
      model.off('change:theme', redraw);
    };
  },
};
