import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { EditorEvent, FlowEdge, Point } from './types';

/** Presentation of a visible label at the anchor resolved by the edge geometry policy. */
export type FlowEdgeLabelContext = Readonly<{
  edge: FlowEdge;
  labelPosition: Point;
  description: string;
  selected: boolean;
  readOnly: boolean;
}>;

/** The current Model-owned draft for an editable label. */
export type FlowEdgeLabelEditorContext = FlowEdgeLabelContext & Readonly<{ draft: string }>;

type Emit<M> = (event: EditorEvent) => M;
type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];

/** A native edit button in editable views and a static badge in read-only views. */
export function flowEdgeLabelBadge<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeLabelContext,
  onEvent: Emit<M>,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { edge, description, readOnly } = context;
  if (readOnly) return h.div([...attributes, h.Title(edge.label ?? '')], children);
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(
        edge.label
          ? `Edit edge label ${edge.label} for ${description}`
          : `Add label for ${description}`,
      ),
      h.Title(edge.label ?? description),
      h.DataAttribute('flow-context-edge', edge.id),
      h.OnClick(onEvent({ type: 'EdgeLabelEditingStarted', id: edge.id })),
    ],
    children,
  );
}

/** Native submit and Escape handling for a custom editor. Include a submit button to save. */
export function flowEdgeLabelForm<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeLabelEditorContext,
  onEvent: Emit<M>,
  attributes: Parameters<HtmlBuilder<M>['form']>[0],
  children: Parameters<HtmlBuilder<M>['form']>[1],
): Html {
  const id = context.edge.id;
  return h.form(
    [
      ...attributes,
      h.OnSubmit(onEvent({ type: 'EdgeLabelSaved', id })),
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' ? Option.some(onEvent({ type: 'EdgeLabelCancelled', id })) : Option.none(),
      ),
    ],
    children,
  );
}

/** A named text field bound to the current draft. */
export function flowEdgeLabelInput<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeLabelEditorContext,
  onEvent: Emit<M>,
  attributes: Parameters<HtmlBuilder<M>['input']>[0],
): Html {
  return h.input([
    ...attributes,
    h.Type('text'),
    h.AriaLabel(`Edge label for ${context.description}`),
    h.Autofocus(true),
    h.Value(context.draft),
    h.OnInput((text) => onEvent({ type: 'EdgeLabelDraftChanged', id: context.edge.id, text })),
  ]);
}

/** Discards the draft without submitting the form. */
export function flowEdgeLabelCancel<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeLabelEditorContext,
  onEvent: Emit<M>,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.OnClick(onEvent({ type: 'EdgeLabelCancelled', id: context.edge.id })),
    ],
    children,
  );
}
