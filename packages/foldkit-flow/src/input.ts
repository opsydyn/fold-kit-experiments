import { gridSpacing } from './geometry';
import type { BrowserInput, FlowPortAnchorSnapBypassModifier } from './input-message';
import type { Endpoint, Point } from './types';

function edgeVelocity(position: number, extent: number): number {
  const band = Math.min(48, extent / 3);
  if (band <= 0) return 0;
  const left = Math.max(0, Math.min(1, (band - position) / band));
  const right = Math.max(0, Math.min(1, (position - (extent - band)) / band));
  return 600 * (left - right);
}

/** Native resource boundary. Owns pointer capture, touch samples, frame scheduling, and observers. */
export function bindInput(element: HTMLElement, emit: (event: BrowserInput) => void): () => void {
  const window = element.ownerDocument.defaultView;
  if (!window) return () => {};
  // A new binding has no pointer capture, including after DevTools resumes live input.
  emit({ type: 'GestureCancelled' });
  let captured: number | null = null;
  const touches = new Map<number, Point>();
  let pinching = false;
  let nodeDragOrigin: Point | null = null;
  let panPointer: Point | null = null;
  let panFrame: number | null = null;
  let lastPanTime = 0;
  let backgroundPressed = false;
  let backgroundClickCount = 0;
  let spaceHeld = false;
  let middlePanning = false;
  let anchorDragging = false;
  let anchorModifier: FlowPortAnchorSnapBypassModifier | undefined;
  const configuredAnchorModifier = (): FlowPortAnchorSnapBypassModifier | undefined => {
    const key = element.dataset.flowPortAnchorSnapBypass;
    return key === 'Alt' || key === 'Control' || key === 'Meta' || key === 'Shift'
      ? key
      : undefined;
  };
  const modifierHeld = (
    event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
    key: FlowPortAnchorSnapBypassModifier,
  ) =>
    ({ Alt: event.altKey, Control: event.ctrlKey, Meta: event.metaKey, Shift: event.shiftKey })[
      key
    ];
  type WireStart = Extract<
    BrowserInput,
    { type: 'ConnectionDragStarted' | 'ReconnectionDragStarted' }
  >;
  let wire: { start: WireStart; dragging: boolean } | null = null;
  const endpointAt = (target: Element | null, kind?: 'input' | 'output'): Endpoint | undefined => {
    const selector = kind ? `[data-flow-port-kind="${kind}"]` : '[data-flow-port]';
    const port = target?.closest(selector);
    if (port?.closest('[data-flow-surface]') !== element) return undefined;
    const node = port.getAttribute('data-flow-owner');
    const id = port.getAttribute('data-flow-port');
    return node && id ? { node, port: id } : undefined;
  };
  const anchorEndpointAt = (target: Element | null): Endpoint | undefined => {
    const handle = target?.closest('[data-flow-anchor-port]');
    if (handle?.closest('[data-flow-surface]') !== element) return undefined;
    const node = handle.getAttribute('data-flow-anchor-node');
    const port = handle.getAttribute('data-flow-anchor-port');
    return node && port ? { node, port } : undefined;
  };
  const cornerOf = (handle: Element | null | undefined) => {
    const corner = handle?.getAttribute('data-flow-resize-corner');
    return corner === 'top-left' ||
      corner === 'top-right' ||
      corner === 'bottom-left' ||
      corner === 'bottom-right'
      ? corner
      : undefined;
  };
  const handleOf = (element: Element | null | undefined) => {
    const handle = element?.getAttribute('data-flow-resize-handle');
    switch (handle) {
      case 'top-left':
      case 'top-right':
      case 'bottom-left':
      case 'bottom-right':
      case 'top':
      case 'right':
      case 'bottom':
      case 'left':
        return handle;
      default:
        return undefined;
    }
  };
  const listeners: Array<readonly [string, EventListener]> = [];
  const editable = (target: Element): boolean =>
    target.closest('input,textarea,select,[contenteditable="true"],[data-flow-no-drag]') !== null;
  const targetOf = (event: Event): Element | null => {
    const target = event.target;
    if (!(target instanceof window.Element)) return null;
    const surface = target.closest('[data-flow-surface]');
    return surface === null || surface === element ? target : null;
  };
  const hitsCanvasItem = (target: Element): boolean =>
    target.closest('button,a,[data-flow-node],[data-flow-edge]') !== null;
  const middlePanBackground = (event: Event): boolean => {
    if (element.dataset.flowMiddleButtonPan !== 'true') return false;
    const target = targetOf(event);
    return (
      target !== null &&
      !editable(target) &&
      !hitsCanvasItem(target) &&
      !target.closest(
        '[data-flow-minimap], [data-flow-minimap-frame], [data-flow-context-panel], [data-flow-handle], [data-flow-resize], [data-flow-reconnect], [data-flow-port]',
      )
    );
  };
  const localPoint = (client: Point) => {
    const rect = element.getBoundingClientRect();
    return { x: client.x - rect.left, y: client.y - rect.top };
  };
  const point = (event: MouseEvent) => localPoint({ x: event.clientX, y: event.clientY });
  const wireTargets = (client: Point) => {
    if (!wire) return {};
    const { ownerDocument } = element;
    const target = endpointAt(ownerDocument.elementFromPoint(client.x, client.y));
    if (target) return { target };

    const radius = Number(
      wire.start.type === 'ReconnectionDragStarted'
        ? element.dataset.flowReconnectionDropRadius
        : element.dataset.flowConnectionDropRadius,
    );
    if (!(radius > 0)) return {};
    const surface = element.getBoundingClientRect();
    if (
      client.x < surface.left ||
      client.x >= surface.right ||
      client.y < surface.top ||
      client.y >= surface.bottom
    )
      return {};

    const kind =
      wire.start.type === 'ReconnectionDragStarted' && wire.start.end === 'source'
        ? 'output'
        : 'input';
    const nearby = [];
    for (const port of element.querySelectorAll(`[data-flow-port-kind="${kind}"]`)) {
      const rect = port.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const distance = Math.hypot(client.x - x, client.y - y);
      if (
        distance > radius ||
        ownerDocument.elementFromPoint(x, y)?.closest('[data-flow-port]') !== port
      )
        continue;
      const endpoint = endpointAt(port, kind);
      if (endpoint) nearby.push({ endpoint, distance });
    }
    if (nearby.length === 0) return {};
    nearby.sort((a, b) => a.distance - b.distance);
    return {
      nearbyTargets: nearby.map(({ endpoint, distance }) => ({ ...endpoint, distance })),
    };
  };
  const pan = (time: number) => {
    panFrame = null;
    if (captured === null || panPointer === null || element.dataset.flowAutoPan !== 'true') return;
    const location = localPoint(panPointer);
    const x = edgeVelocity(location.x, element.clientWidth);
    const y = edgeVelocity(location.y, element.clientHeight);
    if (x === 0 && y === 0) return;
    const seconds = Math.max(0, Math.min(time - lastPanTime, 32)) / 1000;
    lastPanTime = time;
    if (seconds > 0) {
      const event = {
        type: 'DragPanned' as const,
        pointer: captured,
        point: location,
        delta: { x: x * seconds, y: y * seconds },
        ...wireTargets(panPointer),
      };
      emit(event);
    }
    panFrame = window.requestAnimationFrame(pan);
  };
  const trackAutoPan = (event: PointerEvent) => {
    if (element.dataset.flowAutoPan !== 'true') return;
    const location = point(event);
    const nodeDragging =
      nodeDragOrigin &&
      Math.hypot(location.x - nodeDragOrigin.x, location.y - nodeDragOrigin.y) >= 4;
    if (!nodeDragging && !wire?.dragging && panPointer === null) return;
    panPointer = { x: event.clientX, y: event.clientY };
    if (panFrame !== null) return;
    lastPanTime = window.performance.now();
    panFrame = window.requestAnimationFrame(pan);
  };
  const stopSingleDrag = () => {
    const pointer = captured;
    captured = null;
    middlePanning = false;
    anchorDragging = false;
    anchorModifier = undefined;
    wire = null;
    nodeDragOrigin = null;
    panPointer = null;
    if (panFrame !== null) window.cancelAnimationFrame(panFrame);
    panFrame = null;
    return pointer;
  };
  const releasePointer = (pointer: number) => {
    if (element.hasPointerCapture?.(pointer)) element.releasePointerCapture(pointer);
  };
  const releaseCapture = () => {
    const pointer = stopSingleDrag();
    if (pointer !== null) releasePointer(pointer);
  };
  const releaseTouches = () => {
    const pointers = [...touches.keys()];
    touches.clear();
    pinching = false;
    pointers.forEach(releasePointer);
  };
  const clientPoint = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });
  const emitPinch = (type: 'PinchStarted' | 'PinchMoved') => {
    const [first, second] = touches.values();
    if (!first || !second) return;
    emit({
      type,
      center: localPoint({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }),
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    });
  };
  const listen = (name: string, handler: EventListener) => {
    element.addEventListener(name, handler, { passive: false });
    listeners.push([name, handler]);
  };
  const openContext = (target: Element, location: Point) => {
    if (element.dataset.flowContextActions !== 'true' || captured !== null || pinching)
      return false;
    if (target.closest('input,textarea,select,[contenteditable="true"],[data-flow-context-panel]'))
      return false;
    const edge = target.closest('[data-flow-edge],[data-flow-context-edge]');
    const edgeId =
      edge?.getAttribute('data-flow-edge') ?? edge?.getAttribute('data-flow-context-edge');
    const node = target.closest('[data-flow-node],[data-flow-handle]');
    const nodeId = node?.getAttribute('data-flow-node') ?? node?.getAttribute('data-flow-handle');
    if (edgeId)
      emit({ type: 'ContextOpened', context: { kind: 'edge', id: edgeId, point: location } });
    else if (nodeId)
      emit({ type: 'ContextOpened', context: { kind: 'node', id: nodeId, point: location } });
    else return false;
    return true;
  };
  listen('contextmenu', (event) => {
    const target = targetOf(event);
    if (event instanceof window.MouseEvent && target && openContext(target, point(event)))
      event.preventDefault();
  });
  let focusedNode: string | null = null;
  const trackNodeFocus = (target: Element | null) => {
    const frame = target?.closest('[data-flow-node], [data-flow-group]');
    const id =
      frame?.closest('[data-flow-surface]') === element
        ? (frame.getAttribute('data-flow-node') ?? frame.getAttribute('data-flow-group'))
        : null;
    if (id === focusedNode) return;
    focusedNode = id;
    emit({ type: 'NodeFocusChanged', id });
  };
  listen('focusin', (event) => trackNodeFocus(targetOf(event)));
  listen('focusout', (event) => {
    if (!(event instanceof window.FocusEvent)) return;
    if (event.target === element) spaceHeld = false;
    const panel = targetOf(event)?.closest('[data-flow-context-panel]');
    const next = event.relatedTarget;
    trackNodeFocus(next instanceof window.Element ? next : null);
    if (panel && (!(next instanceof window.Node) || !panel.contains(next)))
      emit({ type: 'ContextDismissed' });
  });
  listen('pointerdown', (event) => {
    if (!(event instanceof window.PointerEvent)) return;
    if (event.button === 1) {
      if (captured !== null || pinching || !middlePanBackground(event)) return;
      backgroundPressed = false;
      backgroundClickCount = 0;
      middlePanning = true;
      captured = event.pointerId;
      element.setPointerCapture(event.pointerId);
      element.focus({ preventScroll: true });
      event.preventDefault();
      emit({ type: 'PanStarted', pointer: event.pointerId, point: point(event) });
      return;
    }
    if (event.button !== 0) return;
    backgroundPressed = false;
    const target = targetOf(event);
    if (
      target &&
      !target.closest('[data-flow-context-panel]') &&
      element.querySelector('[data-flow-context-panel]')
    )
      emit({ type: 'ContextDismissed' });
    if (
      !target ||
      editable(target) ||
      target.closest('[data-flow-port]:disabled,[data-flow-anchor-port]:disabled') ||
      target.closest('[data-flow-minimap], [data-flow-minimap-frame]')
    )
      return;
    if (event.pointerType === 'touch' && element.dataset.flowPinchZoom === 'true') {
      if (touches.size >= 2) {
        element.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (captured !== null && !touches.has(captured)) return;
      touches.set(event.pointerId, clientPoint(event));
      if (touches.size === 2) {
        stopSingleDrag();
        pinching = true;
        for (const pointer of touches.keys()) element.setPointerCapture(pointer);
        element.focus({ preventScroll: true });
        event.preventDefault();
        emitPinch('PinchStarted');
        return;
      }
    }
    if (captured !== null || pinching) return;
    const anchor = anchorEndpointAt(target);
    if (anchor && element.dataset.flowReadonly !== 'true') {
      anchorDragging = true;
      anchorModifier = configuredAnchorModifier();
      captured = event.pointerId;
      element.setPointerCapture(event.pointerId);
      if (target instanceof window.HTMLElement) target.focus({ preventScroll: true });
      event.preventDefault();
      const input: Extract<BrowserInput, { type: 'PortAnchorDragStarted' }> = {
        type: 'PortAnchorDragStarted',
        endpoint: anchor,
        pointer: event.pointerId,
        point: point(event),
      };
      emit(
        anchorModifier
          ? {
              ...input,
              snapBypassed: modifierHeld(event, anchorModifier),
              snapBypassModifier: anchorModifier,
            }
          : input,
      );
      return;
    }
    const output = endpointAt(target, 'output');
    const handleEdge = target.closest('[data-flow-reconnect]');
    const edgeId = handleEdge?.getAttribute('data-flow-reconnect');
    const end = handleEdge?.getAttribute('data-flow-edge-end');
    const origin = point(event);
    const start: WireStart | null =
      edgeId && (end === 'source' || end === 'target')
        ? {
            type: 'ReconnectionDragStarted',
            id: edgeId,
            end,
            pointer: event.pointerId,
            point: origin,
          }
        : output
          ? {
              type: 'ConnectionDragStarted',
              endpoint: output,
              pointer: event.pointerId,
              point: origin,
            }
          : null;
    if (start && element.dataset.flowReadonly !== 'true') {
      captured = event.pointerId;
      wire = { start, dragging: false };
      element.setPointerCapture(event.pointerId);
      if (target instanceof window.HTMLElement) target.focus({ preventScroll: true });
      else element.focus({ preventScroll: true });
      event.preventDefault();
      return;
    }
    const resize = target.closest('[data-flow-resize]');
    const handle = resize ?? target.closest('[data-flow-handle]');
    const id = handle?.getAttribute(resize ? 'data-flow-resize' : 'data-flow-handle');
    if (id && !resize && event.shiftKey) {
      emit({ type: 'NodeSelected', id, additive: true });
      return;
    }
    if (id && element.dataset.flowReadonly === 'true') {
      emit({ type: 'NodeSelected', id, additive: false });
      return;
    }
    if (!id && hitsCanvasItem(target)) return;
    captured = event.pointerId;
    element.setPointerCapture(event.pointerId);
    if (handle instanceof window.HTMLElement) handle.focus({ preventScroll: true });
    else element.focus({ preventScroll: true });
    event.preventDefault();
    if (id) {
      if (!resize) nodeDragOrigin = origin;
      const input: BrowserInput = {
        type: resize ? 'NodeResizeStarted' : 'NodeDragStarted',
        id,
        pointer: event.pointerId,
        point: origin,
      };
      const corner = cornerOf(resize);
      const handle = handleOf(resize);
      emit(handle ? { ...input, handle } : corner ? { ...input, corner } : input);
    } else if (spaceHeld && element.dataset.flowSpaceToPan === 'true')
      emit({ type: 'PanStarted', pointer: event.pointerId, point: origin });
    else if (element.dataset.flowZoomAreaMode === 'true')
      emit({ type: 'ZoomAreaStarted', pointer: event.pointerId, point: origin });
    else if (event.shiftKey || element.dataset.flowSelectionMode === 'true')
      emit({ type: 'BoxSelectionStarted', pointer: event.pointerId, point: origin });
    else {
      backgroundPressed = Boolean(element.dataset.flowDoubleClickZoom);
      emit({ type: 'SelectionCleared' });
      emit({ type: 'PanStarted', pointer: event.pointerId, point: origin });
    }
  });
  const movePointer = (event: PointerEvent) => {
    const location = point(event);
    if (wire && !wire.dragging) {
      if (Math.hypot(location.x - wire.start.point.x, location.y - wire.start.point.y) < 5) return;
      wire.dragging = true;
      emit({ ...wire.start, point: location });
    }
    const input: Extract<BrowserInput, { type: 'PointerMoved' }> = {
      type: 'PointerMoved',
      pointer: event.pointerId,
      point: location,
      ...wireTargets(event),
    };
    emit(
      anchorDragging && anchorModifier
        ? { ...input, portAnchorSnapBypassed: modifierHeld(event, anchorModifier) }
        : input,
    );
  };
  listen('pointermove', (event) => {
    if (!(event instanceof window.PointerEvent)) return;
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, clientPoint(event));
      if (pinching) {
        event.preventDefault();
        emitPinch('PinchMoved');
        return;
      }
    }
    if (event.pointerId !== captured) return;
    movePointer(event);
    // A mouse chord reports middle release in a move while another button is held.
    if (middlePanning && (event.buttons & 4) === 0) {
      emit({ type: 'PointerReleased', pointer: event.pointerId });
      releaseCapture();
      return;
    }
    trackAutoPan(event);
  });
  listen('pointerup', (event) => {
    if (!(event instanceof window.PointerEvent)) return;
    if (touches.delete(event.pointerId) && pinching) {
      pinching = false;
      event.preventDefault();
      emit({ type: 'PinchEnded' });
      return;
    }
    if (event.pointerId !== captured) return;
    movePointer(event);
    if (wire && !wire.dragging && wire.start.type === 'ConnectionDragStarted') {
      const output = endpointAt(
        element.ownerDocument.elementFromPoint(event.clientX, event.clientY),
        'output',
      );
      if (output?.node === wire.start.endpoint.node && output.port === wire.start.endpoint.port)
        emit({ type: 'PortActivated', endpoint: wire.start.endpoint });
    } else {
      emit({ type: 'PointerReleased', pointer: event.pointerId });
    }
    releaseCapture();
  });
  const cancelled: EventListener = (event) => {
    if (!(event instanceof window.PointerEvent)) return;
    if (touches.delete(event.pointerId) && pinching) {
      releaseTouches();
      emit({ type: 'GestureCancelled' });
      return;
    }
    if (event.pointerId !== captured) return;
    releaseCapture();
    emit({ type: 'GestureCancelled' });
  };
  listen('pointercancel', cancelled);
  listen('lostpointercapture', (event) => {
    if (event.target === element) cancelled(event);
  });
  listen('auxclick', (event) => {
    if (event instanceof window.MouseEvent && event.button === 1 && middlePanBackground(event))
      event.preventDefault();
  });
  listen('click', (event) => {
    const target = targetOf(event);
    // Capture can retarget the click to the surface. Use the original press to
    // distinguish a pane click from a control or a consumed marquee gesture.
    if (event instanceof window.MouseEvent && event.detail > 0) {
      if (!backgroundPressed) backgroundClickCount = 0;
      else if (event.detail === 1) backgroundClickCount = 1;
      else backgroundClickCount += 1;
      backgroundPressed = false;
    }
    if (!target || editable(target)) return;
    const minimap =
      target.closest('[data-flow-minimap]') ??
      target.closest('[data-flow-minimap-frame]')?.querySelector('[data-flow-minimap]');
    if (minimap && event instanceof window.MouseEvent) {
      if (event.detail === 0) {
        emit({ type: 'MinimapClicked', point: { x: 0.5, y: 0.5 } });
        return;
      }
      const bounds = minimap.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0)
        emit({
          type: 'MinimapClicked',
          point: {
            x: (event.clientX - bounds.left) / bounds.width,
            y: (event.clientY - bounds.top) / bounds.height,
          },
        });
      return;
    }
    const port = target.closest('[data-flow-port]');
    const node = port?.getAttribute('data-flow-owner');
    const id = port?.getAttribute('data-flow-port');
    if (node && id) {
      emit({ type: 'PortActivated', endpoint: { node, port: id } });
      return;
    }
    const edge = target.closest('[data-flow-edge]')?.getAttribute('data-flow-edge');
    if (edge) {
      emit({
        type: 'EdgeSelected',
        id: edge,
        additive: event instanceof window.MouseEvent && event.shiftKey,
      });
      return;
    }
    const handle = target.closest('[data-flow-handle]')?.getAttribute('data-flow-handle');
    if (handle && event instanceof window.MouseEvent && event.detail === 0)
      emit({ type: 'NodeSelected', id: handle, additive: event.shiftKey });
  });
  listen('dblclick', (event) => {
    if (backgroundClickCount < 2 || !(event instanceof window.MouseEvent) || !targetOf(event))
      return;
    backgroundClickCount = 0;
    const factor = Number(element.dataset.flowDoubleClickZoom);
    if (!Number.isFinite(factor) || factor <= 1) return;
    event.preventDefault();
    emit({ type: 'Zoomed', point: point(event), factor });
  });
  listen('wheel', (event) => {
    const target = targetOf(event);
    if (!(event instanceof window.WheelEvent) || !target || editable(target)) return;
    const navigation = element.dataset.flowWheelNavigation;
    if (navigation === 'off') return;
    event.preventDefault();
    const pixels =
      event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
    if (navigation === 'pan' && !event.ctrlKey && !event.metaKey) {
      const horizontal =
        event.deltaX *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1);
      emit({ type: 'ViewportNudged', delta: { x: -horizontal, y: -pixels } });
      return;
    }
    emit({
      type: 'Zoomed',
      point: point(event),
      factor: Math.exp(Math.max(-1, Math.min(1, -pixels * 0.002))),
    });
  });
  listen('keydown', (event) => {
    if (!(event instanceof window.KeyboardEvent)) return;
    if (anchorDragging && captured !== null && anchorModifier && event.key === anchorModifier) {
      event.preventDefault();
      if (!event.repeat)
        emit({
          type: 'PortAnchorSnapBypassChanged',
          pointer: captured,
          bypassed: modifierHeld(event, anchorModifier),
        });
      return;
    }
    const target = targetOf(event);
    if (
      target === element &&
      event.key === ' ' &&
      element.dataset.flowSpaceToPan === 'true' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      if (!event.repeat) spaceHeld = true;
      event.preventDefault();
      return;
    }
    if (target && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
      const rect = target.getBoundingClientRect();
      if (openContext(target, localPoint({ x: rect.left, y: rect.bottom }))) event.preventDefault();
      return;
    }
    if (target?.closest('[data-flow-context-panel]') && event.key === 'Escape') {
      event.preventDefault();
      element.focus({ preventScroll: true });
      emit({ type: 'ContextDismissed' });
      return;
    }
    if (!target || editable(target)) return;
    const anchor = anchorEndpointAt(target);
    if (
      anchor &&
      element.dataset.flowAnchorKeyboardTargets === 'true' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      ['PageDown', 'PageUp', 'Home', 'End'].includes(event.key)
    ) {
      if (
        target.closest('[data-flow-anchor-port]:disabled') ||
        element.dataset.flowReadonly === 'true'
      )
        return;
      event.preventDefault();
      if (!event.repeat && captured === null && !pinching)
        emit({
          type: 'PortAnchorTargetStepped',
          endpoint: anchor,
          step:
            event.key === 'PageDown'
              ? 'next'
              : event.key === 'PageUp'
                ? 'previous'
                : event.key === 'Home'
                  ? 'first'
                  : 'last',
        });
      return;
    }
    if (anchor && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      if (target.closest('[data-flow-anchor-port]:disabled')) return;
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 0.01;
      emit({
        type: 'PortAnchorNudged',
        endpoint: anchor,
        delta: {
          x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
          y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
        },
      });
      return;
    }
    const id = target.closest('[data-flow-handle]')?.getAttribute('data-flow-handle');
    const step = event.shiftKey ? 20 : 5;
    const nodeResize = target
      .closest('[data-flow-resize]:not([data-flow-group-resize])')
      ?.getAttribute('data-flow-resize');
    if (nodeResize && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const configured = Number(element.dataset.flowGridSpacing);
      const spacing = Number.isFinite(configured) && configured > 0 ? configured : gridSpacing;
      const resizeStep =
        element.dataset.flowGridSnap === 'true' ? spacing * (event.shiftKey ? 4 : 1) : step;
      emit({
        type: 'NodeResizeNudged',
        id: nodeResize,
        delta: event.key === 'ArrowLeft' ? -resizeStep : resizeStep,
      });
      return;
    }
    const resizeHandle = target.closest('[data-flow-group-resize]');
    const groupResize = resizeHandle?.getAttribute('data-flow-resize');
    if (groupResize && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const configured = Number(element.dataset.flowGridSpacing);
      const spacing = Number.isFinite(configured) && configured > 0 ? configured : gridSpacing;
      const resizeStep =
        element.dataset.flowGridSnap === 'true' ? spacing * (event.shiftKey ? 4 : 1) : step;
      const input: BrowserInput = {
        type: 'GroupResizeNudged',
        id: groupResize,
        delta: {
          x: event.key === 'ArrowLeft' ? -resizeStep : event.key === 'ArrowRight' ? resizeStep : 0,
          y: event.key === 'ArrowUp' ? -resizeStep : event.key === 'ArrowDown' ? resizeStep : 0,
        },
      };
      const corner = cornerOf(resizeHandle);
      const handle = handleOf(resizeHandle);
      emit(handle ? { ...input, handle } : corner ? { ...input, corner } : input);
      return;
    }
    let input: BrowserInput | null = null;
    switch (event.key) {
      case 'Escape':
        spaceHeld = false;
        releaseCapture();
        releaseTouches();
        input = { type: 'GestureCancelled' };
        break;
      case 'Delete':
      case 'Backspace':
        input = { type: 'DeletePressed' };
        break;
      case 'ArrowLeft':
        if (id) input = { type: 'SelectionNudged', id, delta: { x: -step, y: 0 } };
        break;
      case 'ArrowRight':
        if (id) input = { type: 'SelectionNudged', id, delta: { x: step, y: 0 } };
        break;
      case 'ArrowUp':
        if (id) input = { type: 'SelectionNudged', id, delta: { x: 0, y: -step } };
        break;
      case 'ArrowDown':
        if (id) input = { type: 'SelectionNudged', id, delta: { x: 0, y: step } };
        break;
      case 'z':
      case 'Z':
        if (event.ctrlKey || event.metaKey)
          input = { type: event.shiftKey ? 'RedoPressed' : 'UndoPressed' };
        break;
      case 'c':
        if (event.ctrlKey || event.metaKey) input = { type: 'CopyPressed' };
        break;
      case 'v':
        if (event.ctrlKey || event.metaKey) input = { type: 'PastePressed' };
        break;
      case 'd':
        if (event.ctrlKey || event.metaKey) input = { type: 'DuplicatePressed' };
        break;
      case 'y':
        if (event.ctrlKey || event.metaKey) input = { type: 'RedoPressed' };
        break;
    }
    if (!input) return;
    event.preventDefault();
    emit(input);
  });
  listen('keyup', (event) => {
    if (
      event instanceof window.KeyboardEvent &&
      anchorDragging &&
      captured !== null &&
      anchorModifier &&
      event.key === anchorModifier
    ) {
      event.preventDefault();
      emit({
        type: 'PortAnchorSnapBypassChanged',
        pointer: captured,
        bypassed: modifierHeld(event, anchorModifier),
      });
    }
    if (event instanceof window.KeyboardEvent && event.key === ' ') spaceHeld = false;
  });
  const blur = () => {
    spaceHeld = false;
    const active = captured !== null || pinching;
    releaseCapture();
    releaseTouches();
    if (active) emit({ type: 'GestureCancelled' });
  };
  window.addEventListener('blur', blur);
  const observed = new Set<Element>();
  const measure = (node: Element) => {
    if (!(node instanceof window.HTMLElement)) return;
    if (node === element) {
      if (element.clientWidth > 0 && element.clientHeight > 0)
        emit({
          type: 'SurfaceMeasured',
          size: { width: element.clientWidth, height: element.clientHeight },
        });
      return;
    }
    const id = node.dataset.flowNode;
    if (id && node.offsetWidth > 0 && node.offsetHeight > 0)
      emit({
        type: 'NodeMeasured',
        id,
        size: { width: node.offsetWidth, height: node.offsetHeight },
      });
  };
  const resize = new window.ResizeObserver((entries) =>
    entries.forEach((entry) => measure(entry.target)),
  );
  let focusedPanel: Element | null = null;
  const observe = () => {
    const panel = element.querySelector('[data-flow-context-panel]');
    if (panel !== focusedPanel) {
      focusedPanel = panel;
      if (panel instanceof window.HTMLElement) {
        const controls = panel.querySelectorAll(
          'button, select, input:not([type="hidden"]), textarea, a[href], [tabindex]',
        );
        for (const control of controls) {
          if (
            !(control instanceof window.HTMLElement) ||
            control.tabIndex < 0 ||
            control.matches(':disabled') ||
            control.closest('[hidden], [inert]')
          )
            continue;
          control.focus();
          if (window.document.activeElement === control) break;
        }
        if (!panel.contains(window.document.activeElement)) panel.focus({ preventScroll: true });
      }
    }
    const nodes = new Set(element.querySelectorAll('[data-flow-node]'));
    for (const node of observed)
      if (!nodes.has(node)) {
        resize.unobserve(node);
        observed.delete(node);
      }
    for (const node of nodes)
      if (!observed.has(node)) {
        observed.add(node);
        resize.observe(node);
        measure(node);
      }
  };
  const mutations = new window.MutationObserver(observe);
  mutations.observe(element, { childList: true, subtree: true });
  let fitFrame: number | null = null;
  const scheduleFitFrame = () => {
    const id = Number(element.dataset.flowFitAnimation);
    if (fitFrame !== null || !Number.isSafeInteger(id) || id <= 0) return;
    fitFrame = window.requestAnimationFrame((time) => {
      fitFrame = null;
      if (Number(element.dataset.flowFitAnimation) === id)
        emit({
          type: 'FitViewAnimationFrame',
          id,
          time,
          reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        });
      scheduleFitFrame();
    });
  };
  const fitMutations = new window.MutationObserver(scheduleFitFrame);
  fitMutations.observe(element, { attributeFilter: ['data-flow-fit-animation'] });
  scheduleFitFrame();
  resize.observe(element);
  measure(element);
  observe();
  trackNodeFocus(element.ownerDocument.activeElement);
  return () => {
    for (const [name, handler] of listeners) element.removeEventListener(name, handler);
    window.removeEventListener('blur', blur);
    mutations.disconnect();
    fitMutations.disconnect();
    if (fitFrame !== null) window.cancelAnimationFrame(fitFrame);
    resize.disconnect();
    observed.clear();
    releaseCapture();
    releaseTouches();
  };
}

/** Scoped overview clicks are independent of the canvas's pointer/measurement resource. */
export function bindMinimapInput(
  element: Element,
  emit: (event: BrowserInput) => void,
): () => void {
  const window = element.ownerDocument.defaultView;
  const clicked = (event: Event) => {
    if (
      !window ||
      !(event instanceof window.MouseEvent) ||
      element.getAttribute('disabled') !== null
    )
      return;
    const plane = element.querySelector('[data-flow-minimap]');
    if (!plane) return;
    event.stopPropagation();
    if (event.detail === 0) {
      emit({ type: 'MinimapClicked', point: { x: 0.5, y: 0.5 } });
      return;
    }
    const bounds = plane.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0)
      emit({
        type: 'MinimapClicked',
        point: {
          x: (event.clientX - bounds.left) / bounds.width,
          y: (event.clientY - bounds.top) / bounds.height,
        },
      });
  };
  element.addEventListener('click', clicked);
  return () => element.removeEventListener('click', clicked);
}
