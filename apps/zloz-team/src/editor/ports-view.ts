import type { ZlozNode, Port } from '@opsydyn/foldkit-zloz';
import type { ZlozPortRenderer } from '@opsydyn/foldkit-zloz/foldkit';
import { createLazy, type HtmlBuilder } from 'foldkit/html';

/** Presentation only: Zloz resolves geometry and current policy before each call. */
export function createPortsView<Message>(): ZlozPortRenderer<Message> {
  const slots = new WeakMap<ZlozNode, Map<string, ReturnType<typeof createLazy>>>();
  const button = (
    h: HtmlBuilder<Message>,
    owner: string,
    id: string,
    kind: Port['kind'],
    connectionEnd: 'source' | 'target',
    label: string,
    x: number,
    y: number,
    active: boolean,
    target: boolean,
    disabled: boolean,
    reason: string | null,
  ) =>
    h.button(
      [
        h.Key(`port:${id}`),
        h.Type('button'),
        h.Class(target ? 'shared-node-port is-target' : 'shared-node-port'),
        h.Style({ left: `${x * 100}%`, top: `${y * 100}%` }),
        h.DataAttribute('flow-port', id),
        h.DataAttribute('flow-port-kind', kind),
        h.DataAttribute('flow-connection-end', connectionEnd),
        h.DataAttribute('flow-owner', owner),
        h.Disabled(disabled),
        ...(reason === null ? [] : [h.DataAttribute('flow-port-locked', ''), h.Title(reason)]),
        h.AriaLabel(label),
        h.AriaPressed(String(active)),
      ],
      [kind === 'output' ? '+' : '−'],
    );
  return (context, h) => {
    const { node, port, connectionEnd, anchor, active, target, disabledReason } = context;
    const ports = slots.get(node) ?? new Map<string, ReturnType<typeof createLazy>>();
    slots.set(node, ports);
    const slot = ports.get(port.id) ?? createLazy();
    ports.set(port.id, slot);
    return slot(button, [
      h,
      node.id,
      port.id,
      port.kind,
      connectionEnd,
      `${connectionEnd === 'source' ? 'Connect from' : 'Connect to'} ${node.label}: ${context.label}`,
      anchor.x,
      anchor.y,
      active,
      target,
      context.state.readOnly || disabledReason !== null,
      disabledReason,
    ]);
  };
}
