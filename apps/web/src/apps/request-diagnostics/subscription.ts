import { Mount } from '@effect/ui';
import { Effect, Queue, Stream } from 'effect';

import { reportDiagnostics } from './command';
import { Message } from './message';
import { isDiagnosticsPath } from './navigation';

const lastPaths = new WeakMap<Document, string>();

export const ObserveNavigation = Mount.makeStream(
  'ObserveDiagnosticsNavigation',
  { args: {} },
  (element: HTMLElement) =>
    Stream.callback<Message>((queue) => {
      const open = Effect.sync(() => {
        const document = element.ownerDocument;
        const previous = lastPaths.get(document);
        const current = document.location.pathname;
        lastPaths.set(document, current);
        Queue.offerUnsafe(queue, Message.MountedDiagnostics());
        Queue.offerUnsafe(
          queue,
          Message.Navigated({
            phase: previous === undefined ? 'coldLoad' : 'entered',
            path: current,
            previousPath: previous ?? null,
          }),
        );

        let pending: DocumentEventMap['astro:before-preparation'] | undefined;
        let reportedExit = false;
        const prepare = (event: DocumentEventMap['astro:before-preparation']) => {
          pending = event;
        };
        const exit = (path: string) => {
          if (reportedExit) return;
          reportedExit = true;
          const fact = {
            phase: 'exited' as const,
            path,
            previousPath: lastPaths.get(document) ?? current,
          };
          // The island's command scope can close during the swap or full-page navigation.
          reportDiagnostics(Message.Navigated(fact));
          Queue.offerUnsafe(queue, Message.ObservedRouteExit(fact));
          lastPaths.set(document, path);
        };
        const beforeSwap = (event: DocumentEventMap['astro:before-swap']) => {
          pending = undefined;
          const previousPath = lastPaths.get(document) ?? current;
          const path = event.to.pathname;
          if (!isDiagnosticsPath(path)) {
            exit(path);
            return;
          }
          lastPaths.set(document, path);
          Queue.offerUnsafe(queue, Message.Navigated({ phase: 'stayed', path, previousPath }));
        };
        const view = document.defaultView;
        const pageHide = () =>
          exit(
            pending?.signal.aborted === false ? pending.to.pathname : document.location.pathname,
          );
        const pageShow = (event: PageTransitionEvent) => {
          if (!event.persisted || !reportedExit) return;
          reportedExit = false;
          pending = undefined;
          const path = document.location.pathname;
          const previousPath = lastPaths.get(document) ?? null;
          lastPaths.set(document, path);
          Queue.offerUnsafe(queue, Message.Navigated({ phase: 'entered', path, previousPath }));
        };
        document.addEventListener('astro:before-preparation', prepare);
        document.addEventListener('astro:before-swap', beforeSwap);
        view?.addEventListener('pagehide', pageHide);
        view?.addEventListener('pageshow', pageShow);
        return () => {
          document.removeEventListener('astro:before-preparation', prepare);
          document.removeEventListener('astro:before-swap', beforeSwap);
          view?.removeEventListener('pagehide', pageHide);
          view?.removeEventListener('pageshow', pageShow);
        };
      });
      const subscribe = Effect.acquireRelease(open, Effect.sync);
      // The mount scope owns this listener across retained Astro swaps.
      // oxlint-disable-next-line linteffect/no-effect-never
      return Effect.andThen(subscribe, Effect.never);
    }),
);
