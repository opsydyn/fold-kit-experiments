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
