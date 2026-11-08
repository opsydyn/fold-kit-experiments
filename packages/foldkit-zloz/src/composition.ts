import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozDiagnostics } from './diagnostics';
import { finitePoint, portAnchor } from './geometry';
import { ZlozError } from './graph';
import type {
  EditorPolicy,
  ZlozEdge,
  EditorState,
  ZlozNode,
  Point,
  Port,
  ResizeHandle,
} from './types';

/** Model-derived shell context. Optional controls can be placed or omitted by the shell. */
export type ZlozNodeRenderContext = Readonly<{
  node: ZlozNode;
  state: EditorState;
  descriptionId: string;
  diagnostics: ZlozDiagnostics;
  collapsed: boolean;
  dropTarget: boolean;
  /** Would be selected if the current marquee were released. */
  selectionPreview: boolean;
  /** Movement lock for this node or one of its descendants. Selection remains available. */
  moveDisabledReason?: string | undefined;
  /** Reason explicit resize controls are unavailable for this node. */
  resizeDisabledReason?: string | undefined;
  /** Reason this node cannot be selected. */
  selectionDisabledReason?: string | undefined;
  /** Use the editor's port policy when rendering custom port controls. */
  canConnectPort?: EditorPolicy['canConnectPort'];
  contextAction?: Html;
  collapseToggle?: Html;
  resizeHandles: readonly Html[];
  /** Resolved controls when renderPort is supplied. Append them as direct frame children. */
  ports?: readonly Html[] | undefined;
}>;
export type NodeControlState = Pick<
  EditorState,
  'graph' | 'readOnly' | 'selectedNodes' | 'connection'
>;
type Context = Omit<ZlozNodeRenderContext, 'resizeHandles' | 'state'> & { state: NodeControlState };
type BodyContext = Omit<Context, 'state'> & {
  state: Pick<NodeControlState, 'readOnly' | 'selectedNodes'>;
};
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['div']>[1];

// Merge styles once; geometry remains owned by the Model, rather than a later CSS override.
export function attributesWithGeometry<M>(
  h: HtmlBuilder<M>,
  attributes: Attributes<M>,
  geometry: Record<string, string>,
): Attributes<M> {
  const style: Record<string, string> = {};
  for (const attribute of attributes)
    if ('_tag' in attribute && attribute._tag === 'Style') Object.assign(style, attribute.value);
  return [
    ...attributes.filter((attribute) => !('_tag' in attribute) || attribute._tag !== 'Style'),
    h.Style({ ...style, ...geometry }),
  ];
}

export type ZlozWorldOverlayItemOptions = Readonly<{
  /** Anchor in world coordinates. */
  position: Point;
  /** Receives pointer input and opts out of Zloz canvas gestures and shortcuts. Defaults to false. */
  interactive?: boolean;
}>;

/** Positions arbitrary host content inside a world overlay using graph units. */
export function zlozWorldOverlayItem<M>(
  h: HtmlBuilder<M>,
  { position, interactive }: ZlozWorldOverlayItemOptions,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  finitePoint(position);
  return h.div(
    [
      ...attributesWithGeometry(h, attributes, {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        'pointer-events': interactive ? 'auto' : 'none',
      }),
      h.DataAttribute('flow-world-overlay-item', ''),
      ...(interactive ? [h.DataAttribute('flow-no-drag', '')] : []),
    ],
    children,
  );
}

/** Content height is measured through Zloz's scoped input lifecycle; width and position come from Model. */
export function zlozNodeFrame<M>(
  h: HtmlBuilder<M>,
  context: Context,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { node } = context;
  return h.div(
    [
      ...attributesWithGeometry(h, [], {
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        'box-sizing': 'border-box',
        border: '0',
        padding: '0',
        margin: '0',
        'pointer-events': 'auto',
      }),
      h.Key(node.id),
      h.DataAttribute('flow-node', node.id),
      ...(context.selectionPreview ? [h.DataAttribute('flow-selection-preview', 'true')] : []),
      h.DataAttribute('flow-x', String(node.position.x)),
      h.DataAttribute('flow-y', String(node.position.y)),
    ],
    [
      h.div(
        attributesWithGeometry(h, attributes, {
          position: 'static',
          width: '100%',
          'box-sizing': 'border-box',
        }),
        children,
      ),
    ],
  );
}

/** Group bounds are authored in Model, never inferred from their decorative boundary contents. */
export function zlozGroupFrame<M>(
  h: HtmlBuilder<M>,
  context: Context,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { node } = context;
  return h.div(
    [
      ...attributesWithGeometry(h, [], {
        position: 'absolute',
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: `${node.size.width}px`,
        height: `${node.size.height}px`,
        'box-sizing': 'border-box',
        border: '0',
        padding: '0',
        margin: '0',
        'pointer-events': 'none',
      }),
      h.Key(node.id),
      h.DataAttribute('flow-group', node.id),
      ...(context.selectionPreview ? [h.DataAttribute('flow-selection-preview', 'true')] : []),
      h.DataAttribute('flow-collapsed', String(context.collapsed)),
      ...(context.dropTarget ? [h.DataAttribute('flow-group-drop-target', '')] : []),
    ],
    [
      h.div(
        attributesWithGeometry(h, attributes, {
          position: 'static',
          width: '100%',
          height: '100%',
          'box-sizing': 'border-box',
        }),
        children,
      ),
    ],
  );
}

