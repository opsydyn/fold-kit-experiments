// DOM ownership guards are an imperative Effect boundary; check and focus stay atomic.
/* oxlint-disable linteffect/no-if-statement, linteffect/no-return-in-arrow */
import { Effect, Schema } from 'effect';
import { Command, Dom, Render } from 'foldkit';

import { Message } from './message';

export const FocusComparisonTarget = Command.define('FocusComparisonTarget', {
  args: { selector: Schema.String },
  messages: [Message.CompletedFocusComparisonTarget],
  execute: ({ selector }) =>
    Dom.focus(selector, { makeFocusable: true }).pipe(
      Effect.catchTag('ElementNotFound', () => Effect.void),
      Effect.map(() => Message.CompletedFocusComparisonTarget()),
    ),
});

export const RestoreComparisonFocus = Command.define('RestoreComparisonFocus', {
  args: { panelId: Schema.Number },
  messages: [Message.CompletedRestoreComparisonFocus],
  execute: ({ panelId }) =>
    Effect.gen(function* () {
      const acquire = Effect.sync(() => {
        const panel = document.querySelector(`[aria-labelledby="comparison-panel-${panelId}"]`);
        const target = document.activeElement;
        if (
          panel === null ||
          !(target instanceof HTMLElement || target instanceof SVGElement) ||
          !panel.contains(target)
        )
          return undefined;

        // Authority lasts only until another target receives focus, even if it later blurs.
        let focusTaken = false;
        const onFocusIn = (event: FocusEvent) => {
          if (event.target !== target) focusTaken = true;
        };
        document.addEventListener('focusin', onFocusIn, true);
        return {
          release: () => document.removeEventListener('focusin', onFocusIn, true),
          restore: () => {
            if (
              !focusTaken &&
              target.isConnected &&
              panel.isConnected &&
              panel.contains(target) &&
              document.activeElement === document.body
            )
              target.focus({ preventScroll: true });
          },
        };
      });
      const ownership = yield* Effect.acquireRelease(acquire, (owned) =>
        Effect.sync(() => owned?.release()),
      );
      if (ownership !== undefined) {
        yield* Render.afterCommit;
        // Keep the identity/ownership check and focus atomic after the committed patch.
        // oxlint-disable-next-line linteffect/warn-effect-sync-wrapper
        yield* Effect.sync(() => ownership.restore());
      }
      return Message.CompletedRestoreComparisonFocus();
    }).pipe(Effect.scoped),
});
