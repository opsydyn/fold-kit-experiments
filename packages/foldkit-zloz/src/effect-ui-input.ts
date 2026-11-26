import { Mount } from '@effect/ui';
import { Effect, Queue, Stream } from 'effect';

import type { BrowserInput } from './browser-input';
import { bindInput } from './input';

/** Delivers native ZLOZ input while the host's graph surface is mounted. */
export const surfaceInput = Mount.makeStream(
  'ZlozSurfaceInput',
  { args: {} },
  (element: HTMLElement) =>
    Stream.callback<BrowserInput>((queue) => {
      const bind = Effect.sync(() =>
        bindInput(element, (event) => Queue.offerUnsafe(queue, event)),
      );
      return Effect.acquireRelease(bind, Effect.sync);
    }),
);