/** Native focus, selection, keyboard movement and drag initiation travel with this button. */
export function zlozDragHandle<M>(
  h: HtmlBuilder<M>,
  context: BodyContext,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      ...attributesWithGeometry(
        h,
        attributes,
        context.moveDisabledReason === undefined
          ? { 'pointer-events': 'auto' }
          : { 'pointer-events': 'auto', cursor: 'pointer' },
      ),
      h.Type('button'),
      h.DataAttribute('flow-handle', context.node.id),
      ...(context.moveDisabledReason === undefined
        ? []
        : [h.DataAttribute('flow-move-locked', ''), h.Title(context.moveDisabledReason)]),
      ...(context.selectionDisabledReason === undefined
        ? []
        : [h.Disabled(true), h.Title(context.selectionDisabledReason)]),
      h.AriaLabel(`Select ${context.node.label}`),
      h.AriaPressed(String(context.state.selectedNodes.includes(context.node.id))),
      h.AriaDescribedBy(context.descriptionId),
    ],
    children,
  );
}

/** Centers the target on its authored normalized anchor. Style size and contents freely; keep it a direct frame child. */
export function zlozPort<M>(
  h: HtmlBuilder<M>,
  context: Context,
  port: Port,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const { node, state } = context;
  const anchor = portAnchor(port, node);
  const reason = context.canConnectPort?.({ node: node.id, port: port.id }, state.graph) ?? null;
  return h.button(
    [
      ...attributesWithGeometry(h, attributes, {
        left: `${anchor.x * 100}%`,
        top: `${anchor.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        right: 'auto',
        bottom: 'auto',
        position: 'absolute',
        'pointer-events': 'auto',
      }),
      h.Key(`port:${port.id}`),
      h.Type('button'),
      h.DataAttribute('flow-port', port.id),
      h.DataAttribute('flow-port-kind', port.kind),
      h.DataAttribute('flow-owner', node.id),
      h.Disabled(state.readOnly || reason !== null),
      ...(reason === null ? [] : [h.DataAttribute('flow-port-locked', ''), h.Title(reason)]),
      h.AriaLabel(
        `${port.kind === 'output' ? 'Connect from' : 'Connect to'} ${node.label}: ${port.label ?? port.id}`,
      ),
      h.AriaPressed(
        String(state.connection?.node === node.id && state.connection.port === port.id),
      ),
    ],
    children,
  );
}

/** Groups support eight directions; ordinary nodes use width-only resizing. Appearance and placement belong to the caller. */
export function zlozResizeHandle<M>(
  h: HtmlBuilder<M>,
  context: BodyContext,
  handle: ResizeHandle,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  const disabledReason = context.selectionDisabledReason ?? context.resizeDisabledReason;
  const group = context.node.kind === 'group';
  return h.button(
    [
      ...attributesWithGeometry(h, attributes, {
        'pointer-events': 'auto',
        'touch-action': 'none',
      }),
      h.Key(`resize:${handle}`),
      h.Type('button'),
      h.DataAttribute('flow-resize', context.node.id),
      ...(group
        ? [
            h.DataAttribute('flow-resize-handle', handle),
            h.DataAttribute('flow-group-resize', ''),
            ...(handle.includes('-') ? [h.DataAttribute('flow-resize-corner', handle)] : []),
          ]
        : []),
      h.Disabled(context.state.readOnly || context.collapsed || disabledReason !== undefined),
      ...(disabledReason === undefined ? [] : [h.Title(disabledReason)]),
      h.AriaLabel(
        `Resize ${context.node.label}${group ? ` from ${handle.replaceAll('-', ' ')}` : ''}`,
      ),
      h.AriaDescribedBy(context.descriptionId),
    ],
    children,
  );
}

/** A shared SVG selection target. Keep decorative paths pointer-inert and use this resolved path. */
export function zlozEdgeHitTarget<M>(
  h: HtmlBuilder<M>,
  context: Readonly<{ edge: ZlozEdge; path: string; hitWidth?: number }>,
  attributes: Parameters<HtmlBuilder<M>['path']>[0] = [],
): Html {
  const width = context.hitWidth ?? 12;
  if (!Number.isFinite(width) || width <= 0)
    throw new ZlozError('invalid-edit', 'Edge hit width must be positive and finite');
  return h.path(
    [
      ...attributesWithGeometry(h, attributes, { 'pointer-events': 'stroke', cursor: 'pointer' }),
      h.DataAttribute('flow-edge', context.edge.id),
      h.D(context.path),
      h.Fill('none'),
      h.Stroke('transparent'),
      h.StrokeWidth(String(width)),
    ],
    [],
  );
}
