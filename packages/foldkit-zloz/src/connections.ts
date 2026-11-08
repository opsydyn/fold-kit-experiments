import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozContextTrigger } from './context-menu';
import type { EditorEvent, ZlozEdge } from './types';

/** Model-derived state for one visible connection. */
export type ZlozConnectionEntry = Readonly<{
  edge: ZlozEdge;
  label: string;
  sourceLabel: string;
  targetLabel: string;
  selected: boolean;
  selectionDisabledReason?: string | undefined;
  contextAction?: ZlozContextTrigger;
  /** Present when the selected edge has a rendered action toolbar. */
  toolbarId?: string;
}>;

export type ZlozConnectionsContext = Readonly<{
  entries: readonly ZlozConnectionEntry[];
  compact: boolean;
  readOnly: boolean;
}>;

const toolbarControl =
  ':is(button, select, input, textarea, a[href], [tabindex]):not(:disabled, input[type="hidden"], [tabindex^="-"], [hidden], [hidden] *, [inert], [inert] *)';

/** Native selection button with the available context and toolbar shortcuts. */
export function zlozConnectionButton<M>(
  h: HtmlBuilder<M>,
  entry: ZlozConnectionEntry,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  const select = onEvent({ type: 'EdgeSelected', id: entry.edge.id, additive: false });
  const { contextAction, toolbarId, selectionDisabledReason } = entry;
  const toolbarSelector = `[id="${toolbarId}"]`;
  return h.button(
    [
      h.Key(entry.edge.id),
      h.AriaLabel(entry.label),
      ...attributes,
      h.Type('button'),
      h.OnClick(select),
      ...(selectionDisabledReason === undefined
        ? []
        : [h.Disabled(true), h.Title(selectionDisabledReason)]),
      h.AriaPressed(String(entry.selected)),
      ...(contextAction && !contextAction.disabled
        ? [
            h.OnKeyDownPreventDefault((key, modifiers) =>
              key === 'ContextMenu' || (key === 'F10' && modifiers.shiftKey)
                ? Option.some(onEvent(contextAction.event))
                : Option.none(),
            ),
          ]
        : []),
      ...(toolbarId
        ? [
            h.AriaControls(toolbarId),
            h.AriaKeyshortcuts('ArrowUp'),
            h.OnKeyDownFocus((key) =>
              key === 'ArrowUp'
                ? Option.some({
                    focusSelector: `${toolbarSelector} ${toolbarControl}, ${toolbarSelector}:not(:has(${toolbarControl}))`,
                    message: select,
                  })
                : Option.none(),
            ),
          ]
        : []),
    ],
    children,
  );
}
