import { UiSchema } from '@effect/ui';
import { canonicalOperationValue } from '@opsydyn/foldkit-zloz';
import {
  contextFingerprint,
  relationshipContext,
  RelationshipContextSchema,
  RelationshipDecisionOutcomeSchema,
  RelationshipDecisionContentSchema,
  type RelationshipDecision,
  type RelationshipDecisionRequest,
} from '@opsydyn/foldkit-zloz-alchemy/relationship-decision';
import type { DiagramFrame, DiagramRoom } from '@opsydyn/foldkit-zloz-alchemy/session';
import {
  ClefAdvice,
  ClefReference,
  sameClefReference,
} from '@opsydyn/zloz-server/src/clef-contract';
import { Effect, Option, Schema } from 'effect';
import { Command } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';

import { pathFor } from './protocol';

const Draft = Schema.Struct({
  context: Schema.NullOr(RelationshipContextSchema),
  statement: Schema.String,
  rationale: Schema.String,
  evidence: Schema.String,
  openQuestion: Schema.String,
});
const Write = Schema.Struct({
  operationId: Schema.String,
  command: Schema.Union([
    Schema.Struct({
      type: Schema.Literal('ShareProposal'),
      proposalId: Schema.String,
      context: RelationshipContextSchema,
      content: RelationshipDecisionContentSchema,
    }),
    Schema.Struct({
      type: Schema.Literals(['AcceptProposal', 'WithdrawProposal']),
      proposalId: Schema.String,
      revision: Schema.Number,
    }),
  ]),
});
const Pending = Schema.Struct({
  write: Write,
  status: Schema.Literals(['sending', 'uncertain', 'awaiting-frame']),
});
const ClefOutcome = Schema.Union([
  ClefAdvice,
  Schema.Literals(['unavailable', 'changed', 'limited']),
]);
const ClefReview = Schema.Struct({
  serial: Schema.Number,
  reference: ClefReference,
  result: Schema.NullOr(ClefOutcome),
});
export const Model = Schema.Struct({
  draft: Draft,
  pending: Schema.NullOr(Pending),
  serial: Schema.Number,
  notice: Schema.String,
  clefReview: Schema.NullOr(ClefReview),
});
export type Model = typeof Model.Type;
const emptyDraft: typeof Draft.Type = {
  context: null,
  statement: '',
  rationale: '',
  evidence: '',
  openQuestion: '',
};
export const init = (): Model => ({
  draft: emptyDraft,
  pending: null,
  serial: 0,
  notice: '',
  clefReview: null,
});
export const Message = UiSchema.TaggedEnum({
  ChangedDraft: {
    field: Schema.Literals(['statement', 'rationale', 'evidence', 'openQuestion']),
    text: Schema.String,
  },
  ReviewedContext: {},
  ClickedShare: {},
  ClickedAccept: { proposalId: Schema.String, revision: Schema.Number },
  ClickedWithdraw: { proposalId: Schema.String, revision: Schema.Number },
  ClickedRetry: {},
  ClickedClefReview: { reference: ClefReference },
  SettledClefReview: { serial: Schema.Number, result: ClefOutcome },
  SettledWrite: {
    operationId: Schema.String,
    result: Schema.Union([
      RelationshipDecisionOutcomeSchema,
      Schema.Literals(['uncertain', 'unauthorized', 'invalid']),
    ]),
  },
});
export type Message = typeof Message.Type;
interface Context {
  readonly room: DiagramRoom;
  readonly frame: DiagramFrame | null;
  readonly relationshipId: string | undefined;
  readonly authoring: boolean;
  readonly clefShadow: boolean;
  readonly isOwner: boolean;
  readonly actorLabel: (id: string) => string;
}
const contextFor = (context: Context, relationshipId: string | undefined) =>
  context.frame && relationshipId
    ? relationshipContext(
        context.frame.document.graph,
        relationshipId,
        context.frame.relationshipDecisionRecoveryVersion ?? 0,
      )
    : Option.none();
