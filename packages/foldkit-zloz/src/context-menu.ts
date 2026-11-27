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

/** Model-derived state and event for a context panel trigger. */
export type ZlozContextTrigger = Readonly<{
  label: string;
  expanded: boolean;
  disabled: boolean;
  event: Extract<EditorEvent, { type: 'ContextOpened' }>;
}>;
