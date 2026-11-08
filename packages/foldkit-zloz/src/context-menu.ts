import type { Html, HtmlBuilder } from 'foldkit/html';

import type { EditorEvent, ZlozEdge, ZlozNode, Point } from './types';

export type ZlozContextAction = Readonly<{
  label: string;
  event: EditorEvent;
  pressed?: boolean;
  disabledReason?: string;
}>;

export type ZlozGroupContextActions = Readonly<{
  node: ZlozNode;
  fit: ZlozContextAction;
  lockProportions: ZlozContextAction;
  collapsed: boolean;
  showMeasurements: boolean;
  dimensionStep: number;
  dimensionsDisabled: boolean;
  resizeDisabledReason?: string | undefined;
  changeDimension: (dimension: 'width' | 'height', value: number) => EditorEvent;
}>;

type Common = Readonly<{ point: Point; close: ZlozContextAction }>;

export type ZlozContextMenuContext =
  | (Common &
      Readonly<{
        kind: 'node';
        node: ZlozNode;
        duplicate: ZlozContextAction;
        deleteNode: ZlozContextAction;
        group?: ZlozGroupContextActions;
      }>)
  | (Common &
      Readonly<{
        kind: 'edge';
        edge: ZlozEdge;
        deleteEdge: ZlozContextAction;
        rename: ZlozContextAction;
      }>);

/** Native context action button with optional toggle semantics. */
export function zlozContextAction<M>(
  h: HtmlBuilder<M>,
  action: ZlozContextAction,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.AriaLabel(action.label),
      ...(action.disabledReason === undefined
        ? []
        : [h.Disabled(true), h.Title(action.disabledReason)]),
      ...(action.pressed === undefined ? [] : [h.AriaPressed(String(action.pressed))]),
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}

/** Native number input bound to the current group size and editing constraints. */
export function zlozContextDimensionInput<M>(
  h: HtmlBuilder<M>,
  group: ZlozGroupContextActions,
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
export type ZlozContextTrigger = Readonly<{
  label: string;
  expanded: boolean;
  disabled: boolean;
  event: Extract<EditorEvent, { type: 'ContextOpened' }>;
}>;

/** Native trigger for a context panel. Consumers choose its contents and styles. */
export function zlozContextTrigger<M>(
  h: HtmlBuilder<M>,
  action: ZlozContextTrigger,
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
