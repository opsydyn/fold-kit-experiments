import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument, parseGraph } from '@opsydyn/foldkit-zloz';
import { isDiagramFrame, type DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Option, Schema } from 'effect';

import graphFixture from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import {
  init,
  Message,
  observe,
  update,
  authoredAssessment,
  Model,
} from '../src/editor/assessment';
import * as Editor from '../src/editor/main';

const room = { teamId: 'team-a', diagramId: 'diagram-a', actorId: 'alice', generation: 'tab-a' };
const frame: DiagramFrame = {
  target: room,
  sourceVersion: 1,
  document: createOperationDocument(
    parseGraph(JSON.stringify({ version: 1, graph: graphFixture.graph })),
  ),
  coverage: [],
};
const context = { room, frame, editable: true, graphPending: false };
const ready = () => {
  let model = update(init(), Message.SelectedRelationship({ id: 'ab' }), context).model;
  model = update(
    model,
    Message.ChangedScope({ field: 'abstraction', text: 'Bounded contexts' }),
    context,
  ).model;
  model = update(
    model,
    Message.ChangedScope({ field: 'horizon', text: 'Six months' }),
    context,
  ).model;
  for (const field of ['integrationType', 'strength', 'distance', 'volatility'] as const)
    model = update(
      model,
      Message.ChangedEvidence({ field, text: 'Awaiting team evidence' }),
      context,
    ).model;
  assert(model.status === 'editing');
  return model;
};
const sending = () => {
  const model = ready();
  const request = {
    version: 1 as const,
    operationId: 'assessment-1',
    expectedRevision: 0,
    assessment: Option.getOrThrow(authoredAssessment(model.draft)),
  };
  return { request, model: update(model, Message.AllocatedSave({ request }), context).model };
};
test('new forms require real evidence; all four integration choices preserve explicit basis and reason', () => {
  const blank = update(init(), Message.SelectedRelationship({ id: 'ab' }), context).model;
  expect(update(blank, Message.ClickedSave(), context).commands).toBeUndefined();
  for (const value of ['intrusive', 'functional', 'model', 'contract'] as const) {
    const changed = update(
      ready(),
      Message.ChangedValue({ field: 'integrationType', value }),
      context,
    ).model;
    assert(changed.status === 'editing');
    const withBasis = update(
      changed,
      Message.ChangedBasis({ field: 'integrationType', value: 'observed' }),
      context,
    ).model;
    assert(withBasis.status === 'editing');
    const assessment = Option.getOrThrow(authoredAssessment(withBasis.draft));
    expect(assessment.inputs.integrationType).toEqual({
      status: 'known',
      value,
      basis: 'observed',
      rationale: 'Awaiting team evidence',
    });
    expect(assessment.inputs.volatility).toEqual({
      status: 'unknown',
      reason: 'Awaiting team evidence',
    });
    expect(Schema.is(Model)(withBasis)).toBe(true);
  }
});
test('unsaved drafts survive newer live evidence; conflicts and stale graph pins require explicit review', () => {
  const local = ready();
  const assessment = Option.getOrThrow(authoredAssessment(local.draft));
  const newer = {
    ...frame,
    sourceVersion: 2,
    assessments: [
      {
        revision: 1,
        authoredBy: 'bob',
        operationId: 'bob-1',
        assessment: { ...assessment, scope: { ...assessment.scope, horizon: 'Teammate horizon' } },
      },
    ],
  };
  expect(observe(local, newer, 'alice')).toBe(local);
  expect(
    update(local, Message.ClickedSave(), { ...context, frame: newer }).commands,
  ).toBeUndefined();
  const loaded = update(local, Message.ClickedLoadShared(), { ...context, frame: newer }).model;
  expect(loaded).toMatchObject({ draft: { horizon: 'Teammate horizon', expectedRevision: 1 } });
  const progressed = { ...frame, document: { ...frame.document, version: 1 }, sourceVersion: 3 };
  expect(
    update(local, Message.ClickedSave(), { ...context, frame: progressed }).commands,
  ).toBeUndefined();
  const reviewed = update(local, Message.ClickedReviewGraph(), {
    ...context,
    frame: progressed,
  }).model;
  expect(reviewed).toMatchObject({
    draft: { target: { graphVersion: 1 }, horizon: 'Six months', expectedRevision: 0 },
  });
  expect(
    update(reviewed, Message.ClickedSave(), { ...context, frame: progressed }).commands,
  ).toHaveLength(1);
  const removed = {
    ...progressed,
    document: { ...progressed.document, graph: { ...progressed.document.graph, edges: [] } },
  };
  expect(
    update(local, Message.ClickedReviewGraph(), { ...context, frame: removed }).model,
  ).toMatchObject({
    draft: { target: { graphVersion: 0 } },
    notice: 'Relationship removed. This assessment cannot be rebound.',
  });
});
test('uncertain saves freeze the exact request and are settled by a matching author and payload only', () => {
  const { request, model } = sending();
  const unknown = update(
    model,
    Message.SettledSave({ operationId: request.operationId, reply: null, status: 0 }),
    context,
  ).model;
  expect(unknown).toMatchObject({ delivery: { status: 'uncertain', request } });
  expect(update(unknown, Message.ClickedClose(), context).model).toBe(unknown);
  expect(
    update(unknown, Message.ChangedScope({ field: 'horizon', text: 'Accidental edit' }), context)
      .model,
  ).toBe(unknown);
  expect(update(unknown, Message.ClickedRetry(), context).model).toMatchObject({
    delivery: { status: 'sending', request },
  });
  const record = {
    revision: 1,
    authoredBy: 'alice',
    operationId: request.operationId,
    assessment: request.assessment,
  };
  expect(
    observe(
      unknown,
      { ...frame, sourceVersion: 2, assessments: [{ ...record, authoredBy: 'bob' }] },
      'alice',
    ),
  ).toBe(unknown);
  expect(
    observe(
      unknown,
      {
        ...frame,
        sourceVersion: 2,
        assessments: [
          {
            ...record,
            assessment: { ...record.assessment, scope: { abstraction: 'Wrong', horizon: 'Wrong' } },
          },
        ],
      },
      'alice',
    ),
  ).toBe(unknown);
  const acknowledged = observe(
    unknown,
    { ...frame, sourceVersion: 2, assessments: [record] },
    'alice',
  );
  expect(acknowledged).toMatchObject({
    delivery: { status: 'ready' },
    draft: { expectedRevision: 1 },
    notice: 'Saved assessment revision 1.',
  });
  expect(Schema.is(Model)(acknowledged)).toBe(true);
});
test('viewers can read but cannot prepare or retry writes; parent ignores another room generation', () => {
  const local = ready();
  const readOnly = { ...context, editable: false };
  expect(update(local, Message.ClickedSave(), readOnly).commands).toBeUndefined();
  expect(
    update(local, Message.ChangedEvidence({ field: 'strength', text: 'Forbidden' }), readOnly)
      .model,
  ).toBe(local);
  const { request, model } = sending();
  const unknown = update(
    model,
    Message.SettledSave({ operationId: request.operationId, reply: null, status: 503 }),
    context,
  ).model;
  expect(update(unknown, Message.ClickedRetry(), readOnly).commands).toBeUndefined();
  const parent = Editor.init({ ...room, name: 'Test', role: 'owner' }).model;
  expect(
    Editor.update(
      parent,
      Editor.Message.GotAssessmentMessage({
        room,
        message: Message.SelectedRelationship({ id: 'ab' }),
      }),
    ).model,
  ).toBe(parent);
  expect(isDiagramFrame(frame)).toBe(true);
  expect(isDiagramFrame({ ...frame, assessments: [{ revision: 0 }] })).toBe(false);
});

test('a mismatched acknowledgement remains retryable; editing saved inputs is visibly unsaved', () => {
  const { request, model } = sending();
  const record = {
    revision: 1,
    authoredBy: 'bob',
    operationId: request.operationId,
    assessment: request.assessment,
  };
  expect(
    update(
      model,
      Message.SettledSave({
        operationId: request.operationId,
        status: 200,
        reply: {
          operationId: request.operationId,
          sourceVersion: 2,
          decision: { status: 'accepted', record },
        },
      }),
      context,
    ).model,
  ).toMatchObject({ delivery: { status: 'uncertain', request } });
  const saved = observe(
    model,
    { ...frame, sourceVersion: 2, assessments: [{ ...record, authoredBy: 'alice' }] },
    'alice',
  );
  expect(
    update(saved, Message.ChangedScope({ field: 'horizon', text: 'Unsaved change' }), context)
      .model,
  ).toMatchObject({ notice: 'Unsaved assessment draft.' });
});
