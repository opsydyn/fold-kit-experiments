import { Mount } from '@effect/ui';
import { Effect, Queue, Stream } from 'effect';

import { Message } from './message';

const isAnalysisRoute = (path: string) => /^\/agent-analysis(?:\/retained)?\/?$/.test(path);

export const ObserveAgentEnvironment = Mount.makeStream(
  'ObserveAgentEnvironment',
  { args: {} },
  (element: HTMLElement) =>
    Stream.callback<Message>((queue) => {
      const open = Effect.sync(() => {
        const document = element.ownerDocument;
        const window = document.defaultView;
        let current = document.location.pathname;
        const emit = (message: Message) => Queue.offerUnsafe(queue, message);
        const media = window?.matchMedia?.('(max-width: 700px)');
        const change = ({ matches }: MediaQueryList | MediaQueryListEvent) =>
          emit(Message.ChangedCompactView({ isCompact: matches }));
        if (media) {
          media.addEventListener('change', change);
          change(media);
        }

        function beforeSwap(event: DocumentEventMap['astro:before-swap']) {
          const path = event.to.pathname;
          const phase = isAnalysisRoute(path) ? 'stayed' : 'exited';
          emit(Message.Navigated({ phase, path, previousPath: current }));
          current = path;
        }

        function pageHide() {
          emit(Message.Navigated({ phase: 'exited', path: current, previousPath: current }));
        }

        document.addEventListener('astro:before-swap', beforeSwap);
        window?.addEventListener('pagehide', pageHide);
        return () => {
          media?.removeEventListener('change', change);
          document.removeEventListener('astro:before-swap', beforeSwap);
          window?.removeEventListener('pagehide', pageHide);
        };
      });
      const observe = Effect.acquireRelease(open, Effect.sync);
      // Keep the mount's listeners active until its scope closes.
      // oxlint-disable-next-line linteffect/no-effect-never
      return Effect.andThen(observe, Effect.never);
    }),
);