const sameContext = (
  left: typeof Draft.Type.context,
  right: typeof RelationshipContextSchema.Type,
) => left !== null && canonicalOperationValue(left) === canonicalOperationValue(right);
const reviews = (frame: DiagramFrame | null) => frame?.relationshipDecisions ?? [];
const liveClefProposal = (context: Context, record: RelationshipDecision) => {
  if (!context.clefShadow || !context.authoring || record.status !== 'proposed') return false;
  const target = contextFor(context, record.relationshipId);
  return Option.isSome(target) && sameContext(record.context, target.value);
};
const ReviewWithClef = Command.define('ReviewWithClef', {
  args: { path: Schema.String, serial: Schema.Number, reference: ClefReference },
  messages: [Message.cases.SettledClefReview],
  execute: ({ path, serial, reference }) => {
    const settled = (result: typeof ClefOutcome.Type) =>
      Message.SettledClefReview({ serial, result });
    return Effect.tryPromise(async (signal) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reference),
        signal: AbortSignal.any([signal, AbortSignal.timeout(22_000)]),
      });
      if (response.status === 409) return settled('changed');
      if (response.status === 429) return settled('limited');
      if (!response.ok) return settled('unavailable');
      const advice = Schema.decodeUnknownSync(ClefAdvice)(await response.json());
      return settled(sameClefReference(reference, advice) ? advice : 'unavailable');
    }).pipe(Effect.orElseSucceed(() => settled('unavailable')));
  },
});
const reviewNotice = {
  changed: 'The proposal changed before the review finished.',
  limited: 'Clef is receiving too many requests. Try again shortly.',
  unavailable: 'Clef review is temporarily unavailable.',
};
const probability = new Intl.NumberFormat('en', {
  style: 'percent',
  maximumFractionDigits: 2,
});

