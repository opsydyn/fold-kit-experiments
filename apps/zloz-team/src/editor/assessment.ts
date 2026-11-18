import { canonicalOperationValue } from '@opsydyn/foldkit-zloz';
import {
  AssessmentRequestSchema,
  AssessmentReplySchema,
  type AssessmentRecord,
  type AssessmentReply,
} from '@opsydyn/foldkit-zloz-alchemy/assessment';
import type { DiagramFrame, DiagramRoom } from '@opsydyn/foldkit-zloz-alchemy/session';
import {
  evaluateCouplingAssessment,
  type ZlozCouplingAssessment,
  type ZlozCouplingInput,
} from '@opsydyn/foldkit-zloz/coupling';
import { Effect, Option, Schema } from 'effect';
import { Command } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import { pathFor } from './protocol';

const Field = Schema.Literals(['integrationType', 'strength', 'distance', 'volatility']);
type Field = typeof Field.Type;
const Basis = Schema.Literals(['declared', 'observed', 'derived']);
const Input = Schema.Struct({ value: Schema.String, basis: Basis, evidence: Schema.String });
const Draft = Schema.Struct({
  target: Schema.Struct({
    documentId: Schema.String,
    graphVersion: Schema.Number,
    relationshipId: Schema.String,
    sourceNodeId: Schema.String,
    targetNodeId: Schema.String,
  }),
  expectedRevision: Schema.Number,
  abstraction: Schema.String,
  horizon: Schema.String,
  integrationType: Input,
  strength: Input,
  distance: Input,
  volatility: Input,
});
type Draft = typeof Draft.Type;
const Delivery = Schema.Union([
  Schema.Struct({ status: Schema.Literal('ready') }),
  Schema.Struct({
    status: Schema.Literals(['sending', 'uncertain']),
    request: AssessmentRequestSchema,
  }),
]);
export const Model = Schema.Union([
  Schema.Struct({ status: Schema.Literal('closed'), notice: Schema.String }),
  Schema.Struct({
    status: Schema.Literal('editing'),
    draft: Draft,
    delivery: Delivery,
    notice: Schema.String,
  }),
]);
export type Model = typeof Model.Type;
export const init = (): Model => ({ status: 'closed', notice: '' });
export const Message = defineMessageUnion({
  SelectedRelationship: { id: Schema.String },
  ChangedScope: { field: Schema.Literals(['abstraction', 'horizon']), text: Schema.String },
  ChangedValue: { field: Field, value: Schema.String },
  ChangedBasis: { field: Field, value: Basis },
  ChangedEvidence: { field: Field, text: Schema.String },
  ClickedClose: {},
  ClickedLoadShared: {},
  ClickedReviewGraph: {},
  ClickedSave: {},
  ClickedRetry: {},
  AllocatedSave: { request: AssessmentRequestSchema },
  FailedAllocation: {},
  SettledSave: {
    operationId: Schema.String,
    reply: Schema.NullOr(AssessmentReplySchema),
    status: Schema.Number,
  },
});
export type Message = typeof Message.Type;
type Context = Readonly<{
  room: DiagramRoom;
  frame: DiagramFrame | null;
  editable: boolean;
  graphPending: boolean;
}>;
const recordFor = (frame: DiagramFrame, id: string) =>
  frame.assessments?.find((record) => record.assessment.target.relationshipId === id);
const fromInput = <T extends string>(input: ZlozCouplingInput<T>) =>
  input.status === 'known'
    ? { value: input.value, basis: input.basis, evidence: input.rationale }
    : { value: 'unknown', basis: 'declared' as const, evidence: input.reason };
