import type { Component, Renderer } from '@effect/ui';
import { BrowserHost, HtmlHydrate } from '@effect/ui/html';
import { Effect, Exit, Scope } from 'effect';

import { asIslandComponent, IslandRendererError, type IslandProps } from './component';

const activations = new WeakMap<HTMLElement, Promise<void>>();

export default function renderer(island: HTMLElement) {
  return (
    component: Component.Any,
    props: IslandProps,
    slots: Record<string, string>,
    { client }: { client: string },
  ): Promise<void> => {
    const existing = activations.get(island);
    if (existing) return existing;

    const scope = Scope.makeUnsafe();
    const controller = new AbortController();
    const dispose = async () => {
      island.removeEventListener('astro:unmount', onUnmount);
      controller.abort();
      await Effect.runPromise(Scope.close(scope, Exit.void));
    };
    const onUnmount = () => {
      void dispose()
        .catch((error) => console.error('Could not dispose Effect UI island.', error))
        .finally(() => activations.delete(island));
    };
    island.addEventListener('astro:unmount', onUnmount, { once: true });

    const activate = Effect.gen(function* () {
      if (Object.keys(slots).length > 0) {
        return yield* new IslandRendererError({
          message: 'Astro Effect UI slots are unsupported.',
        });
      }
      const definition = asIslandComponent(component);
      const options = { head: false };
      if (client === 'only') {
        const container = island.ownerDocument.createElement('div');
        island.replaceChildren(container);
        yield* BrowserHost.mountEffect(definition, props, container, options);
        return;
      }

      const container = island.querySelector(':scope > [data-effect-ui-root]');
      const state = island.querySelector(':scope > script[data-effect-ui-state]')?.textContent;
      if (!container || !state) {
        return yield* new IslandRendererError({
          message: 'Missing Effect UI hydration markup or state.',
        });
      }
      // SAFETY: Only this renderer emits the adjacent state script using HtmlServer.serializeState.
      const hydrationState = JSON.parse(state) as Renderer.State;
      const root = yield* HtmlHydrate.hydrateEffect(
        definition,
        props,
        container,
        hydrationState,
        options,
      );
      yield* root.adopted;
    });

    const ready = Effect.runPromise(activate.pipe(Scope.provide(scope)), {
      signal: controller.signal,
    }).catch(async (error) => {
      if (controller.signal.aborted) return;
      await dispose().finally(() => activations.delete(island));
      throw error;
    });
    activations.set(island, ready);
    return ready;
  };
}
