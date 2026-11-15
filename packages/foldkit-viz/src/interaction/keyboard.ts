/**
 * Keyboard navigation for charts, framework-free. A chart's targets (its dots,
 * bars or cells, in reading order) are stepped through with the same keys a
 * listbox or grid uses. Keys pressed with Ctrl, Alt or Meta are left to the
 * browser, so its own shortcuts keep working.
 */

export type ChartCommand =
  | Readonly<{ _tag: 'Step'; by: number }>
  | Readonly<{ _tag: 'Jump'; to: 'first' | 'last' }>
  | Readonly<{ _tag: 'Clear' }>
  | Readonly<{ _tag: 'Select' }>;

/** The modifier keys held with a key, as FoldKit's keyboard handlers receive them. */
export type ChartKeyModifiers = Readonly<{
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}>;

export type ChartKeyOptions = Readonly<{
  /** How many targets Page Up and Page Down move. Default 10. */
  page?: number;
}>;

/**
 * The command a key gives a chart: arrows step by one, Page Up and Page Down
 * by a page, Home and End jump to the ends, Escape clears, and Enter or Space
 * selects. Undefined for any other key, or when Ctrl, Alt or Meta is held.
 */
export function chartCommandOf(
  key: string,
  modifiers: ChartKeyModifiers = {},
  options: ChartKeyOptions = {},
): ChartCommand | undefined {
  if (modifiers.ctrlKey === true || modifiers.altKey === true || modifiers.metaKey === true)
    return undefined;
  const page = Math.max(1, Math.floor(options.page ?? 10));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return { _tag: 'Step', by: 1 };
    case 'ArrowLeft':
    case 'ArrowUp':
      return { _tag: 'Step', by: -1 };
    case 'PageDown':
      return { _tag: 'Step', by: page };
    case 'PageUp':
      return { _tag: 'Step', by: -page };
    case 'Home':
      return { _tag: 'Jump', to: 'first' };
    case 'End':
      return { _tag: 'Jump', to: 'last' };
    case 'Escape':
      return { _tag: 'Clear' };
    case 'Enter':
    case ' ':
      return { _tag: 'Select' };
    default:
      return undefined;
  }
}

export type TargetOptions = Readonly<{
  /** Step past either end round to the other. Default true for single steps, as charts did. */
  wrap?: boolean;
}>;

/**
 * The target a command leads to among `count` targets, from `current` (none
 * when nothing is active). Stepping from none starts at the first target going
 * forward and the last going back. A single step wraps unless `wrap` is false;
 * a page step stops at the ends. Clear gives none, and Select keeps the current
 * target.
 */
export function targetAfter(
  count: number,
  current: number | undefined,
  command: ChartCommand,
  options: TargetOptions = {},
): number | undefined {
  if (count <= 0) return undefined;
  const last = count - 1;
  switch (command._tag) {
    case 'Clear':
      return undefined;
    case 'Select':
      return current;
    case 'Jump':
      return command.to === 'first' ? 0 : last;
    case 'Step': {
      if (current === undefined) return command.by > 0 ? 0 : last;
      const next = current + command.by;
      if (next >= 0 && next <= last) return next;
      const wrap = (options.wrap ?? true) && Math.abs(command.by) === 1;
      if (wrap) return next < 0 ? last : 0;
      return Math.min(last, Math.max(0, next));
    }
  }
}
