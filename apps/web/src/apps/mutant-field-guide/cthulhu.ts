import type { Specimen } from './specimens';

export function cthulhuKnot(kind: Specimen['kind'], history: readonly { outcome: string }[]) {
  if (kind !== 'never' || !history.some(({ outcome }) => outcome === 'missed')) return undefined;
  const lastVerdict = history.findLast(
    ({ outcome }) => outcome === 'caught' || outcome === 'missed',
  );
  return lastVerdict?.outcome === 'caught' ? 'open' : 'knotted';
}
