import { Effect, Match, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';

import { bindInput, bindMinimapInput } from './input';
import { InputMessage, type BrowserInput } from './input-message';

function inputs(element: Element): Stream.Stream<BrowserInput> {
  return Stream.callback<BrowserInput>((queue) => {
    // SAFETY: FlowInput is private and mounted exclusively on flowView's HTML surface div.
    const acquire = Effect.sync(() =>
      bindInput(element as HTMLElement, (event) => Queue.offerUnsafe(queue, event)),
    );
    const resource = Effect.acquireRelease(acquire, (release) => Effect.sync(release));
    // The Mount scope interrupts this wait and runs the listener/observer release.
    // oxlint-disable-next-line linteffect/no-effect-never
    return resource.pipe(Effect.andThen(Effect.never));
  });
}
function forView(state: Mount.ViewState, element: Element): Stream.Stream<BrowserInput> {
  return Match.value(state).pipe(
    Match.when('Live', () => inputs(element)),
    Match.orElse(() => Stream.empty),
  );
}
export const FlowInput = Mount.defineStream('FlowInput', {
  messages: [InputMessage.ObservedFlowInput],
  execute: ({ element, viewStateChanges }) =>
    viewStateChanges.pipe(
      Stream.switchMap((state) => forView(state, element)),
      Stream.map((event) => InputMessage.ObservedFlowInput({ event })),
    ),
});

/** A minimap can live outside the canvas. This scoped resource normalizes only its own click plane. */
function minimapInputs(element: Element): Stream.Stream<BrowserInput> {
  return Stream.callback<BrowserInput>((queue) => {
    const acquire = Effect.sync(() =>
      bindMinimapInput(element, (event) => Queue.offerUnsafe(queue, event)),
    );
    return Effect.acquireRelease(acquire, (release) => Effect.sync(release)).pipe(
      // oxlint-disable-next-line linteffect/no-effect-never -- Listener lifetime is the Live Mount scope.
      Effect.andThen(Effect.never),
    );
  });
}
export const FlowMinimapInput = Mount.defineStream('FlowMinimapInput', {
  messages: [InputMessage.ObservedFlowInput],
  execute: ({ element, viewStateChanges }) =>
    viewStateChanges.pipe(
      Stream.switchMap((state) => (state === 'Live' ? minimapInputs(element) : Stream.empty)),
      Stream.map((event) => InputMessage.ObservedFlowInput({ event })),
    ),
});
