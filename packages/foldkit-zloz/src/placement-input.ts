import { Effect, Match, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';

import { bindPlacementInput } from './bind-placement-input';
import type { ZlozPlacementInput } from './placement-controls';

export { bindPlacementInput } from './bind-placement-input';

const PlacementMessage = defineMessageUnion({ ObservedPlacementInput: { input: Schema.Unknown } });
function inputs(element: Element): Stream.Stream<ZlozPlacementInput> {
  return Stream.callback<ZlozPlacementInput>((queue) => {
    // SAFETY: this Mount is private to the placement host's HTML div.
    const acquire = Effect.sync(() =>
      bindPlacementInput(element as HTMLElement, (input) => Queue.offerUnsafe(queue, input)),
    );
    const resource = Effect.acquireRelease(acquire, (release) => Effect.sync(release));
    // oxlint-disable-next-line linteffect/no-effect-never -- Listener lifetime is the Live Mount scope.
    return resource.pipe(Effect.andThen(Effect.never));
  });
}
function forView(state: Mount.ViewState, element: Element): Stream.Stream<ZlozPlacementInput> {
  return Match.value(state).pipe(
    Match.when('Live', () => inputs(element)),
    Match.orElse(() => Stream.empty),
  );
}
export const ZlozPlacementInputMount = Mount.defineStream('ZlozPlacementInput', {
  messages: [PlacementMessage.ObservedPlacementInput],
  execute: ({ element, viewStateChanges }) =>
    viewStateChanges.pipe(
      Stream.switchMap((state) => forView(state, element)),
      Stream.map((input) => PlacementMessage.ObservedPlacementInput({ input })),
    ),
});
