import { BrowserHost } from '@effect/ui/html';
import { Effect, Exit, Scope } from 'effect';
import { onTestFinished, vi } from 'vitest';

import { Stateflow } from './main';
import type { SharedSession } from './share';

export async function mountStateflow(session: SharedSession | null = null) {
  const host = document.createElement('div');
  document.body.append(host);
  const scope = Scope.makeUnsafe();
  onTestFinished(async () => {
    await Effect.runPromise(Scope.close(scope, Exit.void));
    host.remove();
  });
  vi.stubGlobal(
    'matchMedia',
    globalThis.window?.matchMedia ??
      (() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      })),
  );
  onTestFinished(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const mounted = BrowserHost.mountEffect(Stateflow, { session }, host, { head: false });
  const root = await Effect.runPromise(Scope.provide(mounted, scope));
  const dispose = async () => {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  };
  return { host, root, dispose };
}
