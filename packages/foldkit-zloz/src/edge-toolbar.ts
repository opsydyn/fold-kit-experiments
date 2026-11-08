import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozEdgeReconnectionContext } from './edge-reconnection';
import type { EdgePathStyle, EditorEvent, ZlozEdge, Point } from './types';

export type ZlozEdgeToolbarAction = Readonly<{
  label: string;
  event: EditorEvent;
  disabledReason?: string;
}>;

export type ZlozEdgeToolbarContext = Readonly<{
  edge: ZlozEdge;
  /** World position shared with the edge label. */
  labelPosition: Point;
  /** Present only when the view opts into endpoint choosers. */
  reconnection?: Readonly<{
    idPrefix: string;
    source: ZlozEdgeReconnectionContext;
    target: ZlozEdgeReconnectionContext;
  }>;
  actions: Readonly<{
    rename: ZlozEdgeToolbarAction;
    deleteEdge: ZlozEdgeToolbarAction;
    changePathStyle: (pathStyle: EdgePathStyle | null) => EditorEvent;
  }>;
}>;

const pathOptions: ReadonlyArray<{ label: string; style: EdgePathStyle | null }> = [
  { label: 'Automatic', style: null },
  { label: 'Straight', style: 'straight' },
  { label: 'Stepped', style: 'stepped' },
  { label: 'Smooth', style: 'smooth' },
];

/** Unstyled native button for a selected edge action. */
export function zlozEdgeToolbarButton<M>(
  h: HtmlBuilder<M>,
  action: ZlozEdgeToolbarAction,
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
      h.OnClick(onEvent(action.event)),
    ],
    children,
  );
}

/** Native select bound to the selected edge's current path style. */
export function zlozEdgePathStyleSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozEdgeToolbarContext,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0],
): Html {
  return h.select(
    [
      ...attributes,
      h.AriaLabel('Selected edge path style'),
      h.OnChange((value) =>
        onEvent(
          context.actions.changePathStyle(
            pathOptions.find(({ style }) => style === value)?.style ?? null,
          ),
        ),
      ),
    ],
    pathOptions.map(({ label, style }) =>
      h.option(
        [h.Value(style ?? 'auto'), h.Selected((context.edge.pathStyle ?? null) === style)],
        [label],
      ),
    ),
  );
}
