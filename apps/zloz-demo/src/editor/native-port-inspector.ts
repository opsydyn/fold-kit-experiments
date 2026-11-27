import { Component, Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import {
  portAdditionContext,
  portInspectorContext,
  portPositionEditorContext,
  type ZlozPortControlContext,
  type ZlozPortInspectorEntry,
  type ZlozPortPositionDraft,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { Effect, Option, Schema } from 'effect';

import { workbenchPolicy } from './editor-policy';
import { Message } from './message';
import type { Model } from './model';
import { architectureNativePanel } from './native-panel';
import { nextPort } from './port-editing';

const sides = ['left', 'right', 'top', 'bottom'] as const;
const modes = [
  ['offset', 'Edge offset'],
  ['anchor', 'Box coordinates'],
] as const;
const isSide = Schema.is(Schema.Literals(sides));
const isMode = Schema.is(Schema.Literals(['offset', 'anchor']));

const focusPortLabel = Mount.make(
  'ArchitecturePortLabelFocus',
  { args: {} },
  (input: HTMLInputElement) =>
    Effect.sync(() => {
      if (!input.disabled) input.focus();
      return Component.noop;
    }),
);
const editLayout = { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } as const;
const reasonId = (control: ZlozPortControlContext) =>
  control.reason === null ? undefined : control.reasonId;

function reason<M>(h: Html.H<M>, control: ZlozPortControlContext) {
  return control.reason === null
    ? null
    : h.span
        .attr('id', control.reasonId)
        .style({
          border: '1px solid currentColor',
          borderRadius: '999px',
          padding: '3px 9px',
          fontSize: '0.85rem',
        })
        .children(control.reason);
}

function portRow<M>(
  h: Html.H<M>,
  model: Model,
  entry: ZlozPortInspectorEntry,
  request: (message: Message) => M,
) {
  const { node, port, labelControl, positionControl, removeControl } = entry;
  const endpoint = { nodeId: node.id, portId: port.id };
  const owner = { modelId: model.modelIdentity.id, epoch: model.modelEpoch };
  const editingLabel =
    model.portLabelDraft?.nodeId === node.id && model.portLabelDraft.portId === port.id
      ? model.portLabelDraft
      : null;
  const editingPosition =
    model.portPositionDraft?.nodeId === node.id && model.portPositionDraft.portId === port.id
      ? portPositionEditorContext(entry, model.portPositionDraft.draft)
      : null;
  const description = `${port.id} port on ${node.label}`;
  const button = (label: string, name: string, control: ZlozPortControlContext, message: Message) =>
    h.button
      .attr('type', 'button')
      .attr('aria-label', name)
      .attr('aria-describedby', reasonId(control))
      .disabled(control.reason !== null)
      .on('click', request(message))
      .children(label);

  const labelForm = editingLabel
    ? h.form
        .style({ ...editLayout, gap: '4px' })
        .on('submit', ({ fields: { label } }) =>
          label !== undefined
            ? request(Message.SubmittedPortLabel({ ...owner, ...endpoint, text: label }))
            : undefined,
        )
        .on(
          'keydown',
          ({ key }) => (key === 'Escape' ? request(Message.ClickedCancelPortLabel()) : undefined),
          { preventDefault: true },
        )
        .children(
          h.input
            .attr('type', 'text')
            .attr('name', 'label')
            .attr('aria-label', `Label for ${description}`)
            .attr('aria-describedby', reasonId(labelControl))
            .attr('placeholder', 'Defaults to port ID')
            .attr('value', editingLabel.text)
            .disabled(labelControl.reason !== null)
            .onMount(focusPortLabel())
            .on('input', ({ value }) => request(Message.ChangedPortLabelDraft({ text: value }))),
          h.button
            .attr('type', 'submit')
            .attr('aria-describedby', reasonId(labelControl))
            .disabled(labelControl.reason !== null)
            .children('Save port label'),
          h.button
            .attr('type', 'button')
            .style({ padding: '10px 16px', cursor: 'pointer' })
            .on('click', request(Message.ClickedCancelPortLabel()))
            .children('Cancel port label'),
        )
    : button(
        'Edit label',
        `Edit label for ${description}`,
        labelControl,
        Message.ClickedEditPortLabel(endpoint),
      );

  const positionForm = editingPosition
    ? h.form
        .style(editLayout)
        .on('submit', ({ fields }) => {
          const { mode, side, offset, x, y } = fields;
          if (!isSide(side)) return;
          const draft: ZlozPortPositionDraft | null =
            mode === 'offset' && offset !== undefined
              ? { mode, side, offset }
              : mode === 'anchor' && x !== undefined && y !== undefined
                ? { mode, side, x, y }
                : null;
          if (draft)
            return request(Message.SubmittedPortPosition({ ...owner, ...endpoint, draft }));
        })
        .on(
          'keydown',
          ({ key }) =>
            key === 'Escape' ? request(Message.ClickedCancelPortPosition()) : undefined,
          { preventDefault: true },
        )
        .children(
          h.label.children(
            'Position ',
            h.select
              .attr('name', 'mode')
              .attr('aria-label', `Position mode for ${description}`)
              .attr('aria-describedby', reasonId(positionControl))
              .disabled(positionControl.reason !== null)
              .on('change', ({ value }) =>
                isMode(value)
                  ? request(Message.SelectedPortPositionMode({ mode: value }))
                  : undefined,
              )
              .children(
                ...modes.map(([mode, label]) =>
                  h.option
                    .key(mode)
                    .attr('value', mode)
                    .selected(editingPosition.draft.mode === mode)
                    .children(label),
                ),
              ),
          ),
          h.label.children(
            'Side ',
            h.select
              .attr('name', 'side')
              .attr('aria-label', `Side for ${description}`)
              .attr('aria-describedby', reasonId(positionControl))
              .disabled(positionControl.reason !== null)
              .on('change', ({ value }) =>
                isSide(value)
                  ? request(Message.SelectedPortPositionSide({ side: value }))
                  : undefined,
              )
              .children(
                ...sides.map((side) =>
                  h.option
                    .key(side)
                    .attr('value', side)
                    .selected(editingPosition.draft.side === side)
                    .children(side),
                ),
              ),
          ),
          ...editingPosition.inputs.map(({ field, value }) =>
            h.label.key(field).children(
              field === 'offset' ? 'Offset ' : field.toUpperCase() + ' ',
              h.input
                .attr('type', 'number')
                .attr('name', field)
                .attr(
                  'aria-label',
                  (field === 'offset' ? 'Offset' : `Anchor ${field.toUpperCase()}`) +
                    ` for ${description}`,
                )
                .attr('aria-describedby', reasonId(positionControl))
                .attr('min', '0')
                .attr('max', '1')
                .attr('step', 'any')
                .attr('required', '')
                .attr('value', value)
                .style({ width: '88px' })
                .disabled(positionControl.reason !== null)
                .on('input', ({ value: text }) =>
                  request(Message.ChangedPortPositionNumber({ field, text })),
                ),
            ),
          ),
          h.button
            .attr('type', 'submit')
            .attr('aria-describedby', reasonId(positionControl))
            .disabled(positionControl.reason !== null)
            .children('Save position'),
          h.button
            .attr('type', 'button')
            .on('click', request(Message.ClickedCancelPortPosition()))
            .children('Cancel position'),
        )
    : button(
        'Edit position',
        `Edit position for ${description}`,
        positionControl,
        Message.ClickedEditPortPosition(endpoint),
      );

  return h.div
    .key(port.id)
    .style({ ...editLayout, margin: '8px 0' })
    .children(
      h.span.children(port.label ?? port.id),
      labelForm,
      positionForm,
      button(
        'Remove port',
        `Remove ${port.label ?? port.id} port from ${node.label}`,
        removeControl,
        Message.ObservedModelInput({
          ...owner,
          message: { type: 'PortRemoved', endpoint: entry.endpoint },
        }),
      ),
      ...entry.reasons.map((control) => reason(h, control)),
    );
}

export const nativePortInspector = architectureNativePanel<Model>((h, model, request) => {
  const { editor } = model;
  const selected = editor.selectedNodes.length === 1 ? editor.selectedNodes[0] : undefined;
  if (selected === undefined || model.minimalMode) return h.div.children();
  const policy = workbenchPolicy(model);
  const options = { idPrefix: 'workbench-port-inspector' };
  const inspector = Option.getOrUndefined(portInspectorContext(editor, selected, policy, options));
  if (
    !inspector ||
    (inspector.node.architecture?.family === 'event-storming' &&
      inspector.node.architecture.role === 'hotspot')
  )
    return h.div.children();
  const { node } = inspector;
  const fieldset = h.fieldset
    .key(node.id)
    .attr('data-flow-port-inspector-demo', 'composable')
    .children(
      h.legend.children('Ports for ' + node.label),
      h.p.children(
        'Removing a port also removes its attached connections. Undo restores them together.',
      ),
      ...(['input', 'output'] as const).map((kind) => {
        const addition = Option.getOrUndefined(
          portAdditionContext(editor, node.id, nextPort(node, kind), policy, options),
        );
        if (!addition) return undefined;
        return h.div
          .key(kind)
          .style({ ...editLayout, display: 'inline-flex' })
          .children(
            h.button
              .attr('type', 'button')
              .attr('aria-describedby', reasonId(addition.control))
              .disabled(addition.control.reason !== null)
              .style({ padding: '10px 16px', cursor: 'pointer' })
              .on('click', request(Message.ClickedAddPort({ nodeId: node.id, kind })))
              .children(`Add ${kind} port`),
            reason(h, addition.control),
          );
      }),
      ...inspector.entries.map((entry) => portRow(h, model, entry, request)),
    );
  return h.div.children(fieldset);
});
