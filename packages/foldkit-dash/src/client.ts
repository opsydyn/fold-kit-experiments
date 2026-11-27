/** Adopt the page markup only when it was built with this exact classic script. */
import type { Renderer } from '@effect/ui';
import { HtmlHydrate } from '@effect/ui/html';
import { Effect, Exit, Schema, Scope } from 'effect';

import { Dash, Flags } from './app';

const readProps = Schema.decodeUnknownSync(Schema.fromJsonString(Flags));
const script = document.currentScript;
const source = script instanceof HTMLScriptElement ? script.src : '';
const buildId = /client-([a-f0-9]{12})\.js$/.exec(source)?.[1];
const container = document.querySelector('[data-dash-root]');
const state = document.querySelector('[data-dash-state]')?.textContent;
const props = document.querySelector('[data-dash-props]')?.textContent;

if (
  container &&
  state &&
  props &&
  buildId &&
  container.getAttribute('data-dash-build') === buildId
) {
  const scope = Scope.makeUnsafe();
  const controller = new AbortController();
  const dispose = () => {
    window.removeEventListener('pagehide', onPageHide);
    controller.abort();
    const close = Scope.close(scope, Exit.void);
    Effect.runFork(close);
  };
  const onPageHide = (event: PageTransitionEvent) => {
    if (!event.persisted) dispose();
  };
  window.addEventListener('pagehide', onPageHide);
  const activate = Effect.gen(function* () {
    // SAFETY: The matching Dash build emitted this state with HtmlServer.serializeState.
    const snapshot = JSON.parse(state) as Renderer.State;
    const root = yield* HtmlHydrate.hydrateEffect(Dash, readProps(props), container, snapshot, {
      head: false,
    });
    yield* root.adopted;
    container.setAttribute('data-dash-ready', '');
  });
  const mounted = activate.pipe(Scope.provide(scope));
  void Effect.runPromise(mounted, { signal: controller.signal }).catch((error) => {
    if (controller.signal.aborted) return;
    dispose();
    console.error('Could not hydrate the dashboard.', error);
  });
}
