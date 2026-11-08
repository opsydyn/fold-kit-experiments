import { Match, Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';

import {
  zlozPortLabelForm,
  zlozPortLabelCancel,
  type ZlozPortInspectorEntry,
  type ZlozPortLabelFormMessages,
} from './port-inspector';
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
export type ZlozPortPositionFormMessages<M> = ZlozPortLabelFormMessages<M>;

const sides: readonly PortSide[] = ['left', 'right', 'top', 'bottom'];
const modes: readonly ZlozPortPositionMode[] = ['offset', 'anchor'];
type Attributes<M> = Parameters<HtmlBuilder<M>['button']>[0];
type Children<M> = Parameters<HtmlBuilder<M>['button']>[1];

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

function protection<M>(h: HtmlBuilder<M>, entry: ZlozPortInspectorEntry): Attributes<M> {
  const control = entry.positionControl;
  return [
    h.Disabled(control.reason !== null),
    ...(control.reason !== null ? [h.AriaDescribedBy(control.reasonId)] : []),
  ];
}

/** Open a host-owned position draft. Names and content are independently customizable. */
export function zlozPortPositionEditButton<M>(
  h: HtmlBuilder<M>,
  entry: ZlozPortInspectorEntry,
  edited: M,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button(
    [
      h.AriaLabel(`Edit position for ${entry.port.id} port on ${entry.node.label}`),
      ...attributes,
      h.Type('button'),
      ...protection(h, entry),
      h.OnClick(edited),
    ],
    children,
  );
}

/** Choose cardinal edge offsets or normalized box coordinates. */
export function zlozPortPositionModeSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortPositionEditorContext,
  changed: (change: ZlozPortPositionDraftChange) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0],
  labels: Partial<Readonly<Record<ZlozPortPositionMode, string>>> = {},
): Html {
  const { entry, draft } = context;
  return h.select(
    [
      h.AriaLabel(`Position mode for ${entry.port.id} port on ${entry.node.label}`),
      ...attributes,
      h.Value(draft.mode),
      ...protection(h, entry),
      h.OnChange((value) =>
        changed({ type: 'mode', mode: modes.find((mode) => mode === value) ?? draft.mode }),
      ),
    ],
    modes.map((mode) =>
      h.option(
        [h.Value(mode), h.Selected(draft.mode === mode)],
        [labels[mode] ?? (mode === 'offset' ? 'Edge offset' : 'Box coordinates')],
      ),
    ),
  );
}

/** Side determines the edge for offsets and the routing direction hint for box anchors. */
export function zlozPortPositionSideSelect<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortPositionEditorContext,
  changed: (change: ZlozPortPositionDraftChange) => M,
  attributes: Parameters<HtmlBuilder<M>['select']>[0],
  labels: Partial<Readonly<Record<PortSide, string>>> = {},
): Html {
  const { entry, draft } = context;
  return h.select(
    [
      h.AriaLabel(`Side for ${entry.port.id} port on ${entry.node.label}`),
      ...attributes,
      h.Value(draft.side),
      ...protection(h, entry),
      h.OnChange((value) =>
        changed({ type: 'side', side: sides.find((side) => side === value) ?? draft.side }),
      ),
    ],
    sides.map((side) =>
      h.option([h.Value(side), h.Selected(draft.side === side)], [labels[side] ?? side]),
    ),
  );
}

/** Native normalized fraction input; draft changes preserve intermediate text and require Save. */
export function zlozPortPositionInput<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortPositionEditorContext,
  input: ZlozPortPositionInputContext,
  changed: (change: ZlozPortPositionDraftChange) => M,
  attributes: Parameters<HtmlBuilder<M>['input']>[0],
): Html {
  const { entry } = context;
  const name = input.field === 'offset' ? 'Offset' : 'Anchor ' + input.field.toUpperCase();
  return h.input([
    h.AriaLabel(`${name} for ${entry.port.id} port on ${entry.node.label}`),
    h.Step('any'),
    ...attributes,
    h.Type('number'),
    h.Min('0'),
    h.Max('1'),
    h.Required(true),
    h.Value(input.value),
    ...protection(h, entry),
    h.OnInput((text) => changed({ type: 'number', field: input.field, text })),
  ]);
}

/** Policy-aware native submit; the host parses and commits the complete draft. */
export function zlozPortPositionSave<M>(
  h: HtmlBuilder<M>,
  context: ZlozPortPositionEditorContext,
  attributes: Attributes<M>,
  children: Children<M>,
): Html {
  return h.button([...attributes, h.Type('submit'), ...protection(h, context.entry)], children);
}

/** Native Enter and Escape handling shared with other host-owned port drafts. */
export const zlozPortPositionForm = zlozPortLabelForm;
/** Cancel remains available while a position draft is protected. */
export const zlozPortPositionCancel = zlozPortLabelCancel;
