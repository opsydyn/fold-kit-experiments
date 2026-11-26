import type { Html } from '@effect/ui/html';
import {
  resolveConnectionCreation,
  resolveEdgeReconnection,
  type EditorPolicy,
  type EditorState,
} from '@opsydyn/foldkit-zloz';
import { graphSurface } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import {
  ColorScheme,
  PortDesign,
  Session,
  Message,
  PathStyle,
  connectionPolicy,
  decodeBrowserInput,
  editorFor,
  type Model,
  type WorkbenchEvent,
} from './state';

type Tags = Html.H<Message>;
type Observe = (event: WorkbenchEvent) => Message;

const decodeSession = Schema.decodeUnknownSync(Session);
const decodeDesign = Schema.decodeUnknownSync(PortDesign);
const decodeScheme = Schema.decodeUnknownSync(ColorScheme);
const decodeStyle = Schema.decodeUnknownSync(PathStyle);

function action(h: Tags, label: string, message: Message, disabled = false) {
  return h.button.attr('type', 'button').disabled(disabled).on('click', message).children(label);
}

function choiceOptions<T extends string>(
  h: Tags,
  values: readonly T[],
  current: T | undefined,
  label: (value: T) => string,
) {
  return values.map((value) =>
    h.option
      .attr('value', value)
      .selected(current === value)
      .children(label(value)),
  );
}

type EndpointChoice = Readonly<{
  value: string;
  label: string;
  current: boolean;
  reason: string | null;
  event: WorkbenchEvent;
}>;

function endpointField(
  h: Tags,
  label: string,
  entries: readonly EndpointChoice[],
  observe: Observe,
  options: Readonly<{
    disabled?: boolean;
    placeholder?: string;
    hint?: string | null;
  }> = {},
) {
  const { disabled = false, placeholder, hint } = options;
  const description = `connection-hint-${label.toLowerCase().replaceAll(' ', '-')}`;
  return h.div.class('connection-endpoint').children(
    h.label.class('workbench-field').children(
      label,
      h.select
        .attr('aria-label', label)
        .attr('aria-describedby', hint ? description : undefined)
        .disabled(disabled)
        .on('keydown', ({ key }) =>
          key === 'Escape' ? observe({ type: 'GestureCancelled' }) : undefined,
        )
        .on('change', ({ value }) => {
          const entry = entries.find((item) => item.value === value && item.reason === null);
          return entry ? observe(entry.event) : undefined;
        })
        .children(
          ...(placeholder
            ? [
                h.option
                  .attr('value', '')
                  .selected(!entries.some(({ current }) => current))
                  .disabled(true)
                  .children(placeholder),
              ]
            : []),
          ...entries.map(({ value, label, current, reason }) =>
            h.option
              .key(value)
              .attr('value', value)
              .selected(current)
              .disabled(reason !== null && !current)
              .attr('title', reason ?? undefined)
              .children(label),
          ),
        ),
    ),
    ...(hint ? [h.p.id(description).children(hint)] : []),
  );
}

