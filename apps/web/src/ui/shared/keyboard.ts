import { Option } from 'effect';

/**
 * Standard arrow-key navigation handler for indexed lists.
 * Returns the message to dispatch, or none if the key is irrelevant.
 */
export function arrowKeyNav<M>(
  key: string,
  makeMessage: (direction: 'next' | 'prev') => M,
): Option.Option<M> {
  if (key === 'ArrowRight' || key === 'ArrowDown')
    return Option.some(makeMessage('next'));
  if (key === 'ArrowLeft' || key === 'ArrowUp')
    return Option.some(makeMessage('prev'));
  return Option.none();
}

/**
 * Computes the next active index given direction and wrap-around.
 */
export function nextIndex(n: number, current: number, direction: string): number {
  return direction === 'next' ? (current + 1) % n : (current - 1 + n) % n;
}
