import {
  flowDragHandle,
  flowGroupFrame,
  flowNodeFrame,
  flowPort,
  flowResizeHandle,
  type FlowNodeRenderContext,
} from '@opsydyn/foldkit-flow/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { Message } from './message';

/** A complete shell composed exclusively from supported package primitives. */
export function orbitNode(context: FlowNodeRenderContext, h: HtmlBuilder<Message>) {
  const selected = context.state.selectedNodes.includes(context.node.id);
  return flowNodeFrame(
    h,
    context,
    [h.Class('orbit-node'), h.Style({ height: `${context.node.size.width}px`, color: '#fff' })],
    [
      flowDragHandle(
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
        [
          h.svg(
            [
              h.ViewBox('0 0 100 100'),
              h.Width('100%'),
              h.Height('100%'),
              h.AriaHidden(true),
              h.Style({ display: 'block', 'pointer-events': 'none' }),
            ],
            [
              h.circle(
                [
                  h.Cx('50'),
                  h.Cy('50'),
                  h.R('48'),
                  h.Fill('#172554'),
                  h.Stroke(selected ? '#f97316' : '#38bdf8'),
                  h.StrokeWidth(selected ? '3' : '1'),
                ],
                [],
              ),
              h.circle(
                [
                  h.Cx('50'),
                  h.Cy('50'),
                  h.R('41'),
                  h.Fill('none'),
                  h.Stroke('#38bdf8'),
                  h.StrokeWidth('0.4'),
                  h.StrokeDasharray('2 3'),
                ],
                [],
              ),
            ],
          ),
          h.span(
            [
              h.Style({
                position: 'absolute',
                inset: '28px',
                display: 'grid',
                'place-items': 'center',
                'font-size': '16px',
                'font-weight': '700',
                'line-height': '1.3',
                'pointer-events': 'none',
              }),
            ],
            [context.node.label],
          ),
        ],
      ),
      ...(context.resizeHandles.length
        ? [
            flowResizeHandle(
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
      ...context.node.ports.map((port) =>
        flowPort(
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
      ),
    ],
  );
}

export function orbitGroup(context: FlowNodeRenderContext, h: HtmlBuilder<Message>) {
  const selected = context.state.selectedNodes.includes(context.node.id);
  return flowGroupFrame(
    h,
    context,
    [
      h.Class('orbit-boundary'),
      h.Style({
        border: `2px ${context.dropTarget ? 'solid' : 'dotted'} ${selected || context.dropTarget ? '#f97316' : '#38bdf8'}`,
        'border-radius': '28px',
        background: context.collapsed ? '#dbeafe' : 'rgb(56 189 248 / 0.05)',
        padding: '6px',
        display: 'flex',
        gap: '6px',
        'align-items': 'flex-start',
      }),
    ],
    [
      flowDragHandle(
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
        [context.node.label],
      ),
      h.button(
        [
          h.Type('button'),
          h.AriaLabel(`${context.collapsed ? 'Expand' : 'Collapse'} ${context.node.label}`),
          h.AriaExpanded(!context.collapsed),
          h.OnClick(
            Message.ObservedFlowInput({
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
    ],
  );
}
