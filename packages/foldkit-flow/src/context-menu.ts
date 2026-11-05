import type { Html, HtmlBuilder } from 'foldkit/html';

import type { EditorEvent, FlowEdge, FlowNode, Point } from './types';

export type FlowContextAction = Readonly<{
  label: string;
  event: EditorEvent;
  pressed?: boolean;
}>;

export type FlowGroupContextActions = Readonly<{
  node: FlowNode;
  fit: FlowContextAction;
  lockProportions: FlowContextAction;
  collapsed: boolean;
  showMeasurements: boolean;
  dimensionStep: number;
  dimensionsDisabled: boolean;
  changeDimension: (dimension: 'width' | 'height', value: number) => EditorEvent;
}>;

type Common = Readonly<{ point: Point; close: FlowContextAction }>;

export type FlowContextMenuContext =
  | (Common &
      Readonly<{
        kind: 'node';
        node: FlowNode;
        duplicate: FlowContextAction;
        deleteNode: FlowContextAction;
        group?: FlowGroupContextActions;
      }>)
  | (Common &
      Readonly<{
        kind: 'edge';
        edge: FlowEdge;
        deleteEdge: FlowContextAction;
        rename: FlowContextAction;
      }>);

/** Native context action button with optional toggle semantics. */
export function flowContextAction<M>(
  h: HtmlBuilder<M>,
  action: FlowContextAction,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(action.label),
      ...(action.pressed === undefined ? [] : [h.AriaPressed(String(action.pressed))]),
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}

/** Native number input bound to the current group size and editing constraints. */
export function flowContextDimensionInput<M>(
  h: HtmlBuilder<M>,
  group: FlowGroupContextActions,
  dimension: 'width' | 'height',
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['input']>[0],
): Html {
  const label = dimension === 'width' ? 'Width' : 'Height';
  return h.input([
    ...attributes,
    h.Type('number'),
    h.Min('0'),
    h.Step(String(group.dimensionStep)),
    h.AriaLabel(`${label} of ${group.node.label}`),
    h.Value(String(Number(group.node.size[dimension].toPrecision(12)))),
    h.Disabled(group.dimensionsDisabled),
    h.OnChange((value) => onEvent(group.changeDimension(dimension, Number(value)))),
  ]);
}

/** Model-derived state and event for a context panel trigger. */
export type FlowContextTrigger = Readonly<{
  label: string;
  expanded: boolean;
  disabled: boolean;
  event: Extract<EditorEvent, { type: 'ContextOpened' }>;
}>;

/** Native trigger for a context panel. Consumers choose its contents and styles. */
export function flowContextTrigger<M>(
  h: HtmlBuilder<M>,
  action: FlowContextTrigger,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(action.label),
      h.Title('More actions'),
      h.AriaExpanded(action.expanded),
      h.Disabled(action.disabled),
      h.DataAttribute('flow-no-drag', ''),
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}
