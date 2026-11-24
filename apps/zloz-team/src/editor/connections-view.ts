import type { ZlozConnectionsContext } from '@opsydyn/foldkit-zloz/foldkit';
import { createKeyedLazy, type HtmlBuilder } from 'foldkit/html';

const workshopLinkLabels = {
  produces: 'Produces',
  activates: 'Activates',
  triggers: 'Triggers',
} as const;

/** One instance per canvas. FoldKit owns cached VNodes and dispatch frames; the keyed
 * cache releases the slot for a connection absent from a completed render, which is
 * `createKeyedLazy`'s default since FoldKit 0.171. */
export function createConnectionsView<Message>(onSelected: (id: string) => Message) {
  const connection = createKeyedLazy();
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
  return (context: ZlozConnectionsContext, h: HtmlBuilder<Message>) =>
    h.div(
      [h.Class('shared-connections')],
      context.entries.map((entry) => {
        const meaning = entry.edge.architecture;
        const verb =
          meaning?.family === 'event-storming' &&
          (meaning.role === 'produces' ||
            meaning.role === 'activates' ||
            meaning.role === 'triggers')
            ? meaning.role
            : null;
        const endpoints = verb
          ? `${entry.sourceLabel} ${verb} ${entry.targetLabel}`
          : `${entry.sourceLabel} → ${entry.targetLabel}`;
        const label =
          entry.edge.label && !(verb && entry.edge.label === workshopLinkLabels[verb])
            ? `${entry.edge.label} — ${endpoints}`
            : endpoints;
        // Keyed by the same id as h.Key, so the memo and the DOM invalidate together.
        return connection(entry.edge.id, button, [
          h,
          entry.edge.id,
          label,
          entry.selected,
          entry.selectionDisabledReason,
        ]);
      }),
    );
}
