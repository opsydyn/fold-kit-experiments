import type { ZlozConnectionsContext } from '@opsydyn/foldkit-zloz/foldkit';
import { createLazy, type HtmlBuilder } from 'foldkit/html';

/** One instance per canvas. FoldKit owns cached VNodes and dispatch frames;
 * this registry drops slots for removed connections on every render. */
export function createConnectionsView<Message>(onSelected: (id: string) => Message) {
  const slots = new Map<string, ReturnType<typeof createLazy>>();
  // The team canvas disables context menus and edge toolbars. Its connection
  // controls need only identity, display text, selection and selection policy.
  const button = (
    h: HtmlBuilder<Message>,
    id: string,
    label: string,
    selected: boolean,
    disabledReason: string | undefined,
  ) =>
    h.button(
      [
        h.Key(id),
        h.AriaLabel(label),
        h.Class('shared-connection'),
        h.Type('button'),
        h.OnClick(onSelected(id)),
        ...(disabledReason === undefined ? [] : [h.Disabled(true), h.Title(disabledReason)]),
        h.AriaPressed(String(selected)),
      ],
      [label],
    );
  return (context: ZlozConnectionsContext, h: HtmlBuilder<Message>) => {
    const present = new Set(context.entries.map(({ edge }) => edge.id));
    for (const id of slots.keys()) if (!present.has(id)) slots.delete(id);
    return h.div(
      [h.Class('shared-connections')],
      context.entries.map((entry) => {
        const slot = slots.get(entry.edge.id) ?? createLazy();
        slots.set(entry.edge.id, slot);
        const endpoints = `${entry.sourceLabel} → ${entry.targetLabel}`;
        const label = entry.edge.label ? `${entry.edge.label} — ${endpoints}` : endpoints;
        return slot(button, [
          h,
          entry.edge.id,
          label,
          entry.selected,
          entry.selectionDisabledReason,
        ]);
      }),
    );
  };
}
