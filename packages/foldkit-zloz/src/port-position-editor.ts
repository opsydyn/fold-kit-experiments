import { Match, Option } from 'effect';

import type { ZlozPortInspectorEntry } from './port-inspector';
import type { Port, PortPosition, PortSide } from './types';

/** Unvalidated Model-owned text; only the active position representation is present. */
export type ZlozPortPositionDraft =
  | Readonly<{ mode: 'offset'; side: PortSide; offset: string }>
  | Readonly<{ mode: 'anchor'; side: PortSide; x: string; y: string }>;
export type ZlozPortPositionMode = ZlozPortPositionDraft['mode'];
export type ZlozPortPositionField = 'offset' | 'x' | 'y';
/** Facts from native draft controls. Number changes retain partial text until Save. */
export type ZlozPortPositionDraftChange =
  | Readonly<{ type: 'mode'; mode: ZlozPortPositionMode }>
  | Readonly<{ type: 'side'; side: PortSide }>
  | Readonly<{ type: 'number'; field: ZlozPortPositionField; text: string }>;
export type ZlozPortPositionInputContext = Readonly<{
  field: ZlozPortPositionField;
  value: string;
}>;
export type ZlozPortPositionEditorContext = Readonly<{
  entry: ZlozPortInspectorEntry;
  draft: ZlozPortPositionDraft;
  inputs: readonly ZlozPortPositionInputContext[];
}>;

const sides: readonly PortSide[] = ['left', 'right', 'top', 'bottom'];

/** Copy authored values into a host-owned text draft without changing the graph. */
export function portPositionDraft(port: Port): ZlozPortPositionDraft {
  return port.anchor === undefined
    ? { mode: 'offset', side: port.side, offset: String(port.offset) }
    : { mode: 'anchor', side: port.side, x: String(port.anchor.x), y: String(port.anchor.y) };
}

/** Mode conversion preserves the along-side value and projects back onto the chosen edge. */
export function updatePortPositionDraft(
  draft: ZlozPortPositionDraft,
  change: ZlozPortPositionDraftChange,
): ZlozPortPositionDraft {
  return Match.value(change).pipe(
    Match.when(
      { type: 'side' },
      (change): ZlozPortPositionDraft =>
        draft.side === change.side ? draft : { ...draft, side: change.side },
    ),
    Match.when({ type: 'mode' }, (change): ZlozPortPositionDraft => {
      if (draft.mode === change.mode) return draft;
      if (draft.mode === 'anchor')
        return {
          mode: 'offset',
          side: draft.side,
          offset: draft.side === 'left' || draft.side === 'right' ? draft.y : draft.x,
        };
      const anchors = {
        left: { x: '0', y: draft.offset },
        right: { x: '1', y: draft.offset },
        top: { x: draft.offset, y: '0' },
        bottom: { x: draft.offset, y: '1' },
      };
      return { mode: 'anchor', side: draft.side, ...anchors[draft.side] };
    }),
    Match.when({ type: 'number' }, (change): ZlozPortPositionDraft => {
      if (draft.mode === 'offset')
        return change.field === 'offset' ? { ...draft, offset: change.text } : draft;
      return change.field === 'offset' ? draft : { ...draft, [change.field]: change.text };
    }),
    Match.exhaustive,
  );
}

function fraction(text: string): Option.Option<number> {
  const value = Number(text);
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 1
    ? Option.some(value)
    : Option.none();
}

/** Empty, non-finite and out-of-range numbers produce None. No graph mutation occurs here. */
export function portPositionFromDraft(draft: ZlozPortPositionDraft): Option.Option<PortPosition> {
  if (!sides.includes(draft.side)) return Option.none();
  if (draft.mode === 'offset')
    return Option.map(fraction(draft.offset), (offset) => ({ side: draft.side, offset }));
  return Option.flatMap(fraction(draft.x), (x) =>
    Option.map(fraction(draft.y), (y) => ({ side: draft.side, anchor: { x, y } })),
  );
}

/** Resolve only the numeric fields used by this draft's representation. */
export function portPositionEditorContext(
  entry: ZlozPortInspectorEntry,
  draft: ZlozPortPositionDraft,
): ZlozPortPositionEditorContext {
  return {
    entry,
    draft,
    inputs:
      draft.mode === 'offset'
        ? [{ field: 'offset', value: draft.offset }]
        : [
            { field: 'x', value: draft.x },
            { field: 'y', value: draft.y },
          ],
  };
}
