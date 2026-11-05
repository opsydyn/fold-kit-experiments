import type { BrowserInput } from './input-message';
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
  type WireStart = Extract<
    BrowserInput,
    { type: 'ConnectionDragStarted' | 'ReconnectionDragStarted' }
  >;
  let wire: { start: WireStart; dragging: boolean } | null = null;
  const endpointAt = (target: Element | null, kind: 'input' | 'output'): Endpoint | undefined => {
    const port = target?.closest(`[data-flow-port-kind="${kind}"]`);
    if (port?.closest('[data-flow-surface]') !== element) return undefined;
    const node = port.getAttribute('data-flow-owner');
    const id = port.getAttribute('data-flow-port');
    return node && id ? { node, port: id } : undefined;
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
  const localPoint = (client: Point) => {
    const rect = element.getBoundingClientRect();
    return { x: client.x - rect.left, y: client.y - rect.top };
  };
  const point = (event: MouseEvent) => localPoint({ x: event.clientX, y: event.clientY });
  const wireTarget = (client: Point) =>
    wire
      ? endpointAt(
          element.ownerDocument.elementFromPoint(client.x, client.y),
          wire.start.type === 'ReconnectionDragStarted' && wire.start.end === 'source'
            ? 'output'
            : 'input',
        )
      : undefined;
  const pan = (time: number) => {
    panFrame = null;
    if (captured === null || panPointer === null || element.dataset.flowAutoPan !== 'true') return;
    const location = localPoint(panPointer);
    const x = edgeVelocity(location.x, element.clientWidth);
    const y = edgeVelocity(location.y, element.clientHeight);
    if (x === 0 && y === 0) return;
    const seconds = Math.max(0, Math.min(time - lastPanTime, 32)) / 1000;
    lastPanTime = time;
    const target = wireTarget(panPointer);
    if (seconds > 0) {
      const event = {
        type: 'DragPanned' as const,
        pointer: captured,
        point: location,
        delta: { x: x * seconds, y: y * seconds },
      };
      emit(target ? { ...event, target } : event);
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
  listen('focusout', (event) => {
    if (!(event instanceof window.FocusEvent)) return;
    const panel = targetOf(event)?.closest('[data-flow-context-panel]');
    const next = event.relatedTarget;
    if (panel && (!(next instanceof window.Node) || !panel.contains(next)))
      emit({ type: 'ContextDismissed' });
  });
  listen('pointerdown', (event) => {
    if (!(event instanceof window.PointerEvent) || event.button !== 0) return;
    const target = targetOf(event);
    if (
      target &&
      !target.closest('[data-flow-context-panel]') &&
      element.querySelector('[data-flow-context-panel]')
    )
      emit({ type: 'ContextDismissed' });
    if (!target || editable(target) || target.closest('[data-flow-minimap]')) return;
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
    if (!id && target.closest('button,a,[data-flow-node],[data-flow-edge]')) return;
    captured = event.pointerId;
    element.setPointerCapture(event.pointerId);
    if (
      (!resize || handle?.hasAttribute('data-flow-group-resize')) &&
      handle instanceof window.HTMLElement
    )
      handle.focus({ preventScroll: true });
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
    } else if (event.shiftKey || element.dataset.flowSelectionMode === 'true')
      emit({ type: 'BoxSelectionStarted', pointer: event.pointerId, point: point(event) });
    else {
      emit({ type: 'SelectionCleared' });
      emit({ type: 'PanStarted', pointer: event.pointerId, point: point(event) });
    }
  });
  const movePointer = (event: PointerEvent) => {
    const location = point(event);
    if (wire && !wire.dragging) {
      if (Math.hypot(location.x - wire.start.point.x, location.y - wire.start.point.y) < 5) return;
      wire.dragging = true;
      emit({ ...wire.start, point: location });
    }
    const target = wireTarget({ x: event.clientX, y: event.clientY });
    const moved = { type: 'PointerMoved' as const, pointer: event.pointerId, point: location };
    emit(target ? { ...moved, target } : moved);
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
  listen('click', (event) => {
    const target = targetOf(event);
    if (!target || editable(target)) return;
    const minimap = target.closest('[data-flow-minimap]');
    if (minimap && event instanceof window.MouseEvent) {
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
  listen('wheel', (event) => {
    const target = targetOf(event);
    if (!(event instanceof window.WheelEvent) || !target || editable(target)) return;
    event.preventDefault();
    const pixels =
      event.deltaY *
      (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
    emit({
      type: 'Zoomed',
      point: point(event),
      factor: Math.exp(Math.max(-1, Math.min(1, -pixels * 0.002))),
    });
  });
  listen('keydown', (event) => {
    if (!(event instanceof window.KeyboardEvent)) return;
    const target = targetOf(event);
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
    const id = target.closest('[data-flow-handle]')?.getAttribute('data-flow-handle');
    const step = event.shiftKey ? 20 : 5;
    const resizeHandle = target.closest('[data-flow-group-resize]');
    const groupResize = resizeHandle?.getAttribute('data-flow-resize');
    if (groupResize && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const input: BrowserInput = {
        type: 'GroupResizeNudged',
        id: groupResize,
        delta: {
          x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
          y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
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
        releaseCapture();
        releaseTouches();
        input = { type: 'GestureCancelled' };
        break;
      case 'Delete':
      case 'Backspace':
        input = { type: 'DeletePressed' };
        break;
      case 'ArrowLeft':
        if (id) input = { type: 'SelectionNudged', delta: { x: -step, y: 0 } };
        break;
      case 'ArrowRight':
        if (id) input = { type: 'SelectionNudged', delta: { x: step, y: 0 } };
        break;
      case 'ArrowUp':
        if (id) input = { type: 'SelectionNudged', delta: { x: 0, y: -step } };
        break;
      case 'ArrowDown':
        if (id) input = { type: 'SelectionNudged', delta: { x: 0, y: step } };
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
    if (id && input.type === 'SelectionNudged') emit({ type: 'NodeSelected', id, additive: false });
    emit(input);
  });
  const blur = () => {
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
      panel?.querySelector('button')?.focus();
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
  resize.observe(element);
  measure(element);
  observe();
  return () => {
    for (const [name, handler] of listeners) element.removeEventListener(name, handler);
    window.removeEventListener('blur', blur);
    mutations.disconnect();
    resize.disconnect();
    observed.clear();
    releaseCapture();
    releaseTouches();
  };
}
