import type { EditorEvent } from '@opsydyn/foldkit-zloz';
import { zlozView, zlozPort, type ZlozViewLayoutParts } from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { workbenchThemes } from '../editor/theme';
import {
  ColorScheme,
  PortDesign,
  Session,
  Message,
  connectionPolicy,
  editorFor,
  type Model,
} from './state';

export function view(model: Model, h: HtmlBuilder<Message>): Document {
  const editor = editorFor(model);
  const observe = (event: EditorEvent) => Message.ObservedInput({ session: model.session, event });
  const busy = editor.gesture.type !== 'idle';
  const action = (
    label: string,
    type: 'UndoPressed' | 'RedoPressed' | 'FitViewClicked',
    disabled = false,
  ) => h.button([h.Type('button'), h.Disabled(disabled), h.OnClick(observe({ type }))], [label]);
  const field = (label: string, content: Html) =>
    h.label([h.Class('workbench-field')], [label, content]);
  const options = <T extends string>(
    values: readonly T[],
    current: T,
    label: (value: T) => string,
  ) =>
    values.map((value) =>
      h.option([h.Value(value), h.Selected(current === value)], [label(value)]),
    );
  const layout = (parts: ZlozViewLayoutParts): Html =>
    h.div(
      [h.Class('workbench-layout')],
      [
        h.aside(
          [h.Class('workbench-sidebar'), h.AriaLabel('Connection controls')],
          [
            h.a(
              [h.Class('workbench-skip'), h.Href('#connections-' + model.session + '-surface')],
              ['Skip to canvas'],
            ),
            h.div(
              [h.Class('workbench-sidebar-heading')],
              [
                h.div(
                  [],
                  [
                    h.p([h.Class('workbench-eyebrow')], ['COMPOSE. CONNECT.']),
                    h.h1([], ['Connections, your way.']),
                  ],
                ),
              ],
            ),
            h.div(
              [h.Class('workbench-sidebar-scroll')],
              [
                h.p(
                  [],
                  ['Two independent sessions. Switch freely; each keeps its graph and Undo.'],
                ),
                field(
                  'Session',
                  h.select(
                    [
                      h.AriaLabel('Session'),
                      h.Disabled(busy),
                      h.Value(model.session),
                      h.OnChange((value) =>
                        Message.SelectedSession({
                          session: Schema.decodeUnknownSync(Session)(value),
                        }),
                      ),
                    ],
                    options(['strict', 'loose'], model.session, (value) =>
                      value === 'strict'
                        ? 'Strict · output → input'
                        : 'Loose · any port → any port',
                    ),
                  ),
                ),
                field(
                  'Port design',
                  h.select(
                    [
                      h.AriaLabel('Port design'),
                      h.Disabled(busy),
                      h.Value(model.design),
                      h.OnChange((value) =>
                        Message.SelectedDesign({
                          design: Schema.decodeUnknownSync(PortDesign)(value),
                        }),
                      ),
                    ],
                    options(['native', 'custom'], model.design, (value) =>
                      value === 'native' ? 'Native circles' : 'Custom intent badges',
                    ),
                  ),
                ),
                field(
                  'Theme',
                  h.select(
                    [
                      h.AriaLabel('Theme'),
                      h.Value(model.scheme),
                      h.OnChange((value) =>
                        Message.SelectedScheme({
                          scheme: Schema.decodeUnknownSync(ColorScheme)(value),
                        }),
                      ),
                    ],
                    options(['light', 'dark'], model.scheme, (value) =>
                      value === 'light' ? 'Light' : 'Dark',
                    ),
                  ),
                ),
                field(
                  'Protect Audit input',
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(model.protectedPort),
                    h.OnClick(Message.ClickedProtection()),
                  ]),
                ),
                h.p(
                  [],
                  [
                    'Audit input requires approval while protection is on. Port kind and protection are independent.',
                  ],
                ),
                field(
                  'Read-only',
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(model.readOnly),
                    h.OnClick(Message.ClickedReadOnly()),
                  ]),
                ),
                h.div(
                  [
                    h.Class('connection-lab-actions'),
                    h.Role('group'),
                    h.AriaLabel('Session history'),
                  ],
                  [
                    action(
                      'Undo',
                      'UndoPressed',
                      busy || editor.readOnly || editor.past.length === 0,
                    ),
                    action(
                      'Redo',
                      'RedoPressed',
                      busy || editor.readOnly || editor.future.length === 0,
                    ),
                    action('Fit', 'FitViewClicked', busy || editor.surface === null),
                  ],
                ),
                h.p(
                  [
                    h.Role('status'),
                    h.AriaLive('polite'),
                    h.DataAttribute('connection-feedback', ''),
                  ],
                  [
                    editor.notice ??
                      (model.session === 'strict'
                        ? 'Strict session: choose an output, then an input.'
                        : 'Loose session: choose any source port, then any target.'),
                  ],
                ),
                h.p(
                  [],
                  [
                    'Use Enter or Space on ports, or drag between them. Escape cancels. In loose mode Input and Output are retained as authored labels.',
                  ],
                ),
                ...(parts.creation ? [parts.creation] : []),
                h.h2([], ['Connections']),
                parts.connections,
                h.p([], ['Select a connection to change either end. Each edit is one Undo.']),
                h.p(
                  [],
                  [
                    'This connection workbench uses v2 documents. Architecture editions and portable adapters retain their existing formats.',
                  ],
                ),
              ],
            ),
          ],
        ),
        h.div([h.Class('workbench-canvas')], [parts.help, parts.canvas]),
      ],
    );
  return {
    title: 'Connection workbench | Foldkit Zloz',
    body: h.div(
      [h.Class('connection-lab'), h.DataAttribute('flow-workbench-color-scheme', model.scheme)],
      [
        zlozView(h, editor, {
          id: 'connections-' + model.session,
          label:
            model.session === 'strict' ? 'Strict connection canvas' : 'Loose connection canvas',
          onEvent: observe,
          theme: workbenchThemes[model.scheme],
          height: 'fill',
          diagnostics: {
            measurements: false,
            alignmentGuides: false,
            zoomLevel: false,
            status: false,
            instructions: false,
            overview: false,
            connectionList: true,
          },
          resizeHandles: false,
          connectionCreation: true,
          edgeToolbar: true,
          edgeReconnection: true,
          connectionDropRadius: 32,
          reconnectionDropRadius: 32,
          pinchZoom: true,
          wheelNavigation: 'zoom',
          ...connectionPolicy(model),
          renderNode: (node, builder) =>
            builder.p(
              [
                builder.Style({
                  color: 'var(--flow-node-color)',
                  padding: '0 56px',
                  'font-size': '12px',
                }),
              ],
              [node.id === 'audit' ? 'Policies stay live.' : 'Choose a port.'],
            ),
          renderPort: (context, builder) =>
            model.design === 'native'
              ? undefined
              : zlozPort(
                  builder,
                  context,
                  context.port,
                  [
                    builder.Class('connection-intent-port'),
                    builder.DataAttribute('custom-intent', context.connectionEnd),
                    builder.Style({
                      background: context.target
                        ? 'var(--flow-selection)'
                        : 'var(--flow-node-background)',
                      color: 'var(--flow-node-color)',
                      border: '2px solid var(--flow-selection)',
                      'border-radius': '16px',
                      padding: '5px 8px',
                      'font-size': '10px',
                      'white-space': 'nowrap',
                      'box-shadow': context.active
                        ? '0 0 0 4px var(--flow-selection-background)'
                        : 'none',
                    }),
                  ],
                  [
                    context.disabledReason
                      ? 'Protected'
                      : `${context.port.kind} · ${context.connectionEnd}`,
                  ],
                ),
          renderLayout: layout,
        }),
      ],
    ),
  };
}
