import type { ZlozPlacementInput } from './placement-controls';

/** Scoped native boundary: coordinates are remeasured for every pointer sample. */
export function bindPlacementInput(
  element: HTMLElement,
  emit: (input: ZlozPlacementInput) => void,
): () => void {
  const window = element.ownerDocument.defaultView;
  if (!window) return () => {};
  const identity = () => ({
    scope: element.dataset.zlozPlacementScope ?? '',
    generation: Number(element.dataset.zlozPlacementGeneration),
    targetRevision: Number(element.dataset.zlozPlacementTargetRevision),
  });
  const active = () => element.dataset.zlozPlacementActive === 'true';
  const surface = () =>
    [...element.querySelectorAll<HTMLElement>('[data-flow-surface]')].find(
      (candidate) => candidate.closest('[data-zloz-placement-host]') === element,
    );
  const owner = (target: EventTarget | null) =>
    target instanceof window.Element && target.closest('[data-zloz-placement-host]') === element
      ? target
      : null;
  let pointer: (ReturnType<typeof identity> & { id: number }) | null = null;
  const stop = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const sample = (event: PointerEvent, commit: boolean) => {
    const bounds = surface()?.getBoundingClientRect();
    if (!pointer || !bounds || bounds.width <= 0 || bounds.height <= 0) return;
    emit({
      type: 'PlacementPointed',
      scope: pointer.scope,
      generation: pointer.generation,
      point: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      bypassed: event.altKey,
      commit,
    });
  };
  const release = () => {
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && element.hasPointerCapture?.(id)) element.releasePointerCapture(id);
  };
  const cancel = () => {
    const token = pointer ?? identity();
    if (pointer || active())
      emit({ type: 'PlacementDismissed', scope: token.scope, generation: token.generation });
    release();
  };
  const down = (raw: Event) => {
    if (!(raw instanceof window.PointerEvent) || raw.button !== 0) return;
    const target = owner(raw.target);
    if (!target) return;
    const entry = target.closest<HTMLButtonElement>('[data-zloz-palette-entry]');
    if (entry && !entry.disabled && !pointer) {
      stop(raw);
      entry.focus();
      const token = identity();
      emit({
        type: 'PaletteEntryActivated',
        scope: token.scope,
        generation: token.generation,
        id: entry.dataset.zlozPaletteEntry ?? '',
      });
      pointer = { ...token, generation: token.generation + 1, id: raw.pointerId };
    } else if (active() && target.closest('[data-flow-surface]') && !pointer) {
      stop(raw);
      pointer = { ...identity(), id: raw.pointerId };
      sample(raw, false);
    } else return;
    element.setPointerCapture?.(raw.pointerId);
  };
  const move = (raw: Event) => {
    if (!(raw instanceof window.PointerEvent) || raw.pointerId !== pointer?.id) return;
    stop(raw);
    sample(raw, false);
  };
  const up = (raw: Event) => {
    if (!(raw instanceof window.PointerEvent) || raw.pointerId !== pointer?.id) return;
    stop(raw);
    const bounds = surface()?.getBoundingClientRect();
    if (
      bounds &&
      raw.clientX >= bounds.left &&
      raw.clientY >= bounds.top &&
      raw.clientX <= bounds.right &&
      raw.clientY <= bounds.bottom
    )
      sample(raw, true);
    release();
  };
  const cancelled = (raw: Event) => {
    if (raw instanceof window.PointerEvent && raw.pointerId === pointer?.id) {
      stop(raw);
      cancel();
    }
  };
  const click = (raw: Event) => {
    if (!(raw instanceof window.MouseEvent)) return;
    const target = owner(raw.target);
    const entry = target?.closest<HTMLButtonElement>('[data-zloz-palette-entry]');
    if (!entry || entry.disabled) return;
    stop(raw);
    if (raw.detail === 0)
      emit({
        type: 'PaletteEntryActivated',
        scope: identity().scope,
        generation: identity().generation,
        id: entry.dataset.zlozPaletteEntry ?? '',
      });
  };
  const key = (raw: Event) => {
    if (!(raw instanceof window.KeyboardEvent) || !active() || raw.ctrlKey || raw.metaKey) return;
    const target = owner(raw.target);
    if (!target || target.closest('input,select,textarea,[contenteditable="true"]')) return;
    const token = identity();
    if (raw.key === 'Escape') {
      stop(raw);
      cancel();
      return;
    }
    if (!target.closest('[data-zloz-palette-entry],[data-flow-surface]')) return;
    if (raw.key === 'Enter' && target.closest('[data-zloz-palette-selected="false"]')) return;
    // Action buttons retain native Enter/Space activation; source/canvas arrows are shared.
    if (raw.key === 'Enter' && !target.closest('[data-zloz-placement-action]')) {
      if (raw.repeat) return;
      stop(raw);
      emit({ type: 'PlacementAccepted', ...token });
      return;
    }
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[raw.key];
    if (!direction) return;
    stop(raw);
    const step =
      (raw.altKey ? 1 : Number(element.dataset.zlozPlacementStep) || 1) * (raw.shiftKey ? 10 : 1);
    emit({
      type: 'PlacementNudged',
      scope: token.scope,
      generation: token.generation,
      delta: { x: direction.x * step, y: direction.y * step },
      bypassed: raw.altKey,
    });
  };
  const listeners: readonly [string, EventListener][] = [
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', cancelled],
    ['lostpointercapture', cancelled],
    ['click', click],
    ['keydown', key],
  ];
  for (const [name, handler] of listeners) element.addEventListener(name, handler, true);
  window.addEventListener('blur', cancel);
  return () => {
    for (const [name, handler] of listeners) element.removeEventListener(name, handler, true);
    window.removeEventListener('blur', cancel);
    release();
  };
}
