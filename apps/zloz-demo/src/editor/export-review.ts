import { Command, UiSchema, type Renderer, type Component } from '@effect/ui';
import { BrowserHost, Html } from '@effect/ui/html';
import { type ZlozPngReviewControls, type ZlozSvgReviewControls } from '@opsydyn/foldkit-zloz';
import { pngReview, svgReview } from '@opsydyn/foldkit-zloz/effect-ui';
import type { ZlozDiagnostics } from '@opsydyn/foldkit-zloz/foldkit';
import { Effect, Exit, Option, Schema, Scope } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';

import { Message as WorkbenchMessage } from './message';

type Review = Readonly<{
  diagnostics: ZlozDiagnostics;
  custom: boolean;
}> &
  (
    | Readonly<{ kind: 'svg'; controls: ZlozSvgReviewControls }>
    | Readonly<{ kind: 'png'; controls: ZlozPngReviewControls }>
  );

const ReviewRequest = Schema.Union([
  WorkbenchMessage.cases.ObservedSvgReviewInput,
  WorkbenchMessage.cases.ObservedPngReviewInput,
]);
type ReviewRequest = typeof ReviewRequest.Type;

class ReviewHost {
  constructor(readonly send: (message: ReviewRequest) => void) {}
}

class ReviewSnapshot {
  constructor(readonly controls: Review) {}
}
const Snapshot = Schema.instanceOf(ReviewSnapshot);
const isReviewRequest = Schema.is(ReviewRequest);

const ForwardRequest = Command.make(
  'ForwardArchitectureExportReview',
  { args: { host: Schema.instanceOf(ReviewHost), message: ReviewRequest } },
  ({ host, message }) => Effect.sync(() => host.send(message)),
);
const Model = Schema.Struct({ review: Snapshot });
const Message = UiSchema.TaggedEnum({
  ReceivedReview: { review: Snapshot },
  Requested: { message: ReviewRequest },
  ForwardedRequest: {},
});
type Message = typeof Message.Type;

const reviewEvent = 'zloz-native-export-review';
const customDownload = 'native-export-custom-download';
const NativeReview = Html.component({
  name: 'ArchitectureExportReview',
  props: Schema.Struct({ review: Snapshot, host: Schema.instanceOf(ReviewHost) }),
  model: Model,
  message: Message,
}).make({
  init: ($) => $.set({ review: $.props.review }),
  update: ($, message) =>
    Message.match(message, {
      ReceivedReview: ({ review }) => $.set({ review }),
      Requested: ({ message }) =>
        $.set($.model).run(
          ForwardRequest.make({ host: $.props.host, message }).pipe(
            Command.as(Message.ForwardedRequest()),
          ),
        ),
      ForwardedRequest: () => $.set($.model),
    }),
  view: (h, model) => {
    const review = model.review.controls;
    const { diagnostics, custom } = review;
    if (review.kind === 'svg') {
      return svgReview(
        h,
        review.controls,
        (request) =>
          Message.Requested({ message: WorkbenchMessage.ObservedSvgReviewInput({ request }) }),
        custom
          ? {
              idPrefix: 'zloz-svg-review',
              diagnostics,
              download: { label: '↓ Download reviewed SVG', className: customDownload },
              renderFinding: (finding, builder) =>
                builder.li
                  .class('svg-finding-card')
                  .children(
                    builder.strong(
                      `${finding.severity.toUpperCase()} · ${finding.target.kind}${'id' in finding.target ? ` ${finding.target.id}` : ''}`,
                    ),
                    builder.p(finding.reason),
                  ),
            }
          : { idPrefix: 'zloz-svg-review', diagnostics },
      );
    }
    return pngReview(
      h,
      review.controls,
      (request) =>
        Message.Requested({ message: WorkbenchMessage.ObservedPngReviewInput({ request }) }),
      custom
        ? {
            idPrefix: 'zloz-png-review',
            diagnostics,
            download: { label: '↓ Save reviewed PNG', className: customDownload },
          }
        : { idPrefix: 'zloz-png-review', diagnostics },
    );
  },
});

type MountedReview = {
  readonly scope: Scope.Closeable;
  readonly abort: AbortController;
  latest: ReviewSnapshot;
  send: ((message: Message) => void) | undefined;
};
const mounted = new WeakMap<Node, MountedReview>();

function closeReview(entry: MountedReview) {
  entry.abort.abort();
  const close = Scope.close(entry.scope, Exit.void);
  void Effect.runPromise(close).catch((error) =>
    console.error('Could not dispose the export review.', error),
  );
}

/** Temporary host for the sidebar while Architecture still uses a FoldKit root. */
export function exportReviewPanel(h: HtmlBuilder<WorkbenchMessage>, review: Review) {
  const snapshot = new ReviewSnapshot(review);
  const host = h.div([
    h.Key(`native-export-${review.kind}`),
    h.DataAttribute('architecture-effect-ui-review', review.kind),
    {
      _tag: 'OnCustomEvent',
      name: reviewEvent,
      f: ({ detail }: CustomEvent<unknown>) =>
        isReviewRequest(detail) ? Option.some(detail) : Option.none(),
    },
  ]);
  if (!host) return host;
  host.data = {
    ...host.data,
    hook: {
      insert: ({ elm }) => {
        if (!(elm instanceof Element)) return;
        const entry: MountedReview = {
          scope: Scope.makeUnsafe(),
          abort: new AbortController(),
          latest: snapshot,
          send: undefined,
        };
        mounted.set(elm, entry);
        const mount = BrowserHost.mountEffect(
          NativeReview,
          {
            review: snapshot,
            host: new ReviewHost((detail) => {
              if (!entry.abort.signal.aborted)
                elm.dispatchEvent(new CustomEvent(reviewEvent, { detail }));
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
              root.send(Message.ReceivedReview({ review: entry.latest }));
          },
          (error) => {
            if (!entry.abort.signal.aborted) {
              console.error('Could not mount the export review.', error);
              closeReview(entry);
            }
          },
        );
      },
      postpatch: (_, { elm }) => {
        const entry = elm && mounted.get(elm);
        if (!entry) return;
        entry.latest = snapshot;
        entry.send?.(Message.ReceivedReview({ review: snapshot }));
      },
      destroy: ({ elm }) => {
        const entry = elm && mounted.get(elm);
        if (!entry || !elm) return;
        mounted.delete(elm);
        closeReview(entry);
      },
    },
  };
  return host;
}
