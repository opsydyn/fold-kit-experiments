import { Command, UiSchema, type View } from '@effect/ui';
import { BrowserHost, Html } from '@effect/ui/html';
import { Effect, Exit, Option, Schema, Scope } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import { Message as WorkbenchMessage } from './message';

const panelEvent = 'zloz-effect-ui-panel';

class PanelHost {
  constructor(readonly send: (message: WorkbenchMessage) => void) {}
}

const ForwardRequest = Command.make(
  'ForwardArchitecturePanelRequest',
  { args: { host: Schema.instanceOf(PanelHost), message: WorkbenchMessage } },
  ({ host, message }) => Effect.sync(() => host.send(message)),
);

/** Temporary scoped child host for the controls that have moved off the FoldKit workbench. */
export function architectureNativePanel<A>(
  name: string,
  accepts: (input: unknown) => input is WorkbenchMessage,
  render: <M>(
    h: Html.H<M>,
    snapshot: A,
    request: (message: WorkbenchMessage) => M,
  ) => View.Content<M>,
) {
  class PanelSnapshot {
    constructor(readonly value: A) {}
  }
  const Snapshot = Schema.instanceOf(PanelSnapshot);
  const Model = Schema.Struct({ snapshot: Snapshot });
  const Message = UiSchema.TaggedEnum({
    ReceivedSnapshot: { snapshot: Snapshot },
    Requested: { message: WorkbenchMessage },
    ForwardedRequest: {},
  });
  type Message = typeof Message.Type;
  const NativePanel = Html.component({
    name,
    props: Schema.Struct({ snapshot: Snapshot, host: Schema.instanceOf(PanelHost) }),
    model: Model,
    message: Message,
  }).make({
    init: ($) => $.set({ snapshot: $.props.snapshot }),
    update: ($, message) =>
      Message.match(message, {
        ReceivedSnapshot: ({ snapshot }) => $.set({ snapshot }),
        Requested: ({ message }) =>
          $.set($.model).run(
            ForwardRequest.make({ host: $.props.host, message }).pipe(
              Command.as(Message.ForwardedRequest()),
            ),
          ),
        ForwardedRequest: () => $.set($.model),
      }),
    view: (h, model) =>
      render(h, model.snapshot.value, (message) => Message.Requested({ message })),
  });
  type MountedPanel = {
    readonly scope: Scope.Closeable;
    readonly abort: AbortController;
    latest: PanelSnapshot;
    send: ((message: Message) => void) | undefined;
  };
  const mounted = new WeakMap<Node, MountedPanel>();

  function closePanel(entry: MountedPanel) {
    entry.abort.abort();
    const close = Scope.close(entry.scope, Exit.void);
    void Effect.runPromise(close).catch((error) =>
      console.error('Could not dispose the Architecture panel.', error),
    );
  }

  return function nativePanel(
    h: HtmlBuilder<WorkbenchMessage>,
    value: A,
    attribute: string,
    id: string,
  ) {
    const snapshot = new PanelSnapshot(value);
    const host = h.div([
      h.Key(`native:${attribute}:${id}`),
      h.DataAttribute(attribute, id),
      {
        _tag: 'OnCustomEvent',
        name: panelEvent,
        f: ({ detail }: CustomEvent<unknown>) =>
          accepts(detail) ? Option.some(detail) : Option.none(),
      },
    ]);
    if (!host) return host;
    host.data = {
      ...host.data,
      hook: {
        insert: ({ elm }) => {
          if (!(elm instanceof Element)) return;
          const entry: MountedPanel = {
            scope: Scope.makeUnsafe(),
            abort: new AbortController(),
            latest: snapshot,
            send: undefined,
          };
          mounted.set(elm, entry);
          const mount = BrowserHost.mountEffect(
            NativePanel,
            {
              snapshot,
              host: new PanelHost((detail) => {
                if (!entry.abort.signal.aborted)
                  elm.dispatchEvent(new CustomEvent(panelEvent, { detail }));
              }),
            },
            elm,
            { head: false },
          );
          const scopedMount = Scope.provide(mount, entry.scope);
          void Effect.runPromise(scopedMount, { signal: entry.abort.signal }).then(
            (root) => {
              if (entry.abort.signal.aborted) return;
              entry.send = root.send;
              if (entry.latest !== snapshot)
                root.send(Message.ReceivedSnapshot({ snapshot: entry.latest }));
            },
            (error) => {
              if (!entry.abort.signal.aborted) {
                console.error('Could not mount the Architecture panel.', error);
                closePanel(entry);
              }
            },
          );
        },
        postpatch: (_, { elm }) => {
          const entry = elm && mounted.get(elm);
          if (!entry) return;
          entry.latest = snapshot;
          entry.send?.(Message.ReceivedSnapshot({ snapshot }));
        },
        destroy: ({ elm }) => {
          const entry = elm && mounted.get(elm);
          if (!entry || !elm) return;
          mounted.delete(elm);
          closePanel(entry);
        },
      },
    };
    return host;
  };
}
