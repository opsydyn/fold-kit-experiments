import { Effect, Exit, Scope } from 'effect';

export function mountEffectUi(
  // Storybook owns the scope and the callback supplies the mount.
  // oxlint-disable-next-line linteffect/no-manual-effect-channels
  mount: (host: HTMLElement) => Effect.Effect<unknown, never, Scope.Scope>,
): HTMLElement {
  const host = document.createElement('div');
  host.style.width = '100%';
  const scope = Scope.makeUnsafe();
  const controller = new AbortController();
  const observer = new MutationObserver(() => {
    if (host.isConnected) return;
    observer.disconnect();
    controller.abort();
    void Effect.runPromise(Scope.close(scope, Exit.void));
  });
  requestAnimationFrame(() => {
    if (!host.isConnected) return;
    observer.observe(document.body, { childList: true, subtree: true });
    void Effect.runPromise(Scope.provide(mount(host), scope), { signal: controller.signal }).catch(
      (error) => {
        if (!controller.signal.aborted) console.error('Could not mount Effect UI story.', error);
      },
    );
  });
  return host;
}
