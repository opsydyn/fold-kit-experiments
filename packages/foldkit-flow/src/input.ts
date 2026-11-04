import type { BrowserInput } from './input-message';
import type { Endpoint } from './types';

/** Native resource boundary. Only pointer capture and observer lifetimes are retained. */
export function bindInput(element: HTMLElement, emit: (event: BrowserInput) => void): () => void {
  const window = element.ownerDocument.defaultView;
  if (!window) return () => {};
  // A new binding has no pointer capture, including after DevTools resumes live input.
  emit({ type: 'GestureCancelled' });
  let captured: number | null = null;
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
  const listeners: Array<readonly [string, EventListener]> = [];
  const editable = (target: Element): boolean =>
    target.closest('input,textarea,select,[contenteditable="true"],[data-flow-no-drag]') !== null;
  const targetOf = (event: Event): Element | null => {
    const target = event.target;
    if (!(target instanceof window.Element)) return null;
    const surface = target.closest('[data-flow-surface]');
    return surface === null || surface === element ? target : null;
  };
  const point = (event: MouseEvent) => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const releaseCapture = () => {
    const pointer = captured;
    captured = null;
    wire = null;
    if (pointer !== null && element.hasPointerCapture?.(pointer))
      element.releasePointerCapture(pointer);
  };
  const listen = (name: string, handler: EventListener) => {
    element.addEventListener(name, handler, { passive: false });
    listeners.push([name, handler]);
  };
  listen('pointerdown', (event) => {
    if (!(event instanceof window.PointerEvent) || event.button !== 0 || captured !== null) return;
    const target = targetOf(event);
    if (!target || editable(target) || target.closest('[data-flow-minimap]')) return;
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
    if (!resize && handle instanceof window.HTMLElement) handle.focus({ preventScroll: true });
    else element.focus({ preventScroll: true });
    event.preventDefault();
    if (id)
      emit({
        type: resize ? 'NodeResizeStarted' : 'NodeDragStarted',
        id,
        pointer: event.pointerId,
        point: point(event),
      });
    else if (event.shiftKey)
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
    const target = wire
      ? endpointAt(
          element.ownerDocument.elementFromPoint(event.clientX, event.clientY),
          wire.start.type === 'ReconnectionDragStarted' && wire.start.end === 'source'
            ? 'output'
            : 'input',
        )
      : undefined;
    const moved = { type: 'PointerMoved' as const, pointer: event.pointerId, point: location };
    emit(target ? { ...moved, target } : moved);
  };
  listen('pointermove', (event) => {
    if (event instanceof window.PointerEvent && event.pointerId === captured) movePointer(event);
  });
  listen('pointerup', (event) => {
    if (!(event instanceof window.PointerEvent) || event.pointerId !== captured) return;
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
    if (!(event instanceof window.PointerEvent) || event.pointerId !== captured) return;
    releaseCapture();
    emit({ type: 'GestureCancelled' });
  };
  listen('pointercancel', cancelled);
  listen('lostpointercapture', cancelled);
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
    if (!target || editable(target)) return;
    const id = target.closest('[data-flow-handle]')?.getAttribute('data-flow-handle');
    const step = event.shiftKey ? 20 : 5;
    let input: BrowserInput | null = null;
    switch (event.key) {
      case 'Escape':
        releaseCapture();
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
    if (captured !== null) {
      releaseCapture();
      emit({ type: 'GestureCancelled' });
    }
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
  const observe = () => {
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
  };
}