function confirmed(pending: typeof Pending.Type, frame: DiagramFrame | null, actorId: string) {
  const input = pending.write.command;
  const record = reviews(frame).find((item) => item.proposalId === input.proposalId);
  if (input.type === 'ShareProposal') return record?.requestedBy === actorId;
  if (input.type === 'AcceptProposal')
    return (
      record?.status === 'accepted' &&
      record.acceptedBy === actorId &&
      record.revision === input.revision
    );
  return (
    record?.status === 'withdrawn' &&
    record.withdrawnBy === actorId &&
    record.revision === input.revision
  );
}
export function observe(model: Model, frame: DiagramFrame | null, actorId: string): Model {
  if (model.pending?.status !== 'awaiting-frame' || !confirmed(model.pending, frame, actorId))
    return model;
  return { ...model, pending: null, notice: '' };
}
const SaveDecision = Command.define('SaveDecision', {
  args: { path: Schema.String, write: Write },
  messages: [Message.cases.SettledWrite],
  execute: ({ path, write }) => {
    const { operationId, command } = write;
    const settled = (result: Parameters<typeof Message.SettledWrite>[0]['result']) =>
      Message.SettledWrite({ operationId, result });
    return Effect.tryPromise(async (signal) => {
      const request: RelationshipDecisionRequest = {
        version: 1,
        operationId,
        command:
          command.type === 'ShareProposal'
            ? {
                type: 'ShareProposal',
                proposalId: command.proposalId,
                relationshipId: command.context.relationship.id,
                contextFingerprint: await contextFingerprint(command.context),
                draft: { kind: 'manual', content: command.content },
              }
            : command.type === 'AcceptProposal'
              ? {
                  type: 'AcceptProposal',
                  proposalId: command.proposalId,
                  revision: command.revision,
                }
              : {
                  type: 'WithdrawProposal',
                  proposalId: command.proposalId,
                  revision: command.revision,
                },
      };
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      if (response.status === 401 || response.status === 403 || response.status === 404)
        return settled('unauthorized');
      if (response.status === 400 || response.status === 413) return settled('invalid');
      if (!response.ok) return settled('uncertain');
      return settled(
        Schema.decodeUnknownSync(RelationshipDecisionOutcomeSchema)(await response.json()),
      );
    }).pipe(Effect.orElseSucceed(() => settled('uncertain')));
  },
});
const pendingNotice = {
  sending: 'Saving decision…',
  uncertain: 'Save outcome unknown. Retry the same request.',
  'awaiting-frame': 'Waiting for live confirmation…',
};
function submit(
  model: Model,
  context: Context,
  command: typeof Write.Type.command,
): Return<Model, Message> {
  if (!context.authoring || model.pending) return { model };
  const serial = model.serial + 1;
  const write: typeof Write.Type = {
    operationId: `opy-${context.room.generation}-${serial}`,
    command,
  };
  return {
    model: { ...model, serial, pending: { write, status: 'sending' }, notice: '' },
    commands: [SaveDecision({ path: pathFor(context.room) + '/decisions', write })],
  };
}
const explain = {
  ContextChanged:
    'The relationship changed. Review the current context before sharing or accepting.',
  RelationshipMissing: 'The relationship is no longer on the diagram.',
  ProposalNotOpen: 'This proposal has already been reviewed.',
  RevisionMismatch: 'Open the current proposal before accepting it.',
  OperationIdMismatch: 'The saved request differs. Open the current proposal and try again.',
  DecisionCapacity: 'The decision exceeds the available capacity.',
  ProposalIdUsed: 'This proposal already exists.',
  RelationshipAlreadyAssigned: 'This relationship already has a proposal or accepted decision.',
};
export function update(model: Model, message: Message, context: Context): Return<Model, Message> {
  return Message.match(message, {
    ChangedDraft: ({ field, text }) => {
      const current = contextFor(context, context.relationshipId);
      if (model.pending || Option.isNone(current)) return { model };
      return {
        model: {
          ...model,
          draft: { ...model.draft, context: model.draft.context ?? current.value, [field]: text },
        },
      };
    },
    ReviewedContext: () => {
      const current = contextFor(context, context.relationshipId);
      if (model.pending || Option.isNone(current)) return { model };
      return { model: { ...model, draft: { ...model.draft, context: current.value } } };
    },
    ClickedShare: () => {
      const current = contextFor(context, context.relationshipId);
      if (Option.isNone(current) || !sameContext(model.draft.context, current.value))
        return { model };
      const content = {
        statement: model.draft.statement.trim(),
        rationale: model.draft.rationale.trim(),
        evidence: model.draft.evidence.trim()
          ? [{ kind: 'excerpt' as const, text: model.draft.evidence.trim() }]
          : [],
        openQuestion: model.draft.openQuestion.trim() || null,
      };
      const command = {
        type: 'ShareProposal',
        proposalId: `opy-${context.room.generation}-${model.serial + 1}`,
        context: current.value,
        content,
      } as const;
      return Schema.is(RelationshipDecisionContentSchema)(content)
        ? submit(model, context, command)
        : { model: { ...model, notice: 'Check the decision text and length.' } };
    },
    ClickedAccept: ({ proposalId, revision }) =>
      submit(model, context, { type: 'AcceptProposal', proposalId, revision }),
    ClickedWithdraw: ({ proposalId, revision }) =>
      submit(model, context, { type: 'WithdrawProposal', proposalId, revision }),
    ClickedRetry: () => {
      const pending = model.pending;
      return context.authoring && pending?.status === 'uncertain'
        ? {
            model: { ...model, pending: { ...pending, status: 'sending' as const } },
            commands: [
              SaveDecision({ path: pathFor(context.room) + '/decisions', write: pending.write }),
            ],
          }
        : { model };
    },
    ClickedClefReview: ({ reference }) => {
      if (model.clefReview?.result === null) return { model };
      const record = reviews(context.frame).find((item) => sameClefReference(item, reference));
      if (!record || !liveClefProposal(context, record)) return { model };
      const serial = model.serial + 1;
      return {
        model: { ...model, serial, clefReview: { serial, reference, result: null } },
        commands: [
          ReviewWithClef({ path: pathFor(context.room) + '/clef-review', serial, reference }),
        ],
      };
    },
    SettledClefReview: ({ serial, result }) => {
      const review = model.clefReview;
      if (review?.serial !== serial) return { model };
      return { model: { ...model, clefReview: { ...review, result } } };
    },
    SettledWrite: ({ operationId, result }) => {
      const pending = model.pending;
      if (pending?.write.operationId !== operationId) return { model };
      if (result === 'uncertain')
        return { model: { ...model, pending: { ...pending, status: 'uncertain' as const } } };
      if (result === 'invalid' || result === 'unauthorized')
        return {
          model: {
            ...model,
            pending: null,
            notice:
              result === 'invalid'
                ? 'Check the decision text and length.'
                : 'This action is unavailable. Check your access.',
          },
        };
      if (result.status === 'rejected')
        return { model: { ...model, pending: null, notice: explain[result.code] } };
      return {
        model: observe(
          {
            ...model,
            pending: { ...pending, status: 'awaiting-frame' as const },
            draft: pending.write.command.type === 'ShareProposal' ? emptyDraft : model.draft,
          },
          context.frame,
          context.room.actorId,
        ),
      };
    },
  });
}
export function view<M>(
  model: Model,
  context: Context,
  h: HtmlBuilder<M>,
  emit: (message: Message) => M,
): Html {
  const current = contextFor(context, context.relationshipId);
  const records = reviews(context.frame);
  const available = context.authoring && model.pending === null;
  const fields = [
    ['statement', 'Decision', 512],
    ['rationale', 'Rationale', 2048],
    ['evidence', 'Evidence excerpt', 1024],
    ['openQuestion', 'Open question', 1024],
  ] as const;
  const card = (record: RelationshipDecision) => {
    const target = contextFor(context, record.relationshipId);
    const fresh = Option.isSome(target) && sameContext(record.context, target.value);
    const status =
      record.status === 'accepted'
        ? 'Accepted · implementation unverified'
        : record.status === 'proposed'
          ? 'Proposal awaiting review'
          : 'Proposal withdrawn';
    const button = (text: string, message: Message, primary = false) =>
      h.button(
        [
          h.Type('button'),
          h.OnClick(emit(message)),
          ...(primary ? [h.Class('inspector-primary')] : []),
        ],
        [text],
      );
    const reference = {
      proposalId: record.proposalId,
      revision: record.revision,
      contextFingerprint: record.contextFingerprint,
    };
    const reviewing = model.clefReview?.result === null;
    const shadow = model.clefReview;
    const shadowNotice =
      shadow && sameClefReference(shadow.reference, reference)
        ? shadow.result === null
          ? 'Clef is reviewing the evidence…'
          : Schema.is(ClefAdvice)(shadow.result)
            ? `Clef estimates a ${probability.format(shadow.result.needsEvidenceProbability)} chance that more evidence is needed.`
            : reviewNotice[shadow.result]
        : '';
    return h.article(
      [h.Class('opy-card'), h.Key(record.proposalId)],
      [
        h.h3([], [record.context.source.label + ' → ' + record.context.target.label]),
        h.p([h.Class('opy-status')], [status]),
        ...(fresh ? [] : [h.p([], ['Context changed'])]),
        h.p([], [record.content.statement]),
        h.p([], [record.content.rationale]),
        ...record.content.evidence.map(({ text }) => h.blockquote([], [text])),
        ...(record.content.openQuestion
          ? [h.p([], ['Open question · ' + record.content.openQuestion])]
          : []),
        h.p(
          [],
          [
            `Requested by ${context.actorLabel(record.requestedBy)} · ${record.proposer.kind === 'opy' ? 'Proposed by OPY' : 'Human draft'}`,
          ],
        ),
        ...(record.status === 'accepted'
          ? [h.p([], [`Accepted by ${context.actorLabel(record.acceptedBy)}`])]
          : []),
        ...(liveClefProposal(context, record)
          ? [
              h.p(
                [],
                [
                  'Send this proposal’s text and evidence to Cloudflare for an advisory shown only in this session.',
                ],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Disabled(reviewing),
                  h.OnClick(emit(Message.ClickedClefReview({ reference }))),
                ],
                ['Run Clef review'],
              ),
              h.p([h.Role('status')], [shadowNotice]),
            ]
          : []),
        ...(record.status === 'proposed' && available && fresh
          ? [
              button(
                'Accept decision',
                Message.ClickedAccept({ proposalId: record.proposalId, revision: record.revision }),
                true,
              ),
            ]
          : []),
        ...(record.status === 'proposed' &&
        available &&
        (context.isOwner || record.requestedBy === context.room.actorId)
          ? [
              button(
                'Withdraw proposal',
                Message.ClickedWithdraw({
                  proposalId: record.proposalId,
                  revision: record.revision,
                }),
              ),
            ]
          : []),
      ],
    );
  };
  const editable =
    Option.isSome(current) &&
    context.authoring &&
    !records.some(
      (record) => record.relationshipId === context.relationshipId && record.status !== 'withdrawn',
    );
  const reviewed = Option.isSome(current) && sameContext(model.draft.context, current.value);
  return h.div(
    [
      h.Id('opy-inspector'),
      h.Class('opy-inspector'),
      h.Role('region'),
      h.AriaLabel('OPY relationship decisions'),
    ],
    [
      h.div(
        [h.Class('opy-header')],
        [h.span([h.Class('opy-lens'), h.AriaHidden(true)], []), h.h2([], ['OPY'])],
      ),
      ...records.map(card),
      ...(editable && Option.isSome(current)
        ? [
            h.div(
              [h.Class('opy-composer')],
              [
                h.p(
                  [],
                  [`Draft for ${current.value.source.label} → ${current.value.target.label}`],
                ),
                ...fields.map(([field, label, length]) =>
                  h.label(
                    [],
                    [
                      label,
                      h.textarea([
                        h.AriaLabel(label),
                        h.Value(model.draft[field]),
                        h.Maxlength(length),
                        h.Disabled(!available),
                        h.OnInput((text) => emit(Message.ChangedDraft({ field, text }))),
                      ]),
                    ],
                  ),
                ),
                ...(model.draft.context && !reviewed
                  ? [
                      h.button(
                        [
                          h.Type('button'),
                          h.Disabled(!available),
                          h.OnClick(emit(Message.ReviewedContext())),
                        ],
                        ['Review current relationship'],
                      ),
                    ]
                  : []),
                h.button(
                  [
                    h.Class('inspector-primary'),
                    h.Type('button'),
                    h.Disabled(
                      !available ||
                        !reviewed ||
                        !model.draft.statement.trim() ||
                        !model.draft.rationale.trim(),
                    ),
                    h.OnClick(emit(Message.ClickedShare())),
                  ],
                  ['Share proposal'],
                ),
              ],
            ),
          ]
        : records.length === 0
          ? [h.p([], ['Select a relationship to draft a decision.'])]
          : []),
      h.p([h.Role('status')], [model.pending ? pendingNotice[model.pending.status] : model.notice]),
      ...(model.pending?.status === 'uncertain' && context.authoring
        ? [
            h.button(
              [h.Type('button'), h.OnClick(emit(Message.ClickedRetry()))],
              ['Retry decision'],
            ),
          ]
        : []),
    ],
  );
}