function selectedEdgeActions(h: Tags, editor: EditorState, policy: EditorPolicy, observe: Observe) {
  const edge =
    editor.selectedEdges.length === 1
      ? editor.graph.edges.find(({ id }) => id === editor.selectedEdges[0])
      : undefined;
  if (!edge || editor.readOnly) return [];
  const { id } = edge;
  const busy = editor.gesture.type !== 'idle';
  const draft = editor.edgeLabelDraft?.id === id ? editor.edgeLabelDraft : null;
  const endpoints = (['source', 'target'] as const).flatMap((end) => {
    const field = resolveEdgeReconnection(editor, id, end, policy);
    return field
      ? [
          endpointField(h, field.label, field.entries, observe, {
            disabled: field.reason !== null,
            hint: field.reason ?? field.emptyReason,
          }),
        ]
      : [];
  });
  return [
    h.div
      .class('connection-edge-actions')
      .attr('role', 'group')
      .attr('aria-label', 'Selected edge actions')
      .children(
        ...(draft
          ? [
              h.label.class('workbench-field').children(
                'Connection label',
                h.input
                  .attr('type', 'text')
                  .value(draft.text)
                  .on('input', ({ value }) =>
                    observe({ type: 'EdgeLabelDraftChanged', id, text: value }),
                  )
                  .on('keydown', ({ key }) => {
                    if (key === 'Enter') return observe({ type: 'EdgeLabelSaved', id });
                    return key === 'Escape'
                      ? observe({ type: 'EdgeLabelCancelled', id })
                      : undefined;
                  }),
              ),
              action(h, 'Save label', observe({ type: 'EdgeLabelSaved', id }), busy),
              action(h, 'Cancel label', observe({ type: 'EdgeLabelCancelled', id }), busy),
            ]
          : [action(h, 'Rename', observe({ type: 'EdgeLabelEditingStarted', id }), busy)]),
        h.label.class('workbench-field').children(
          'Path style',
          h.select
            .disabled(busy)
            .on('change', ({ value }) =>
              observe({
                type: 'EdgePathStyleChanged',
                id,
                pathStyle: value === '' ? null : decodeStyle(value),
              }),
            )
            .children(
              h.option.attr('value', '').selected(!edge.pathStyle).children('Default'),
              ...choiceOptions(h, PathStyle.literals, edge.pathStyle, (value) => value),
            ),
        ),
        action(h, 'Delete edge', observe({ type: 'EdgeDeleted', id }), busy),
        ...endpoints,
      ),
  ];
}

