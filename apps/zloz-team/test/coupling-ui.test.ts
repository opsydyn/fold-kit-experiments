import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument, parseGraph } from '@opsydyn/foldkit-zloz';
import { isDiagramFrame, type DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { parseCouplingAssessment } from '@opsydyn/foldkit-zloz/coupling';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import graph from '../../../packages/foldkit-zloz/test/fixtures/operations-v1.json';
import * as Assessment from '../src/editor/assessment';
import { Message } from '../src/editor/coupling/message';
import { init } from '../src/editor/coupling/model';
import { observe, update } from '../src/editor/coupling/update';
import { view } from '../src/editor/coupling/view';
import * as Editor from '../src/editor/main';
import fixture from './fixtures/coupling-projection-v1.json';

const assessment = parseCouplingAssessment(JSON.stringify(fixture.assessment));
const frame: DiagramFrame = {
  target: { teamId: 'team-a', diagramId: 'diagram-a' },
  sourceVersion: 11,
  document: {
    ...createOperationDocument(parseGraph(JSON.stringify({ version: 1, graph: graph.graph }))),
    version: 7,
  },
  coverage: [],
  assessments: [{ revision: 1, authoredBy: 'alice', operationId: 'a1', assessment }],
};
test('initial observation selects a sole exact cohort; an explicit All-scopes choice survives feed changes', () => {
  const model = observe(init(), frame);
  expect(model.projection.status).toBe('ready');
  expect(model.cohort).toBe('["balanced-coupling-binary/v1","C4 containers","Next quarter"]');
  const all = update(model, Message.SelectedCohort({ key: '' }));
  expect(all.model.cohort).toBeNull();
  expect(all.commands).toBeUndefined();
  expect(observe(all.model, { ...frame, sourceVersion: 12 }).cohort).toBeNull();
});
test('missing cohorts clear rather than silently selecting a different one; unread frames stay waiting', () => {
  expect(observe(init(), null)).toEqual(init());
  const model = observe(init(), frame);
  const changed = observe(model, {
    ...frame,
    assessments: frame.assessments?.map((record) => ({
      ...record,
      assessment: {
        ...record.assessment,
        scope: { ...record.assessment.scope, horizon: 'Another horizon' },
      },
    })),
  });
  expect(changed.cohort).toBeNull();
  expect(changed.page).toBe(0);
});
test('duplicate/metadata-only frames reuse semantic rows while refreshing source stamps', () => {
  const model = observe(init(), frame);
  expect(observe(model, frame)).toBe(model);
  const changed = observe(model, { ...frame, sourceVersion: 12, coverage: [] });
  assert(model.projection.status === 'ready' && changed.projection.status === 'ready');
  expect(changed.projection.rows).toBe(model.projection.rows);
  expect(changed.projection.stamp.sourceVersion).toBe(12);
  const stale = observe(model, { ...frame, document: { ...frame.document, version: 8 } });
  assert(stale.projection.status === 'ready');
  expect(stale.projection.rows.find((row) => row.relationshipId === 'ab')?.state).toBe('stale');
});
test('assessment-only updates replace visible evidence even when graph and qualitative outcome are unchanged', () => {
  const model = observe(init(), frame);
  const nextAssessment = parseCouplingAssessment(
    JSON.stringify({
      ...fixture.assessment,
      inputs: {
        ...fixture.assessment.inputs,
        strength: {
          ...fixture.assessment.inputs.strength,
          rationale: 'New confirmed evidence from a teammate',
        },
      },
    }),
  );
  const changed = observe(model, {
    ...frame,
    sourceVersion: 12,
    assessments: [
      { revision: 2, authoredBy: 'bob', operationId: 'b2', assessment: nextAssessment },
    ],
  });
  assert(changed.projection.status === 'ready' && model.projection.status === 'ready');
  const row = changed.projection.rows.find((row) => row.relationshipId === 'ab');
  assert(row && row.state !== 'not-started');
  expect(row.record.assessment.inputs.strength).toEqual(nextAssessment.inputs.strength);
  expect(row.record.authoredBy).toBe('bob');
  expect(changed.projection.rows).not.toBe(model.projection.rows);
});

test('pages are bounded and clamped; selection/review emit typed local events without commands', () => {
  const edges = Array.from({ length: 25 }, (_, i) => ({
    ...frame.document.graph.edges[0]!,
    id: `edge-${String(i).padStart(2, '0')}`,
  }));
  const large = {
    ...frame,
    document: { ...createOperationDocument({ ...frame.document.graph, edges }), version: 7 },
    assessments: [],
  };
  assert(isDiagramFrame(large));
  let model = observe(init(), large);
  for (let i = 0; i < 8; i++) model = update(model, Message.ClickedPage({ delta: 1 })).model;
  expect(model.page).toBe(2);
  expect(observe(model, frame).page).toBe(0);
  const selected = update(model, Message.ClickedRelationship({ id: 'edge-24' }));
  expect(selected.outMessage).toEqual({ _tag: 'SelectedRelationship', id: 'edge-24' });
  expect(selected.commands).toBeUndefined();
  expect(update(model, Message.ClickedReview({ id: 'edge-24' })).outMessage).toEqual({
    _tag: 'RequestedAssessmentReview',
    id: 'edge-24',
  });
  expect(update(model, Message.ClickedRelationship({ id: 'removed' })).outMessage).toBeUndefined();
  expect(update(model, Message.SelectedCohort({ key: 'not-a-cohort' })).model).toBe(model);
});
test('only finite nonnegative measurements enter the Model; duplicate widths cause no new render state', () => {
  const model = observe(init(), frame);
  const measured = update(model, Message.RecordedWidth({ width: 300.8 })).model;
  expect(measured.width).toBe(300);
  expect(update(measured, Message.RecordedWidth({ width: 300.8 })).model).toBe(measured);
  for (const width of [Number.NaN, Number.POSITIVE_INFINITY, -1])
    expect(update(model, Message.RecordedWidth({ width })).model).toBe(model);
});

test('empty, unknown, stale, invalid and removed states keep their evidence without creating scored marks', async () => {
  const unknown = {
    ...assessment,
    inputs: {
      ...assessment.inputs,
      integrationType: {
        status: 'unknown' as const,
        reason: 'Independent discovery still pending',
      },
    },
  };
  for (const [value, state, expected] of [
    [unknown, 'unknown', 'Independent discovery still pending'],
    [
      { ...assessment, target: { ...assessment.target, graphVersion: 6 } },
      'stale',
      'graph-version-mismatch',
    ],
    [
      { ...assessment, target: { ...assessment.target, sourceNodeId: 'c' } },
      'invalid-binding',
      'endpoint-mismatch',
    ],
  ] as const) {
    const model = observe(init(), {
      ...frame,
      assessments: [{ revision: 1, authoredBy: 'alice', operationId: 'a1', assessment: value }],
    });
    const html = await render(update(model, Message.RecordedWidth({ width: 500 })).model);
    expect(html).toContain(`data-coupling-state="${state}"`);
    expect(html).toContain(expected);
    expect(html).not.toContain('class="chart-orbit"');
  }
  const empty = await render(
    observe(init(), {
      ...frame,
      document: createOperationDocument({ nodes: [], edges: [] }),
      assessments: [],
    }),
  );
  expect(empty).toContain('No relationships to assess');
  expect(empty).not.toContain('class="chart-orbit"');
  const retained = await render(
    observe(init(), { ...frame, document: createOperationDocument({ nodes: [], edges: [] }) }),
  );
  expect(retained).toContain('Retained assessments');
  expect(retained).toContain('Review retained assessment ab');
  expect(retained).toContain('Outside the current-edge and cohort totals');
});

const readyParent = (role: 'owner' | 'editor' | 'viewer' = 'editor', incoming = frame) => {
  const started = Editor.update(
    Editor.init({ ...frame.target, actorId: 'alice', role, name: 'Coupling UI fixture' }).model,
    Editor.Message.SucceededIdentity({ generation: 'tab-a' }),
  ).model;
  return Editor.update(
    started,
    Editor.Message.ObservedFrame({ room: started.room, run: 0, frame: incoming }),
  ).model;
};
const openMap = (model = readyParent()) =>
  Editor.update(model, Editor.Message.SelectedInspector({ inspector: 'coupling' })).model;
const send = (model: Editor.Model, message: Message) =>
  Editor.update(model, Editor.Message.GotCouplingMessage({ room: model.room, message }));
const author = (model: Editor.Model, message: Assessment.Message) =>
  Editor.update(model, Editor.Message.GotAssessmentMessage({ room: model.room, message }));

test('map selection is local for viewers and editors, while review emits only the focus command', () => {
  for (const role of ['viewer', 'editor'] as const) {
    const model = openMap(readyParent(role));
    const selected = send(model, Message.ClickedRelationship({ id: 'cb' }));
    expect(selected.model.editor).toMatchObject({ selectedEdges: ['cb'] });
    expect(selected.model.session).toBe(model.session);
    expect(selected.model.ownEdits).toBe(model.ownEdits);
    expect(selected.commands ?? []).toHaveLength(0);
    const review = send(selected.model, Message.ClickedReview({ id: 'cb' }));
    expect(review.model.assessment).toMatchObject({
      status: 'editing',
      draft: { target: { relationshipId: 'cb' } },
    });
    expect(review.model.inspector).toBe('selection');
    expect(review.commands?.map((command) => command.name)).toEqual(['FocusAssessmentInspector']);
    expect(review.model.session).toBe(model.session);
  }
});

test('mode changes, blocked review and late replies preserve an open draft and its exact uncertain request', () => {
  let model = author(readyParent(), Assessment.Message.SelectedRelationship({ id: 'ab' })).model;
  const request = { version: 1 as const, operationId: 'save-2', expectedRevision: 1, assessment };
  model = author(model, Assessment.Message.AllocatedSave({ request })).model;
  assert(model.assessment.status === 'editing' && model.assessment.delivery.status === 'sending');
  const pending = model.assessment;
  model = openMap(model);
  expect(model.assessment).toBe(pending);
  const blocked = send(model, Message.ClickedReview({ id: 'cb' }));
  expect(blocked.model.assessment).toBe(pending);
  expect(blocked.model.inspector).toBe('coupling');
  expect(blocked.model.coupling.announcement).toContain('Close the open assessment explicitly');
  expect(blocked.commands ?? []).toHaveLength(0);
  model = author(
    blocked.model,
    Assessment.Message.SettledSave({ operationId: 'save-2', reply: null, status: 0 }),
  ).model;
  assert(model.assessment.status === 'editing' && model.assessment.delivery.status === 'uncertain');
  expect(model.assessment.delivery.request).toEqual(request);
  const same = send(model, Message.ClickedReview({ id: 'ab' }));
  expect(same.model.assessment).toBe(model.assessment);
  const hidden = openMap(same.model);
  const received = Editor.update(
    hidden,
    Editor.Message.ObservedFrame({
      room: hidden.room,
      run: 0,
      frame: {
        ...frame,
        sourceVersion: 12,
        assessments: [{ revision: 2, authoredBy: 'alice', operationId: 'save-2', assessment }],
      },
    }),
  ).model;
  expect(received.assessment).toMatchObject({
    status: 'editing',
    delivery: { status: 'ready' },
    draft: { expectedRevision: 2 },
  });
  expect(received.inspector).toBe('coupling');
});

test('selection drafts survive map navigation, cache reopening uses the newest confirmed frame, and late width events stay closed', () => {
  const opened = author(readyParent(), Assessment.Message.SelectedRelationship({ id: 'ab' })).model;
  const drafted = author(
    opened,
    Assessment.Message.ChangedScope({ field: 'horizon', text: 'Private unsaved horizon' }),
  ).model;
  const mapped = openMap(drafted);
  const measured = send(mapped, Message.RecordedWidth({ width: 400 })).model;
  expect(
    Editor.update(measured, Editor.Message.SelectedInspector({ inspector: 'coupling' })).model,
  ).toBe(measured);
  expect(mapped.assessment).toBe(drafted.assessment);
  const closed = Editor.update(
    mapped,
    Editor.Message.SelectedInspector({ inspector: 'selection' }),
  ).model;
  expect(send(closed, Message.RecordedWidth({ width: 500 })).model).toBe(closed);
  const progressed = Editor.update(
    closed,
    Editor.Message.ObservedFrame({
      room: closed.room,
      run: 0,
      frame: { ...frame, sourceVersion: 12, document: { ...frame.document, version: 8 } },
    }),
  ).model;
  expect(progressed.coupling).toBe(closed.coupling);
  const reopened = openMap(progressed);
  assert(reopened.coupling.projection.status === 'ready');
  expect(reopened.coupling.projection.rows.find((row) => row.relationshipId === 'ab')?.state).toBe(
    'stale',
  );
  expect(reopened.assessment).toBe(drafted.assessment);
});

test('retained removed records can open their original assessment without changing canvas selection or the graph', () => {
  const removedFrame = {
    ...frame,
    document: {
      ...createOperationDocument({
        ...frame.document.graph,
        edges: frame.document.graph.edges.filter((edge) => edge.id !== 'ab'),
      }),
      version: 8,
    },
  };
  const model = openMap(readyParent('viewer', removedFrame));
  expect(send(model, Message.ClickedRelationship({ id: 'ab' })).model.editor).toBe(model.editor);
  const reviewed = send(model, Message.ClickedReview({ id: 'ab' }));
  expect(reviewed.model.assessment).toMatchObject({
    status: 'editing',
    draft: { target: assessment.target },
  });
  expect(reviewed.model.editor).toBe(model.editor);
  expect(reviewed.model.session).toBe(model.session);
});

const render = async (model: ReturnType<typeof init>) =>
  (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model }),
          view: (state, h: HtmlBuilder<Message>) => ({
            title: 'Map fixture',
            body: view(state, h, (message) => message, { selectedId: 'ab', connectionNotice: '' }),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
test('SSR/table fallback, measured orbit and All-scopes mode expose honest qualitative labels and evidence', async () => {
  expect(await render(init())).toContain('Waiting for a confirmed diagram');
  const model = observe(init(), frame);
  const narrow = await render(update(model, Message.RecordedWidth({ width: 299 })).model);
  expect(narrow).not.toContain('class="chart-orbit"');
  expect(narrow).toContain('<table');
  expect(narrow).toContain('Evidence and provenance');
  expect(narrow).toContain('high cohesion');
  expect(narrow).toContain('model · declared');
  const wide = await render(update(model, Message.RecordedWidth({ width: 300 })).model);
  expect(wide).toContain('class="chart-orbit"');
  expect(wide).toContain('role="button"');
  expect(wide).toContain('r="22"');
  expect(wide).not.toContain('chart-orbit-pulse');
  const all = await render(
    update(
      update(model, Message.RecordedWidth({ width: 800 })).model,
      Message.SelectedCohort({ key: '' }),
    ).model,
  );
  expect(all).not.toContain('class="chart-orbit"');
  expect(all).toContain('Not started');
  expect(all).toContain('data-coupling-row="cb"');
});
