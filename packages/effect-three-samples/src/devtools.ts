import { DevTools } from '@effect/ui-devtools';
import { Predicate } from 'effect';

export function attachSceneDevTools(): void {
  // The pinned Vite plugin uses this hook before mounting a root. Astro mounts its own roots.
  if (!Predicate.hasProperty(DevTools, 'attach') || !Predicate.isFunction(DevTools.attach)) {
    console.warn('This Effect UI DevTools snapshot does not export the browser attach hook.');
    return;
  }
  DevTools.attach({ server: 'http://127.0.0.1:4774', webMcp: false });
}
