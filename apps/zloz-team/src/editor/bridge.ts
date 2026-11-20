import { canonicalOperationValue, updateEditor } from '@opsydyn/foldkit-zloz';
import type {
  EditorEvent,
  EditorState,
  ZlozGraphOperation,
  ZlozOperationDocument,
} from '@opsydyn/foldkit-zloz';

const navigation = new Set([
  'NodeFocusChanged',
  'NodeSelected',
  'EdgeSelected',
  'SelectionCleared',
  'NodeDragStarted',
  'NodeResizeStarted',
  'PointerMoved',
  'PointerReleased',
  'GestureCancelled',
  'BoxSelectionStarted',
  'PanStarted',
  'PinchStarted',
  'PinchMoved',
  'PinchEnded',
  'ViewportChanged',
  'ViewportNudged',
  'Zoomed',
  'MinimapClicked',
  'FitViewClicked',
  'FitSelectionClicked',
  'PreviousViewClicked',
  'NodeRevealRequested',
  'EdgeRevealRequested',
  'SurfaceMeasured',
  'SelectionNudged',
  'NodeResizeNudged',
  'NodeWidthChanged',
  'PortActivated',
  'ConnectionDragStarted',
  'ConnectionListToggled',
  'SelectionModeToggled',
  'GroupCollapseToggled',
]);
interface BridgedEvent {
  readonly editor: EditorState;
  readonly operation: ZlozGraphOperation | null;
}

export const isAuthoredGesture = (gesture: EditorState['gesture']) =>
  gesture.type === 'node-drag' ||
  gesture.type === 'node-resize' ||
  gesture.type === 'connection-drag';

/** Local gestures are previews. Only this explicit semantic allow-list may submit. */
export function bridgeEvent(
  editor: EditorState,
  event: EditorEvent,
  base: ZlozOperationDocument,
  identity: string,
): BridgedEvent {
  if (event.type === 'NodeLabelChanged') {
    const clock = base.nodes.find((node) => node.id === event.id);
    return {
      editor,
      operation: clock
        ? { type: 'RenameNode', id: event.id, expected: clock.label, label: event.label }
        : null,
    };
  }
  if (event.type === 'DeletePressed' || event.type === 'EdgeDeleted')
    return {
      editor,
      operation: {
        type: 'Delete',
        expectedVersion: base.version,
        nodeIds: event.type === 'DeletePressed' ? editor.selectedNodes : [],
        edgeIds: event.type === 'EdgeDeleted' ? [event.id] : editor.selectedEdges,
      },
    };
  if (event.type === 'PortRemoved')
    return {
      editor,
      operation: { type: 'RemovePort', expectedVersion: base.version, endpoint: event.endpoint },
    };
  if (event.type === 'ConnectionCreated')
    return {
      editor,
      operation: {
        type: 'Connect',
        expectedVersion: base.version,
        edge: { ...event.edge, id: identity },
      },
    };
  if (!navigation.has(event.type)) return { editor, operation: null };
  const next = updateEditor(editor, event, {
    suppressClickDrift: true,
    canResizeNode: (node) => (node.kind === 'group' ? 'Group resizing is not shared yet' : null),
  });
  const clean = { ...next, past: [], future: [] };
  const settled =
    (event.type === 'PointerReleased' &&
      isAuthoredGesture(editor.gesture) &&
      next.gesture.type === 'idle') ||
    event.type === 'SelectionNudged' ||
    event.type === 'NodeResizeNudged' ||
    event.type === 'NodeWidthChanged' ||
    event.type === 'PortActivated';
  if (!settled) return { editor: clean, operation: null };
  const edge = next.graph.edges.find(
    (candidate) => !base.graph.edges.some((item) => item.id === candidate.id),
  );
  if (edge)
    return {
      editor: clean,
      operation: {
        type: 'Connect',
        expectedVersion: base.version,
        edge: { ...edge, id: identity },
      },
    };
  if (
    event.type === 'PortActivated' ||
    (event.type === 'PointerReleased' && editor.gesture.type === 'connection-drag')
  )
    return { editor: clean, operation: null };
  const changed = next.graph.nodes.filter((node) => {
    const before = base.graph.nodes.find((item) => item.id === node.id);
    return (
      before &&
      (canonicalOperationValue(before.position) !== canonicalOperationValue(node.position) ||
        canonicalOperationValue(before.size) !== canonicalOperationValue(node.size))
    );
  });
  if (!changed.length) return { editor: clean, operation: null };
  const resized = changed.some(
    (node) =>
      canonicalOperationValue(base.graph.nodes.find((item) => item.id === node.id)?.size) !==
      canonicalOperationValue(node.size),
  );
  const geometry = changed.map((node) => ({
    id: node.id,
    expected: base.nodes.find((clock) => clock.id === node.id)!.geometry,
    frame: { position: node.position, size: node.size },
  }));
  return {
    editor: clean,
    operation: resized
      ? { type: 'ResizeNodes', nodes: geometry }
      : {
          type: 'MoveNodes',
          nodes: geometry.map(({ id, expected, frame }) => ({
            id,
            expected,
            position: frame.position,
          })),
        },
  };
}
