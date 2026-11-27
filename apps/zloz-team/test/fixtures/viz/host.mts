import { UiSchema } from '@effect/ui';
import { Html, HtmlServer } from '@effect/ui/html';
import { orbitGeometry } from '@opsydyn/foldkit-viz/chart/orbit';
import { orbitChart, type OrbitChartOptions } from '@opsydyn/foldkit-viz/effect-ui/orbit';
import { hatchPattern } from '@opsydyn/foldkit-viz/effect-ui/paint';
import { createEditor, serializeGraph } from '@opsydyn/foldkit-zloz';
import { graphSurface } from '@opsydyn/foldkit-zloz/effect-ui';
import { Effect, Schema } from 'effect';

const check = (condition: boolean, reason: string): void => {
  if (!condition) throw new Error(reason);
};
const data = ['intrusive', 'functional', 'model', 'contract'].map((kind) => ({
  id: `relationship-${kind}`,
  kind,
  label: `${kind} <relationship>`,
}));
type Datum = (typeof data)[number];
const Message = UiSchema.TaggedEnum({
  ClickedRelationship: { key: Schema.String },
  GotCanvasEvent: { event: Schema.Unknown },
});
type Message = typeof Message.Type;
const editor = createEditor({
  nodes: [
    {
      id: 'a',
      label: 'Source',
      position: { x: 0, y: 0 },
      size: { width: 120, height: 80 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'Target',
      position: { x: 200, y: 0 },
      size: { width: 120, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [
    {
      id: 'ab',
      source: { node: 'a', port: 'out' },
      target: { node: 'b', port: 'in' },
      label: 'Calls',
    },
  ],
});
const before = serializeGraph(editor.graph);
const geometry = orbitGeometry(
  data,
  { key: (d) => d.id, value: () => 1, halo: (d) => d.kind },
  { size: 300, nodeRadius: { min: 22, max: 22 } },
);
const options = (h: Html.H<Message>, id: string): OrbitChartOptions<Datum, Message> => ({
  geometry,
  title: 'Relationship layout',
  description: 'Synthetic package compatibility fixture',
  coreFill: 'var(--neutral)',
  haloColour: (key) => `var(--integration-${key})`,
  defs: [hatchPattern(h, { id, colour: 'currentColor', spacing: 8 })],
  nodeStyle: () => ({ fill: `url(#${id})`, stroke: 'currentColor' }),
  labelFor: (datum) => datum.label,
});
const Host = Html.component({
  name: 'PackedVizHost',
  model: Schema.Null,
  message: Message,
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) =>
    h.div.children(
      graphSurface(h, editor, {
        id: 'qualification-canvas',
        label: 'Qualification canvas',
        onInput: (event) => Message.GotCanvasEvent({ event }),
      }),
      orbitChart(h, {
        ...options(h, 'qualification-orbit-a-hatch'),
        selectedKey: 'relationship-model',
        onSelect: (key) => Message.ClickedRelationship({ key }),
      }),
      orbitChart(h, options(h, 'qualification-orbit-b-hatch')),
    ),
});
const result = await Effect.runPromise(HtmlServer.renderToHtml(Host, {}, { static: true }));
const html = result.html;
check(html.includes('id="qualification-canvas-surface"'), 'Render the real Zloz canvas');
check(html.split('class="chart-orbit-node"').length - 1 === 8, 'Render both four-category orbits');
check(html.split('role="button"').length - 1 >= 4, 'Interactive orbit retains button semantics');
check(
  html.includes('aria-pressed="true"') && html.includes('role="img"'),
  'Selected and static render contracts coexist',
);
check(html.includes('model &lt;relationship&gt;'), 'Escape authored labels');
check(!html.includes('chart-orbit-pulse'), 'Pulse is optional');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
check(ids.length === new Set(ids).size, 'SVG/document IDs must remain unique');
for (const id of ['qualification-orbit-a-hatch', 'qualification-orbit-b-hatch']) {
  check(
    ids.includes(id) && html.includes(`url(#${id})`),
    'Each orbit uses its own hatch definition',
  );
}
for (const match of html.matchAll(/url\(#([^)]+)\)/g))
  check(ids.includes(match[1]), 'All SVG paint/marker references resolve');
check(serializeGraph(editor.graph) === before, 'Rendering never mutates graph state');
console.log('packed-zloz-orbit-host-ok');