export function view(h: Tags, model: Model) {
  const editor = editorFor(model);
  const observe: Observe = (event) => Message.ObservedInput({ session: model.session, event });
  const busy = editor.gesture.type !== 'idle';
  const policy = connectionPolicy(model);
  const creation = resolveConnectionCreation(editor, policy);
  const id = `connections-${model.session}`;
  const label = model.session === 'strict' ? 'Strict connection canvas' : 'Loose connection canvas';

  return h.div
    .class('connection-lab')
    .attr('data-flow-workbench-color-scheme', model.scheme)
    .children(
      h.div.class('workbench-layout').children(
        h.aside
          .class('workbench-sidebar')
          .attr('aria-label', 'Connection controls')
          .children(
            h.a.class('workbench-skip').attr('href', `#${id}-surface`).children('Skip to canvas'),
            h.div
              .class('workbench-sidebar-heading')
              .children(
                h.div(
                  h.p.class('workbench-eyebrow').children('COMPOSE. CONNECT.'),
                  h.h1('Connections, your way.'),
                ),
              ),
            h.div.class('workbench-sidebar-scroll').children(
              h.p('Two independent sessions. Switch freely; each keeps its graph and Undo.'),
              h.label.class('workbench-field').children(
                'Session',
                h.select
                  .attr('aria-label', 'Session')
                  .disabled(busy)
                  .on('change', ({ value }) =>
                    Message.SelectedSession({ session: decodeSession(value) }),
                  )
                  .children(
                    ...choiceOptions(h, Session.literals, model.session, (value) =>
                      value === 'strict'
                        ? 'Strict · output → input'
                        : 'Loose · any port → any port',
                    ),
                  ),
              ),
              h.label.class('workbench-field').children(
                'Port design',
                h.select
                  .attr('aria-label', 'Port design')
                  .disabled(busy)
                  .on('change', ({ value }) =>
                    Message.SelectedDesign({ design: decodeDesign(value) }),
                  )
                  .children(
                    ...choiceOptions(h, PortDesign.literals, model.design, (value) =>
                      value === 'native' ? 'Native circles' : 'Custom intent badges',
                    ),
                  ),
              ),
              h.label.class('workbench-field').children(
                'Theme',
                h.select
                  .attr('aria-label', 'Theme')
                  .on('change', ({ value }) =>
                    Message.SelectedScheme({ scheme: decodeScheme(value) }),
                  )
                  .children(
                    ...choiceOptions(h, ColorScheme.literals, model.scheme, (value) =>
                      value === 'light' ? 'Light' : 'Dark',
                    ),
                  ),
              ),
              h.label
                .class('workbench-field')
                .children(
                  'Protect Audit input',
                  h.input
                    .attr('type', 'checkbox')
                    .checked(model.protectedPort)
                    .on('click', Message.ClickedProtection()),
                ),
              h.p(
                'Audit input requires approval while protection is on. Port kind and protection are independent.',
              ),
              h.label
                .class('workbench-field')
                .children(
                  'Read-only',
                  h.input
                    .attr('type', 'checkbox')
                    .checked(model.readOnly)
                    .on('click', Message.ClickedReadOnly()),
                ),
              h.div
                .class('connection-lab-actions')
                .attr('role', 'group')
                .attr('aria-label', 'Session history')
                .children(
                  action(
                    h,
                    'Undo',
                    observe({ type: 'UndoPressed' }),
                    busy || editor.readOnly || editor.past.length === 0,
                  ),
                  action(
                    h,
                    'Redo',
                    observe({ type: 'RedoPressed' }),
                    busy || editor.readOnly || editor.future.length === 0,
                  ),
                  action(
                    h,
                    'Fit',
                    observe({ type: 'FitViewClicked' }),
                    busy || editor.surface === null,
                  ),
                ),
              h.p
                .attr('role', 'status')
                .attr('data-connection-feedback', '')
                .children(
                  editor.notice ??
                    (model.session === 'strict'
                      ? 'Strict session: choose an output, then an input.'
                      : 'Loose session: choose any source port, then any target.'),
                ),
              h.p
                .id('connection-gestures')
                .children(
                  'Use Enter or Space on ports, or drag between them. Escape cancels. In loose mode Input and Output are retained as authored labels.',
                ),
              h.div
                .attr('role', 'group')
                .attr('aria-label', 'Create a connection')
                .children(
                  ...[creation.source, creation.target].map((field) =>
                    endpointField(h, field.label, field.entries, observe, {
                      disabled: field.reason !== null,
                      placeholder: field.placeholder,
                      hint: field.reason ?? field.hint,
                    }),
                  ),
                  action(
                    h,
                    'Cancel connection',
                    observe(creation.cancel.event),
                    creation.cancel.reason !== null,
                  ),
                ),
              h.h2('Connections'),
              h.div
                .attr('role', 'group')
                .attr('aria-label', 'Connections')
                .children(
                  ...editor.graph.edges.map(({ id, label, source, target }) =>
                    h.button
                      .key(id)
                      .attr('type', 'button')
                      .attr('aria-pressed', String(editor.selectedEdges.includes(id)))
                      .on('click', observe({ type: 'EdgeSelected', id, additive: false }))
                      .children(
                        label ?? `${source.node}:${source.port} → ${target.node}:${target.port}`,
                      ),
                  ),
                ),
              ...selectedEdgeActions(h, editor, policy, observe),
              h.p('Select a connection to change either end. Each edit is one Undo.'),
              h.p(
                'This connection workbench uses v2 documents. Architecture editions and portable adapters retain their existing formats.',
              ),
            ),
          ),
        h.div.class('workbench-canvas').children(
          graphSurface(h, editor, {
            id,
            label,
            descriptionId: 'connection-gestures',
            policy,
            dropRadius: 32,
            reconnect: true,
            wheelNavigation: 'zoom',
            portLabel: ({ port, end, reason }) =>
              model.design === 'native'
                ? undefined
                : reason
                  ? editor.readOnly
                    ? 'Read-only'
                    : 'Protected'
                  : `${port.kind} · ${end}`,
            onInput: (event) => observe(decodeBrowserInput(event)),
            nodeNote: (node) => (node.id === 'audit' ? 'Policies stay live.' : 'Choose a port.'),
          }),
        ),
      ),
    );
}
