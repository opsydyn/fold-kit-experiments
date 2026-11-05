import type { Html, HtmlBuilder } from 'foldkit/html';

import type { EdgePathStyle, EditorEvent, FlowEdge, Point } from './types';

export type FlowEdgeToolbarAction = Readonly<{ label: string; event: EditorEvent }>;

export type FlowEdgeToolbarContext = Readonly<{
  edge: FlowEdge;
  /** World position shared with the edge label. */
  labelPosition: Point;
  actions: Readonly<{
    rename: FlowEdgeToolbarAction;
    deleteEdge: FlowEdgeToolbarAction;
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
export function flowEdgeToolbarButton<M>(
  h: HtmlBuilder<M>,
  action: FlowEdgeToolbarAction,
  onEvent: (event: EditorEvent) => M,
  attributes: Parameters<HtmlBuilder<M>['button']>[0],
  children: Parameters<HtmlBuilder<M>['button']>[1],
): Html {
  return h.button(
    [...attributes, h.Type('button'), h.AriaLabel(action.label), h.OnClick(onEvent(action.event))],
    children,
  );
}

/** Native select bound to the selected edge's current path style. */
export function flowEdgePathStyleSelect<M>(
  h: HtmlBuilder<M>,
  context: FlowEdgeToolbarContext,
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
