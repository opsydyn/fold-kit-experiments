import type { Html, HtmlBuilder } from 'foldkit/html';

import type { ZlozModellingPatchChange, ZlozModellingPatchFinding } from './modelling-patch';
import type {
  ZlozModellingPatchReview,
  ZlozModellingPatchReviewRequest,
} from './modelling-patch-apply';
import type { ZlozModellingPatchReviewV3 } from './modelling-patch-v3-apply';
type Attributes<M> = Parameters<HtmlBuilder<M>['div']>[0];
export type ZlozModellingPatchReviewParts = Readonly<{
  summary: Html | null;
  findings: Html;
  changes: Html;
  acknowledgement: Html | null;
  apply: Html | null;
  status: Html;
}>;
export type ZlozModellingPatchReviewViewOptions<
  M,
  C extends ZlozModellingPatchReview | ZlozModellingPatchReviewV3 = ZlozModellingPatchReview,
> = Readonly<{
  attributes?: Attributes<M>;
  showCounts?: boolean;
  instructions?: boolean;
  renderSummary?: (context: C, h: HtmlBuilder<M>) => Html | null | undefined;
  renderFinding?: (
    finding: ZlozModellingPatchFinding,
    h: HtmlBuilder<M>,
  ) => Html | null | undefined;
  renderChange?: (change: ZlozModellingPatchChange, h: HtmlBuilder<M>) => Html | null | undefined;
  renderLayout?: (parts: ZlozModellingPatchReviewParts, h: HtmlBuilder<M>) => readonly Html[];
}>;
export function zlozModellingPatchAcknowledgement<
  M,
  C extends ZlozModellingPatchReview | ZlozModellingPatchReviewV3 = ZlozModellingPatchReview,
>(
  h: HtmlBuilder<M>,
  context: C,
  onRequest: (request: ZlozModellingPatchReviewRequest) => M,
  attributes: Attributes<M> = [],
): Html {
  return h.input([
    ...attributes,
    h.Type('checkbox'),
    h.Checked(context.acknowledged),
    h.Disabled(context.reason !== null || context.key === null),
    h.OnClick(
      onRequest({
        type: 'AcknowledgementChanged',
        key: context.key ?? '',
        accepted: !context.acknowledged,
      }),
    ),
  ]);
}
export function zlozModellingPatchApply<
  M,
  C extends ZlozModellingPatchReview | ZlozModellingPatchReviewV3 = ZlozModellingPatchReview,
>(
  h: HtmlBuilder<M>,
  context: C,
  onRequest: (request: ZlozModellingPatchReviewRequest) => M,
  attributes: Attributes<M> = [],
  children: Parameters<HtmlBuilder<M>['button']>[1] = ['Apply reviewed patch'],
): Html {
  return h.button(
    [
      ...attributes,
      h.Type('button'),
      h.Disabled(!context.canApply),
      h.OnClick(onRequest({ type: 'ApplyClicked', key: context.key ?? '' })),
    ],
    children,
  );
}
/** Native defaults and nullable render slots; all authority remains in live core Apply. */
export function zlozModellingPatchReview<
  M,
  C extends ZlozModellingPatchReview | ZlozModellingPatchReviewV3 = ZlozModellingPatchReview,
>(
  h: HtmlBuilder<M>,
  context: C,
  onRequest: (request: ZlozModellingPatchReviewRequest) => M,
  options: ZlozModellingPatchReviewViewOptions<M, C> = {},
): Html {
  const preview = context.preview,
    custom = options.renderSummary?.(context, h);
  const summary =
    custom === undefined
      ? preview.type === 'rejected'
        ? null
        : h.div(
            [],
            [
              h.strong([], [preview.patch.id]),
              h.details(
                [],
                [
                  h.summary([], ['Source identity']),
                  h.p([], [`${preview.patch.source.modelId} · ${preview.patch.source.sessionId}`]),
                ],
              ),
              h.p(
                [],
                [
                  `${preview.patch.provenance.actor.kind}: ${preview.patch.provenance.actor.id} · ${preview.patch.provenance.reason}`,
                ],
              ),
              ...(options.showCounts === false
                ? []
                : [
                    h.p(
                      [h.DataAttribute('patch-counts', '')],
                      [
                        `${preview.changes.length} changes · ${preview.losses.length} loss disclosures · source revision ${preview.patch.source.revision}`,
                      ],
                    ),
                  ]),
            ],
          )
      : custom;
  const findings = h.ul(
    [h.AriaLabel('Patch findings')],
    preview.findings.flatMap((f) => {
      const item = options.renderFinding?.(f, h);
      return item === null ? [] : [item ?? h.li([], [`${f.code}: ${f.message}`])];
    }),
  );
  const changes = h.div(
    [h.AriaLabel('Proposed patch changes')],
    preview.type === 'rejected'
      ? []
      : preview.changes.flatMap((c) => {
          const custom = options.renderChange?.(c, h);
          return custom === null
            ? []
            : [
                custom ??
                  h.details(
                    [],
                    [
                      h.summary([], [`${c.entity} ${c.id} · ${c.operationId}`]),
                      h.pre([], [JSON.stringify({ before: c.before, after: c.after }, null, 2)]),
                    ],
                  ),
              ];
        }),
  );
  const acknowledgement = context.key
    ? h.label(
        [],
        [
          zlozModellingPatchAcknowledgement(h, context, onRequest),
          'I reviewed the proposed changes and accept the disclosed losses.',
        ],
      )
    : null;
  const apply = context.key ? zlozModellingPatchApply(h, context, onRequest) : null;
  const status = h.p(
    [h.Role('status'), h.AriaLive('polite')],
    [
      context.reason ??
        (context.acknowledged
          ? 'Exact changes acknowledged. Apply rechecks current source and protection.'
          : 'Review and acknowledge the exact proposed changes and losses before Apply.'),
    ],
  );
  const parts = { summary, findings, changes, acknowledgement, apply, status };
  return h.div(
    [h.DataAttribute('patch-review', ''), ...(options.attributes ?? [])],
    [
      ...(options.instructions === false
        ? []
        : [
            h.p(
              [],
              ['Inspect before/after values and findings. Apply is atomic and adds one Undo.'],
            ),
          ]),
      ...(options.renderLayout?.(parts, h) ??
        [summary, status, findings, changes, acknowledgement, apply].flatMap((p) =>
          p === null ? [] : [p],
        )),
    ],
  );
}
