import type {
  EditorPolicy,
  Endpoint,
  Point,
  Port,
  Size,
  ZlozEdge,
  ZlozGraph,
  ZlozNode,
} from './types';

/** Authored world geometry, independent of DOM measurements and local editor revision. */
export type ZlozNodeFrame = Readonly<{ position: Point; size: Size }>;
export type ZlozGraphOperation =
  | Readonly<{
      type: 'MoveNodes';
      nodes: readonly Readonly<{ id: string; expected: number; position: Point }>[];
    }>
  | Readonly<{
      type: 'ResizeNodes';
      nodes: readonly Readonly<{ id: string; expected: number; frame: ZlozNodeFrame }>[];
    }>
  | Readonly<{ type: 'RenameNode'; id: string; expected: number; label: string }>
  | Readonly<{ type: 'SetNodeIcon'; id: string; expected: number; icon: string | null }>
  | Readonly<{ type: 'AddNode'; expectedVersion: number; node: ZlozNode }>
  | Readonly<{ type: 'ImportEmptyBoard'; expectedVersion: number; graph: ZlozGraph }>
  | Readonly<{ type: 'Connect'; expectedVersion: number; edge: ZlozEdge }>
  | Readonly<{
      type: 'Delete';
      expectedVersion: number;
      nodeIds: readonly string[];
      edgeIds: readonly string[];
    }>
  | Readonly<{ type: 'RemovePort'; expectedVersion: number; endpoint: Endpoint }>
  | Readonly<{ type: 'Undo'; operationId: string }>;
export type ZlozOperationRequest = Readonly<{
  version: 1;
  operationId: string;
  operation: ZlozGraphOperation;
}>;
/** Host-supplied scope, never an assertion accepted from an operation payload. */
export type ZlozOperationScope = Readonly<{ actorId: string; teamId: string; diagramId: string }>;
export type ZlozNodeClock = Readonly<{
  id: string;
  present: boolean;
  version: number;
  geometry: number;
  label: number;
  icon?: number;
  ports: number;
}>;
export type ZlozEdgeClock = Readonly<{ id: string; present: boolean; version: number }>;
export type ZlozNodeChange =
  | Readonly<{
      type: 'geometry';
      id: string;
      expected: number;
      before: ZlozNodeFrame;
      after: ZlozNodeFrame;
    }>
  | Readonly<{ type: 'label'; id: string; expected: number; before: string; after: string }>
  | Readonly<{
      type: 'icon';
      id: string;
      expected: number;
      before: string | null;
      after: string | null;
    }>
  | Readonly<{
      type: 'ports';
      id: string;
      expected: number;
      before: readonly Port[];
      after: readonly Port[];
    }>
  | Readonly<{
      type: 'record';
      id: string;
      expected: number | null;
      before: ZlozNode | null;
      after: ZlozNode | null;
      index: number;
    }>;
export type ZlozEdgeChange = Readonly<{
  id: string;
  expected: number | null;
  before: ZlozEdge | null;
  after: ZlozEdge | null;
  index: number;
}>;
export type ZlozOperationPatch = Readonly<{
  nodes: readonly ZlozNodeChange[];
  edges: readonly ZlozEdgeChange[];
}>;
export type ZlozOperationChange = ZlozOperationPatch &
  ZlozOperationScope &
  Readonly<{
    operationId: string;
    fromVersion: number;
    version: number;
    undoOf: string | null;
  }>;
export type ZlozOperationUndo = Readonly<{
  actorId: string;
  operationId: string;
  inverse: ZlozOperationPatch;
}>;
/** Separate additive protocol: existing graph/snapshot/archive v1 codecs stay unchanged. */
export type ZlozOperationDocument = Readonly<{
  version: number;
  graph: ZlozGraph;
  nodes: readonly ZlozNodeClock[];
  edges: readonly ZlozEdgeClock[];
  undo: readonly ZlozOperationUndo[];
}>;
export type ZlozOperationRejection =
  | 'InvalidOperation'
  | 'Conflict'
  | 'Protected'
  | 'Missing'
  | 'IdentityUsed'
  | 'NoChange'
  | 'UndoUnavailable'
  | 'UnsupportedOperation'
  | 'InvalidGraph';
export type ZlozOperationReceipt = ZlozOperationScope &
  Readonly<{ operationId: string; documentVersion: number }> &
  (
    | Readonly<{ status: 'accepted'; code: null; change: ZlozOperationChange }>
    | Readonly<{ status: 'rejected'; code: ZlozOperationRejection; message: string; change: null }>
  );
export type ZlozOperationDecision = Readonly<{ document: ZlozOperationDocument }> &
  (
    | Readonly<{ type: 'accepted'; receipt: Extract<ZlozOperationReceipt, { status: 'accepted' }> }>
    | Readonly<{ type: 'rejected'; receipt: Extract<ZlozOperationReceipt, { status: 'rejected' }> }>
  );
export type ZlozOperationPolicy = EditorPolicy &
  Readonly<{
    canApplyOperation?: (
      operation: ZlozGraphOperation,
      graph: ZlozGraph,
      scope: ZlozOperationScope,
      change: ZlozOperationChange,
      /** Validated candidate graph, before committing the decision. */
      candidate: ZlozGraph,
    ) => string | null;
  }>;