const draftFrom = (record: AssessmentRecord): Draft => ({
  target: record.assessment.target,
  expectedRevision: record.revision,
  ...record.assessment.scope,
  integrationType: fromInput(record.assessment.inputs.integrationType),
  strength: fromInput(record.assessment.inputs.strength),
  distance: fromInput(record.assessment.inputs.distance),
  volatility: fromInput(record.assessment.inputs.volatility),
});
function open(frame: DiagramFrame, id: string): Model {
  const saved = recordFor(frame, id);
  if (saved)
    return {
      status: 'editing',
      draft: draftFrom(saved),
      delivery: { status: 'ready' },
      notice: '',
    };
  const edge = frame.document.graph.edges.find((edge) => edge.id === id);
  if (!edge) return init();
  const empty = () => ({ value: 'unknown', basis: 'declared' as const, evidence: '' });
  return {
    status: 'editing',
    delivery: { status: 'ready' },
    notice: '',
    draft: {
      target: {
        documentId: frame.target.diagramId,
        graphVersion: frame.document.version,
        relationshipId: id,
        sourceNodeId: edge.source.node,
        targetNodeId: edge.target.node,
      },
      expectedRevision: 0,
      abstraction: '',
      horizon: '',
      integrationType: empty(),
      strength: empty(),
      distance: empty(),
      volatility: empty(),
    },
  };
}
function input<T extends string>(
  draft: typeof Input.Type,
  values: readonly T[],
): Option.Option<ZlozCouplingInput<T>> {
  if (!draft.evidence.trim()) return Option.none();
  if (draft.value === 'unknown') return Option.some({ status: 'unknown', reason: draft.evidence });
  const value = values.find((value) => value === draft.value);
  return value
    ? Option.some({ status: 'known', value, basis: draft.basis, rationale: draft.evidence })
    : Option.none();
}
export function authoredAssessment(draft: Draft): Option.Option<ZlozCouplingAssessment> {
  const integrationType = input(draft.integrationType, [
    'intrusive',
    'functional',
    'model',
    'contract',
  ] as const);
  const strength = input(draft.strength, ['low', 'high'] as const);
  const distance = input(draft.distance, ['low', 'high'] as const);
  const volatility = input(draft.volatility, ['low', 'high'] as const);
  if (
    Option.isNone(integrationType) ||
    Option.isNone(strength) ||
    Option.isNone(distance) ||
    Option.isNone(volatility) ||
    !draft.abstraction.trim() ||
    !draft.horizon.trim()
  )
    return Option.none();
  return Option.some({
    format: 'foldkit-zloz-coupling',
    version: 1,
    modelVersion: 'balanced-coupling-binary/v1',
    target: draft.target,
    scope: { abstraction: draft.abstraction, horizon: draft.horizon },
    inputs: {
      integrationType: integrationType.value,
      strength: strength.value,
      distance: distance.value,
      volatility: volatility.value,
    },
  });
}
const AllocateAssessmentSave = Command.define('AllocateAssessmentSave', {
  args: { draft: Draft },
  messages: [Message.AllocatedSave, Message.FailedAllocation],
  execute: ({ draft }) =>
    Effect.try(() => {
      const assessment = authoredAssessment(draft);
      if (Option.isNone(assessment)) return Message.FailedAllocation();
      return Message.AllocatedSave({
        request: {
          version: 1,
          operationId: crypto.randomUUID(),
          expectedRevision: draft.expectedRevision,
          assessment: assessment.value,
        },
      });
    }).pipe(Effect.orElseSucceed(() => Message.FailedAllocation())),
});
const SubmitAssessmentSave = Command.define('SubmitAssessmentSave', {
  args: {
    room: Schema.Struct({
      teamId: Schema.String,
      diagramId: Schema.String,
      actorId: Schema.String,
      generation: Schema.String,
    }),
    request: AssessmentRequestSchema,
  },
  messages: [Message.SettledSave],
  execute: ({ room, request }) =>
    Effect.tryPromise(async (signal) => {
      const response = await fetch(`${pathFor(room)}/assessments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      });
      const reply = response.ok
        ? Schema.decodeUnknownSync(AssessmentReplySchema)(await response.json())
        : null;
      return Message.SettledSave({
        operationId: request.operationId,
        reply,
        status: response.status,
      });
    }).pipe(
      Effect.orElseSucceed(() =>
        Message.SettledSave({ operationId: request.operationId, reply: null, status: 0 }),
      ),
    ),
});
function settled(model: Model, reply: AssessmentReply, actorId: string): Model {
  if (model.status !== 'editing' || model.delivery.status === 'ready') return model;
  const request = model.delivery.request;
  if (reply.operationId !== request.operationId) return model;
  if (reply.decision.status === 'accepted') {
    const record = reply.decision.record;
    if (
      record.authoredBy !== actorId ||
      record.operationId !== request.operationId ||
      record.revision !== request.expectedRevision + 1 ||
      canonicalOperationValue(record.assessment) !== canonicalOperationValue(request.assessment)
    )
      return model;
    return {
      status: 'editing',
      draft: draftFrom(record),
      delivery: { status: 'ready' },
      notice: `Saved assessment revision ${record.revision}.`,
    };
  }
  return {
    ...model,
    delivery: { status: 'ready' },
    notice: `Save refused: ${reply.decision.code}. Review the shared assessment and current graph.`,
  };
}
/** Live snapshots settle only an exact accepted request, never replace an unsaved draft. */
export function observe(model: Model, frame: DiagramFrame, actorId: string): Model {
  if (model.status !== 'editing' || model.delivery.status === 'ready') return model;
  const record = recordFor(frame, model.draft.target.relationshipId);
  return record?.authoredBy === actorId
    ? settled(
        model,
        {
          operationId: record.operationId,
          decision: { status: 'accepted', record },
          sourceVersion: frame.sourceVersion,
        },
        actorId,
      )
    : model;
}
export function update(model: Model, message: Message, context: Context): Return<Model, Message> {
  const editable = context.editable && !context.graphPending;
  const ready = model.status === 'editing' && model.delivery.status === 'ready';
  return Message.match<Return<Model, Message>>(message, {
    SelectedRelationship: ({ id }) => ({
      model: model.status === 'closed' && context.frame ? open(context.frame, id) : model,
    }),
    ClickedClose: () => ({ model: ready ? init() : model }),
    ClickedLoadShared: () => ({
      model:
        ready && context.frame ? open(context.frame, model.draft.target.relationshipId) : model,
    }),
    ClickedReviewGraph: () => {
      if (!ready || !editable || !context.frame) return { model };
      const edge = context.frame.document.graph.edges.find(
        (edge) => edge.id === model.draft.target.relationshipId,
      );
      return {
        model: edge
          ? {
              ...model,
              draft: {
                ...model.draft,
                target: {
                  documentId: context.frame.target.diagramId,
                  graphVersion: context.frame.document.version,
                  relationshipId: edge.id,
                  sourceNodeId: edge.source.node,
                  targetNodeId: edge.target.node,
                },
              },
              notice: 'Reviewed against current diagram. Check all evidence before saving.',
            }
          : { ...model, notice: 'Relationship removed. This assessment cannot be rebound.' },
      };
    },
    ChangedScope: ({ field, text }) => ({
      model:
        ready && editable
          ? {
              ...model,
              notice: 'Unsaved assessment draft.',
              draft: { ...model.draft, [field]: text.slice(0, 2048) },
            }
          : model,
    }),
    ChangedValue: ({ field, value }) => ({
      model:
        ready && editable
          ? {
              ...model,
              notice: 'Unsaved assessment draft.',
              draft: { ...model.draft, [field]: { ...model.draft[field], value } },
            }
          : model,
    }),
    ChangedBasis: ({ field, value }) => ({
      model:
        ready && editable
          ? {
              ...model,
              notice: 'Unsaved assessment draft.',
              draft: { ...model.draft, [field]: { ...model.draft[field], basis: value } },
            }
          : model,
    }),
    ChangedEvidence: ({ field, text }) => ({
      model:
        ready && editable
          ? {
              ...model,
              notice: 'Unsaved assessment draft.',
              draft: {
                ...model.draft,
                [field]: { ...model.draft[field], evidence: text.slice(0, 2048) },
              },
            }
          : model,
    }),
    ClickedSave: () => {
      if (
        !ready ||
        !editable ||
        !context.frame ||
        Option.isNone(authoredAssessment(model.draft)) ||
        model.draft.target.graphVersion !== context.frame.document.version ||
        (recordFor(context.frame, model.draft.target.relationshipId)?.revision ?? 0) !==
          model.draft.expectedRevision
      )
        return { model };
      return { model, commands: [AllocateAssessmentSave({ draft: model.draft })] };
    },
    AllocatedSave: ({ request }) => {
      if (
        !ready ||
        !editable ||
        canonicalOperationValue(Option.getOrUndefined(authoredAssessment(model.draft))) !==
          canonicalOperationValue(request.assessment) ||
        model.draft.expectedRevision !== request.expectedRevision
      )
        return { model };
      return {
        model: { ...model, delivery: { status: 'sending', request }, notice: 'Saving assessment…' },
        commands: [SubmitAssessmentSave({ room: context.room, request })],
      };
    },
    FailedAllocation: () => ({
      model: ready
        ? { ...model, notice: 'Could not prepare save. Review required fields and retry.' }
        : model,
    }),
    ClickedRetry: () =>
      model.status === 'editing' && model.delivery.status === 'uncertain' && editable
        ? {
            model: {
              ...model,
              delivery: { ...model.delivery, status: 'sending' },
              notice: 'Retrying original assessment request…',
            },
            commands: [
              SubmitAssessmentSave({ room: context.room, request: model.delivery.request }),
            ],
          }
        : { model },
    SettledSave: ({ operationId, reply, status }) => {
      if (
        model.status !== 'editing' ||
        model.delivery.status === 'ready' ||
        model.delivery.request.operationId !== operationId
      )
        return { model };
      if (reply) {
        const next = settled(model, reply, context.room.actorId);
        if (next !== model) return { model: next };
      }
      if ([400, 401, 403, 409, 413].includes(status))
        return {
          model: {
            ...model,
            delivery: { status: 'ready' },
            notice: `Save refused (HTTP ${status}). Refresh access or review inputs.`,
          },
        };
      return {
        model: {
          ...model,
          delivery: { ...model.delivery, status: 'uncertain' },
          notice: 'Save outcome unknown. Retry the original request to recover its result.',
        },
      };
    },
  });
}
const labels = {
  integrationType: 'Integration type',
  strength: 'Strength',
  distance: 'Distance',
  volatility: 'Volatility',
} as const;
export function view<P>(
  model: Model,
  context: Context,
  h: HtmlBuilder<P>,
  toParent: (message: Message) => P,
): Html {
  const frame = context.frame;
  const button = (label: string, message: Message, disabled = false) =>
    h.button([h.Type('button'), h.Disabled(disabled), h.OnClick(toParent(message))], [label]);
  if (!frame) return h.p([], ['Loading assessments…']);
  const text = (
    label: string,
    value: string,
    changed: (text: string) => Message,
    disabled: boolean,
  ) =>
    h.label(
      [],
      [
        label,
        h.textarea([
          h.AriaLabel(label),
          h.Value(value),
          h.Maxlength(2048),
          h.Disabled(disabled),
          h.OnInput((text) => toParent(changed(text))),
        ]),
      ],
    );
  if (model.status === 'closed') {
    // The chooser renders every relationship. Index once instead of scanning
    // every edge and assessment again for each option on every live frame.
    const edges = new Map(frame.document.graph.edges.map((edge) => [edge.id, edge]));
    const records = new Map(
      (frame.assessments ?? []).map((record) => [record.assessment.target.relationshipId, record]),
    );
    const ids = [...new Set([...edges.keys(), ...records.keys()])];
    return h.section(
      [h.Class('coupling-authoring'), h.AriaLabel('Balanced Coupling assessment')],
      [
        h.h2([h.Class('rail-heading')], ['Balanced Coupling']),
        h.p(
          [],
          [
            'Capture relationship evidence before charting. Unknown is a valid answer; explain what is missing.',
          ],
        ),
        h.label(
          [],
          [
            'Assess relationship',
            h.select(
              [
                h.AriaLabel('Assess relationship'),
                h.Value(''),
                h.OnChange((id) => toParent(Message.SelectedRelationship({ id }))),
              ],
              [
                h.option([h.Value('')], ['Choose a relationship']),
                ...ids.map((id) => {
                  const record = records.get(id);
                  const edge = edges.get(id);
                  return h.option(
                    [h.Value(id)],
                    [
                      `${edge?.label ?? id} · ${edge ? `${edge.source.node} → ${edge.target.node}` : 'removed'}${record ? ` · revision ${record.revision}${record.assessment.target.graphVersion !== frame.document.version ? ' · stale' : ''}` : ' · unassessed'}`,
                    ],
                  );
                }),
              ],
            ),
          ],
        ),
        ...(!ids.length ? [h.p([], ['Connect two nodes to author an assessment.'])] : []),
      ],
    );
  }
  const draft = model.draft;
  const saved = recordFor(frame, draft.target.relationshipId);
  const busy = model.delivery.status !== 'ready';
  const disabled = busy || !context.editable || context.graphPending;
  const stale = draft.target.graphVersion !== frame.document.version;
  const conflict = (saved?.revision ?? 0) !== draft.expectedRevision;
  const currentAssessment = saved?.assessment;
  const result = currentAssessment
    ? evaluateCouplingAssessment(currentAssessment, {
        documentId: frame.target.diagramId,
        graphVersion: frame.document.version,
        graph: frame.document.graph,
      })
    : null;
  return h.section(
    [h.Class('coupling-authoring'), h.AriaLabel('Balanced Coupling assessment')],
    [
      h.h2([h.Class('rail-heading')], ['Balanced Coupling']),
      h.p(
        [],
        [
          `Relationship ${draft.target.relationshipId} · ${draft.target.sourceNodeId} → ${draft.target.targetNodeId}`,
        ],
      ),
      h.p(
        [h.DataAttribute('assessment-revision', String(saved?.revision ?? 0))],
        [
          saved
            ? `Shared revision ${saved.revision} · author ${saved.authoredBy} · ${result?.status === 'rejected' ? 'stale; review required' : result?.status}`
            : 'No shared assessment yet.',
        ],
      ),
      h.p(
        [],
        [
          'Distance means co-evolution cost, not canvas position. Volatility means expected change over your horizon.',
        ],
      ),
      ...(stale
        ? [
            h.p(
              [h.Role('status'), h.AriaLive('polite')],
              ['Assessment needs review after a diagram change. Your draft is preserved.'],
            ),
            button(
              'Review assessment against current diagram',
              Message.ClickedReviewGraph(),
              disabled,
            ),
          ]
        : []),
      ...(conflict
        ? [
            h.p(
              [h.Role('alert')],
              [
                'A teammate saved a newer revision. Your draft is preserved; load the shared assessment to review it.',
              ],
            ),
          ]
        : []),
      text(
        'Abstraction scope',
        draft.abstraction,
        (text) => Message.ChangedScope({ field: 'abstraction', text }),
        disabled,
      ),
      text(
        'Expected-change horizon',
        draft.horizon,
        (text) => Message.ChangedScope({ field: 'horizon', text }),
        disabled,
      ),
      ...(['integrationType', 'strength', 'distance', 'volatility'] as const).map((field) =>
        h.fieldset(
          [h.Disabled(disabled)],
          [
            h.legend([], [labels[field]]),
            h.label(
              [],
              [
                `${labels[field]} judgment`,
                h.select(
                  [
                    h.AriaLabel(`${labels[field]} judgment`),
                    h.Value(draft[field].value),
                    h.OnChange((value) => toParent(Message.ChangedValue({ field, value }))),
                  ],
                  (field === 'integrationType'
                    ? ['unknown', 'intrusive', 'functional', 'model', 'contract']
                    : ['unknown', 'low', 'high']
                  ).map((value) => h.option([h.Value(value)], [value])),
                ),
              ],
            ),
            ...(draft[field].value !== 'unknown'
              ? [
                  h.label(
                    [],
                    [
                      `${labels[field]} basis`,
                      h.select(
                        [
                          h.AriaLabel(`${labels[field]} basis`),
                          h.Value(draft[field].basis),
                          h.OnChange((value) =>
                            toParent(
                              Message.ChangedBasis({
                                field,
                                value: Schema.is(Basis)(value) ? value : 'declared',
                              }),
                            ),
                          ),
                        ],
                        ['declared', 'observed', 'derived'].map((value) =>
                          h.option([h.Value(value)], [value]),
                        ),
                      ),
                    ],
                  ),
                ]
              : []),
            text(
              `${labels[field]} ${draft[field].value === 'unknown' ? 'unknown reason' : 'rationale'}`,
              draft[field].evidence,
              (text) => Message.ChangedEvidence({ field, text }),
              disabled,
            ),
          ],
        ),
      ),
      h.p(
        [h.Role('status'), h.AriaLive('polite'), h.DataAttribute('assessment-status', '')],
        [
          model.notice ||
            (!context.editable
              ? 'Read-only assessment snapshot.'
              : Option.isNone(authoredAssessment(draft))
                ? 'Complete scope, horizon and evidence for each input.'
                : 'Draft ready for review.'),
        ],
      ),
      button(
        'Save shared assessment',
        Message.ClickedSave(),
        disabled || stale || conflict || Option.isNone(authoredAssessment(draft)),
      ),
      ...(model.delivery.status === 'uncertain'
        ? [
            button(
              'Retry assessment request',
              Message.ClickedRetry(),
              !context.editable || context.graphPending,
            ),
          ]
        : []),
      button('Load shared assessment (discard draft)', Message.ClickedLoadShared(), busy),
      button('Discard draft and close assessment', Message.ClickedClose(), busy),
      h.p(
        [],
        [
          'Graph Undo, graph export and graph checkpoints do not include assessments. Drafts are local until saved.',
        ],
      ),
    ],
  );
}
