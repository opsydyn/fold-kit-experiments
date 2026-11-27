import type { ZlozNode } from '@opsydyn/foldkit-zloz';
import {
  zlozDragHandle,
  zlozGroupFrame,
  zlozNodeFrame,
  zlozPort,
  zlozResizeHandle,
  type ZlozNodeBodyCache,
  type ZlozNodeRenderContext,
  type ZlozPortRenderContext,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from '../src/editor/message';
import { orbitRings, type OrbitArtwork } from '../src/editor/native-orbit';

function staticOrbitArtwork(h: HtmlBuilder<Message>, artwork: OrbitArtwork) {
  const { id, label, group } = artwork;
  if (group)
    return h.span([h.Class('orbit-group-body'), h.DataAttribute('orbit-body', id)], [label]);
  return h.span(
    [
      h.Class('orbit-node-body'),
      h.DataAttribute('orbit-body', id),
      h.Style({ display: 'contents' }),
    ],
    [
      h.svg(
        [
          h.ViewBox('0 0 100 100'),
          h.Width('100%'),
          h.Height('100%'),
          h.AriaHidden(true),
          h.Style({ display: 'block', 'pointer-events': 'none' }),
        ],
        orbitRings(artwork).map(({ radius, fill, stroke, dashArray, strokeWidth }) =>
          h.circle(
            [
              h.Cx('50'),
              h.Cy('50'),
              h.R(radius),
              h.Fill(fill),
              h.Stroke(stroke),
              h.StrokeDasharray(dashArray),
              h.StrokeWidth(strokeWidth),
            ],
            [],
          ),
        ),
      ),
      h.span([h.Class('orbit-node-caption')], [label]),
    ],
  );
}

function orbitNodeBody(
  h: HtmlBuilder<Message>,
  { id, label }: ZlozNode,
  selected: boolean,
  preview: boolean,
) {
  return staticOrbitArtwork(h, { id, label, selected, preview });
}

function orbitGroupBody(h: HtmlBuilder<Message>, { id, label }: ZlozNode) {
  return staticOrbitArtwork(h, { id, label, group: true });
}

/** A complete shell composed exclusively from supported package primitives. */
export function orbitNode(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<Message>,
  cache?: ZlozNodeBodyCache,
) {
  const selected = context.state.selectedNodes.includes(context.node.id);
  const artwork = cache
    ? cache(context.node, orbitNodeBody, [h, context.node, selected, context.selectionPreview])
    : orbitNodeBody(h, context.node, selected, context.selectionPreview);
  return zlozNodeFrame(
    h,
    context,
    [h.Class('orbit-node'), h.Style({ height: `${context.node.size.width}px`, color: '#fff' })],
    [
      zlozDragHandle(
        h,
        context,
        [
          h.Style({
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            padding: '0',
            border: '0',
            background: 'transparent',
            color: 'inherit',
            'border-radius': '50%',
            cursor: context.state.readOnly ? 'pointer' : 'grab',
          }),
        ],
        [artwork],
      ),
      ...(context.resizeHandles.length
        ? [
            zlozResizeHandle(
              h,
              context,
              'right',
              [
                h.Style({
                  position: 'absolute',
                  bottom: '6px',
                  left: 'calc(50% - 14px)',
                  width: '28px',
                  height: '28px',
                  padding: '0',
                  background: '#172554',
                  color: '#7dd3fc',
                  border: '1px solid #7dd3fc',
                  'border-radius': '50%',
                  cursor: 'ew-resize',
                }),
              ],
              ['↔'],
            ),
          ]
        : []),
      ...(context.ports ??
        context.node.ports.map((port) =>
          zlozPort(
            h,
            context,
            port,
            [
              h.Style({
                width: '28px',
                height: '28px',
                padding: '0',
                border: '2px solid #172554',
                'border-radius': '6px',
                background: port.kind === 'output' ? '#fb923c' : '#7dd3fc',
                color: '#172554',
                'font-weight': '700',
                cursor: 'crosshair',
              }),
            ],
            [port.kind === 'output' ? '→' : '←'],
          ),
        )),
    ],
  );
}

export function orbitGroup(
  context: ZlozNodeRenderContext,
  h: HtmlBuilder<Message>,
  cache?: ZlozNodeBodyCache,
) {
  const selected = context.state.selectedNodes.includes(context.node.id);
  const label = cache
    ? cache(context.node, orbitGroupBody, [h, context.node])
    : orbitGroupBody(h, context.node);
  return zlozGroupFrame(
    h,
    context,
    [
      h.Class('orbit-boundary'),
      h.Style({
        border: `2px ${context.dropTarget ? 'solid' : 'dotted'} ${selected || context.dropTarget ? '#f97316' : '#38bdf8'}`,
        'border-radius': '28px',
        outline: context.selectionPreview ? '2px dashed var(--flow-valid-target, #0f766e)' : 'none',
        'outline-offset': '2px',
        background: context.collapsed ? 'light-dark(#dbeafe, #253b58)' : 'rgb(56 189 248 / 0.05)',
        padding: '6px',
        display: 'flex',
        gap: '6px',
        'align-items': 'flex-start',
      }),
    ],
    [
      zlozDragHandle(
        h,
        context,
        [
          h.Style({
            background: '#172554',
            color: '#fff',
            border: '0',
            'border-radius': '18px',
            padding: '8px 14px',
            'min-height': '32px',
            cursor: 'grab',
          }),
        ],
        [label],
      ),
      h.button(
        [
          h.Type('button'),
          h.AriaLabel(`${context.collapsed ? 'Expand' : 'Collapse'} ${context.node.label}`),
          h.AriaExpanded(!context.collapsed),
          h.OnClick(
            Message.ObservedZlozInput({
              message: { type: 'GroupCollapseToggled', id: context.node.id },
            }),
          ),
          h.Style({
            'pointer-events': 'auto',
            width: '34px',
            height: '34px',
            background: '#172554',
            color: '#fff',
            border: '0',
            'border-radius': '50%',
            cursor: 'pointer',
          }),
        ],
        [context.collapsed ? '+' : '−'],
      ),
      ...context.resizeHandles,
      ...(context.ports ?? []),
    ],
  );
}

function socketPort(context: ZlozPortRenderContext, h: HtmlBuilder<Message>, showReasons = false) {
  const disabled = context.state.readOnly || context.disabledReason !== null;
  const reason =
    context.disabledReason ?? (context.state.readOnly ? 'This diagram is read-only.' : null);
  const reasonId = `${context.descriptionId}-socket-${encodeURIComponent(JSON.stringify([context.node.id, context.port.id]))}`;
  return zlozPort(
    h,
    context,
    context.port,
    [
      h.Class('workbench-socket'),
      ...(showReasons && reason !== null ? [h.AriaDescribedBy(reasonId)] : []),
      h.Title(context.disabledReason ?? context.label),
      h.Style({
        width: '30px',
        height: '26px',
        overflow: 'visible',
        padding: '3px',
        'border-radius': '7px',
        border: `2px ${disabled ? 'dashed' : 'solid'} var(--flow-node-color, #172033)`,
        background:
          context.target || context.active
            ? 'var(--flow-valid-target, #0f766e)'
            : 'var(--flow-node-background, #fff)',
        color:
          context.target || context.active
            ? 'var(--flow-control-color, #fff)'
            : 'var(--flow-node-color, #172033)',
        'box-shadow': context.target ? '0 0 0 3px var(--flow-valid-target, #0f766e)' : 'none',
        opacity: disabled && !showReasons ? '0.5' : '1',
        cursor: 'crosshair',
        'z-index': '2',
      }),
    ],
    [
      h.svg(
        [h.ViewBox('0 0 20 20'), h.Width('100%'), h.Height('100%'), h.AriaHidden(true)],
        [
          h.path(
            [
              h.D(
                context.port.kind === 'output'
                  ? 'M4,4 L12,10 L4,16 M12,10 H17'
                  : 'M16,4 L8,10 L16,16 M8,10 H3',
              ),
              h.Fill('none'),
              h.Stroke('currentColor'),
              h.StrokeWidth('2'),
            ],
            [],
          ),
        ],
      ),
      ...(showReasons && reason !== null
        ? [
            h.span(
              [
                h.Id(reasonId),
                h.DataAttribute('socket-reason', ''),
                h.Style({
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: context.port.kind === 'input' ? 'auto' : '0',
                  right: context.port.kind === 'input' ? '0' : 'auto',
                  width: '132px',
                  padding: '4px 6px',
                  border: '1px solid var(--flow-node-border, #64748b)',
                  'border-radius': '5px',
                  'font-size': '10px',
                  'line-height': '1.25',
                  'white-space': 'normal',
                  background: 'var(--flow-node-background, #fff)',
                  color: 'var(--flow-node-color, #172033)',
                  'pointer-events': 'none',
                }),
              ],
              [reason],
            ),
          ]
        : []),
    ],
  );
}

export const reasonSocketPort = (context: ZlozPortRenderContext, h: HtmlBuilder<Message>) =>
  socketPort(context, h, true);
