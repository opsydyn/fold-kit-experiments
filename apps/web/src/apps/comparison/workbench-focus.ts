import { Command, Component, Renderer } from '@effect/ui';
import { Html, HtmlCommand } from '@effect/ui/html';
import { Effect, Option, Stream } from 'effect';

import { Message, Move, type update } from './workbench-state';

export const addScatterRef = Html.ref('ComparisonAddScatter', 'button');
export const headingId = (id: number) => `comparison-panel-${id}`;
export const headingRef = (id: number) => Html.ref(headingId(id), 'h2');

// The renderer lookup waits for its own commit before the command checks focus ownership.
// oxlint-disable-next-line linteffect/no-effect-wrapper-alias
function restoreAfterCommit(
  id: number,
  panel: Element,
  active: HTMLElement | SVGElement,
  stillOwnsFocus: () => boolean,
) {
  return Effect.gen(function* () {
    const heading = yield* Renderer.Refs.use((refs) => refs.lookup(headingRef(id)));
    if (
      stillOwnsFocus() &&
      Option.isSome(heading) &&
      panel.contains(heading.value) &&
      active.isConnected &&
      panel.contains(active) &&
      document.activeElement === document.body
    )
      active.focus({ preventScroll: true });
    return Component.noop;
  });
}

export const MovePanel = Command.make('MoveComparisonPanel', { args: Move, stream: true }, (args) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const move = Stream.make(Message.ObservedPanelMove(args));
      const active = document.activeElement;
      if (!(active instanceof HTMLElement || active instanceof SVGElement)) return move;
      const panel = active.closest('.comparison-panel');
      if (panel?.getAttribute('aria-labelledby') !== headingId(args.id)) return move;

      let moved = false;
      const observe = (event: FocusEvent) => {
        if (event.target !== active) moved = true;
      };
      // Observe focus before emitting the fact that commits the keyed reorder.
      const listen = Effect.sync(() => document.addEventListener('focusin', observe, true));
      yield* Effect.acquireRelease(listen, () =>
        Effect.sync(() => document.removeEventListener('focusin', observe, true)),
      );
      return Stream.concat(
        move,
        Stream.fromEffect(restoreAfterCommit(args.id, panel, active, () => !moved)),
      );
    }),
  ),
);

export function workbenchCommands(result: ReturnType<typeof update>) {
  const { focus } = result;
  if (focus === undefined) return [];
  if (focus._tag === 'Move') return [MovePanel.make({ id: focus.id, direction: focus.direction })];
  const complete = () => Component.noop;
  return [
    focus._tag === 'Add'
      ? HtmlCommand.focus(addScatterRef, complete)
      : HtmlCommand.focus(headingRef(focus.id), complete),
  ];
}
