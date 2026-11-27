import type { MeasuredBounds } from './measurement';
export type BoxMeasurementTarget = Readonly<{
  attribute: string;
  scope: string;
  noun: string;
  plural: string;
  title: string;
}>;
export type BoxMeasurementBatch =
  | { type: 'measured'; labels: readonly MeasuredBounds[] }
  | { type: 'failed'; reason: string };
/** One native, scoped read. Border-box observer sizes are CSS/world units, independent of camera zoom. */
export function bindBoxMeasurement(
  probe: Element,
  targetIds: readonly string[],
  emit: (batch: BoxMeasurementBatch) => void,
  timeoutMs: number,
  target: BoxMeasurementTarget,
): () => void {
  const scope = probe.parentElement,
    win = probe.ownerDocument.defaultView;
  let stopped = false;
  let observer: ResizeObserver | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    if (timer !== undefined) clearTimeout(timer);
  };
  const finish = (batch: BoxMeasurementBatch) => {
    if (stopped) return;
    release();
    emit(batch);
  };
  if (!scope || !win?.ResizeObserver) {
    finish({ type: 'failed', reason: 'Border-box measurement is unavailable.' });
    return release;
  }
  timer = setTimeout(
    () =>
      finish({
        type: 'failed',
        reason: `${target.title} measurement timed out. Previous preview preserved.`,
      }),
    timeoutMs,
  );
  Promise.resolve(probe.ownerDocument.fonts?.ready)
    .then(() => {
      if (stopped) return;
      const targets = new Map<string, Element>();
      for (const element of scope.querySelectorAll(`[${target.attribute}]`)) {
        if (element.closest(`[${target.scope}]`) !== scope) continue;
        if (
          scope.hasAttribute('data-flow-surface') &&
          element.closest('[data-flow-surface]') !== scope
        )
          continue;
        const id = element.getAttribute(target.attribute) ?? '';
        if (targetIds.includes(id)) {
          if (targets.has(id)) {
            finish({
              type: 'failed',
              reason: `A requested ${target.noun} has multiple measurement targets.`,
            });
            return;
          }
          targets.set(id, element);
        }
      }
      if (targets.size !== targetIds.length) {
        finish({
          type: 'failed',
          reason: `Render every requested ${target.noun} before measuring.`,
        });
        return;
      }
      if (targetIds.length === 0) {
        finish({ type: 'measured', labels: [] });
        return;
      }
      const measured = new Map<string, MeasuredBounds>();
      observer = new win.ResizeObserver((entries) => {
        if (stopped) return;
        for (const entry of entries) {
          const id = entry.target.getAttribute(target.attribute) ?? '';
          if (targets.get(id) !== entry.target) continue;
          const boxes = entry.borderBoxSize,
            box = boxes?.[0];
          if (!Array.isArray(boxes) || boxes.length !== 1 || !box) {
            finish({ type: 'failed', reason: 'A single HTML border box is required.' });
            return;
          }
          const vertical =
            win.getComputedStyle(entry.target).writingMode.startsWith('vertical') ||
            win.getComputedStyle(entry.target).writingMode.startsWith('sideways');
          const size = {
            width: vertical ? box.blockSize : box.inlineSize,
            height: vertical ? box.inlineSize : box.blockSize,
          };
          if (
            !entry.target.isConnected ||
            ![size.width, size.height].every((n) => Number.isFinite(n) && n > 0)
          ) {
            finish({
              type: 'failed',
              reason: `${target.title} bounds must be visible, positive and finite.`,
            });
            return;
          }
          measured.set(id, { id, size });
        }
        if (measured.size === targetIds.length)
          finish({
            type: 'measured',
            labels: [...measured.values()],
          });
      });
      for (const target of targets.values()) observer.observe(target, { box: 'border-box' });
    })
    .catch(() =>
      finish({ type: 'failed', reason: `Could not measure rendered ${target.plural}.` }),
    );
  return release;
}

export const labelMeasurementTarget = {
  attribute: 'data-zloz-measured-label',
  scope: 'data-zloz-label-measurement-scope',
  noun: 'label',
  plural: 'labels',
  title: 'Label',
} satisfies BoxMeasurementTarget;

export const groupHeaderMeasurementTarget = {
  attribute: 'data-zloz-group-header',
  scope: 'data-zloz-group-header-measurement-scope',
  noun: 'group heading',
  plural: 'group headings',
  title: 'Group heading',
} satisfies BoxMeasurementTarget;
