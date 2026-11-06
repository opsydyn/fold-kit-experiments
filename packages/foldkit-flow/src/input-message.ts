import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

const Point = Schema.Struct({ x: Schema.Number, y: Schema.Number });
const Pointer = { pointer: Schema.Number };
const Corner = Schema.optionalKey(
  Schema.Literals(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
);
const Handle = Schema.optionalKey(
  Schema.Literals([
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'top',
    'right',
    'bottom',
    'left',
  ]),
);
const Endpoint = Schema.Struct({ node: Schema.String, port: Schema.String });
export const BrowserInput = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('ContextOpened'),
    context: Schema.Struct({
      kind: Schema.Literals(['node', 'edge']),
      id: Schema.String,
      point: Point,
    }),
  }),
  Schema.Struct({ type: Schema.Literal('ContextDismissed') }),
  Schema.Struct({ type: Schema.Literal('NodeFocusChanged'), id: Schema.NullOr(Schema.String) }),
  Schema.Struct({
    type: Schema.Literal('NodeResizeNudged'),
    id: Schema.String,
    delta: Schema.Number,
  }),
  Schema.Struct({
    type: Schema.Literal('NodeSelected'),
    id: Schema.String,
    additive: Schema.Boolean,
  }),
  Schema.Struct({
    type: Schema.Literal('EdgeSelected'),
    id: Schema.String,
    additive: Schema.Boolean,
  }),
  Schema.Struct({
    type: Schema.Literals(['NodeDragStarted', 'NodeResizeStarted']),
    corner: Corner,
    handle: Handle,
    id: Schema.String,
    ...Pointer,
    point: Point,
  }),
  Schema.Struct({ type: Schema.Literal('BoxSelectionStarted'), ...Pointer, point: Point }),
  Schema.Struct({ type: Schema.Literal('PanStarted'), ...Pointer, point: Point }),
  Schema.Struct({
    type: Schema.Literal('ConnectionDragStarted'),
    ...Pointer,
    point: Point,
    endpoint: Endpoint,
  }),
  Schema.Struct({
    type: Schema.Literal('PointerMoved'),
    ...Pointer,
    point: Point,
    target: Schema.optionalKey(Endpoint),
    nearbyTargets: Schema.optionalKey(Schema.Array(Endpoint)),
  }),
  Schema.Struct({
    type: Schema.Literal('ReconnectionDragStarted'),
    id: Schema.String,
    end: Schema.Literals(['source', 'target']),
    ...Pointer,
    point: Point,
  }),
  Schema.Struct({
    type: Schema.Literal('DragPanned'),
    ...Pointer,
    point: Point,
    delta: Point,
    target: Schema.optionalKey(Endpoint),
    nearbyTargets: Schema.optionalKey(Schema.Array(Endpoint)),
  }),
  Schema.Struct({
    type: Schema.Literals(['PinchStarted', 'PinchMoved']),
    center: Point,
    distance: Schema.Number,
  }),
  Schema.Struct({ type: Schema.Literal('PinchEnded') }),
  Schema.Struct({ type: Schema.Literal('PointerReleased'), ...Pointer }),
  Schema.Struct({ type: Schema.Literal('MinimapClicked'), point: Point }),
  Schema.Struct({ type: Schema.Literal('ViewportNudged'), delta: Point }),
  Schema.Struct({
    type: Schema.Literal('FitViewAnimationFrame'),
    id: Schema.Number,
    time: Schema.Number,
    reducedMotion: Schema.Boolean,
  }),
  Schema.Struct({ type: Schema.Literal('Zoomed'), point: Point, factor: Schema.Number }),
  Schema.Struct({
    type: Schema.Literal('SelectionNudged'),
    delta: Point,
    id: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal('GroupResizeNudged'),
    id: Schema.String,
    delta: Point,
    corner: Corner,
    handle: Handle,
  }),
  Schema.Struct({
    type: Schema.Literal('SurfaceMeasured'),
    size: Schema.Struct({ width: Schema.Number, height: Schema.Number }),
  }),
  Schema.Struct({
    type: Schema.Literal('NodeMeasured'),
    id: Schema.String,
    size: Schema.Struct({ width: Schema.Number, height: Schema.Number }),
  }),
  Schema.Struct({
    type: Schema.Literal('PortActivated'),
    endpoint: Endpoint,
  }),
  Schema.Struct({
    type: Schema.Literals([
      'SelectionCleared',
      'GestureCancelled',
      'DeletePressed',
      'CopyPressed',
      'PastePressed',
      'DuplicatePressed',
      'UndoPressed',
      'RedoPressed',
    ]),
  }),
]);
export type BrowserInput = typeof BrowserInput.Type;
export const InputMessage = defineMessageUnion({ ObservedFlowInput: { event: BrowserInput } });
