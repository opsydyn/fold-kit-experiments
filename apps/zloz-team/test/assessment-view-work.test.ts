import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createOperationDocument } from '@opsydyn/foldkit-zloz';
import { isDiagramFrame, type DiagramFrame } from '@opsydyn/foldkit-zloz-alchemy/session';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import * as Assessment from '../src/editor/assessment';
import { makeCouplingStressFixture } from './coupling-load';

const room = {
  teamId: 'chooser-team',
  diagramId: 'chooser-diagram',
  actorId: 'owner',
  generation: 'chooser-tab',
};
async function render(frame: DiagramFrame, assessment: Assessment.Model = Assessment.init()) {
  const rendered = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: assessment }),
        view: (model, h: HtmlBuilder<Assessment.Message>) => ({
          title: 'Assessment chooser work',
          body: Assessment.view(
            model,
            { room, frame, editable: true, graphPending: false },
            h,
            (message) => message,
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  return rendered.html;
}

test('stale assessment review is a polite status and preserves the authored graph pin', async () => {
  const fixture = makeCouplingStressFixture(room.diagramId);
  const frame: DiagramFrame = {
    target: room,
    sourceVersion: 500,
    coverage: [],
    document: { ...createOperationDocument(fixture.graph), version: 1 },
    assessments: fixture.records,
  };
  const assessment = Assessment.update(
    Assessment.init(),
    Assessment.Message.SelectedRelationship({ id: 'e0' }),
    { room, frame, editable: true, graphPending: false },
  ).model;
  assert(assessment.status === 'editing');
  const result = await render(frame, assessment);
  expect(result).toContain(
    'Assessment needs review after a diagram change. Your draft is preserved.',
  );
  expect(result).not.toContain('role="alert"');
  expect(result).toContain('Review assessment against current diagram');
  expect(assessment.draft.target.graphVersion).toBe(0);
});

for (const assessed of [false, true]) {
  test(`closed chooser reads relationship keys linearly and preserves every option (assessed=${assessed})`, async () => {
    const fixture = makeCouplingStressFixture(room.diagramId);
    const frame: DiagramFrame = {
      target: room,
      sourceVersion: 500,
      coverage: [],
      document: { ...createOperationDocument(fixture.graph), version: 1 },
      assessments: assessed ? fixture.records : [],
    };
    let edgeReads = 0;
    let recordReads = 0;
    for (const edge of frame.document.graph.edges) {
      const id = edge.id;
      Object.defineProperty(edge, 'id', {
        enumerable: true,
        get: () => {
          edgeReads++;
          return id;
        },
      });
    }
    for (const record of frame.assessments ?? []) {
      const target = record.assessment.target;
      const id = target.relationshipId;
      Object.defineProperty(target, 'relationshipId', {
        enumerable: true,
        get: () => {
          recordReads++;
          return id;
        },
      });
    }
    assert(isDiagramFrame(frame), 'Budget fixture must pass the actual wire guard');
    edgeReads = 0;
    recordReads = 0;
    const result = await render(frame);
    expect(result.match(/<option\b/g)).toHaveLength(501);
    expect(result).toContain('value="e0"');
    expect(result).toContain('value="e499"');
    expect(result).toContain(
      assessed ? 'e0 · n0 → n1 · revision 1 · stale' : 'e0 · n0 → n1 · unassessed',
    );
    expect(result).toContain('e499 · n249 → n9 · unassessed');
    // A generous linear data-access budget, independent of the chosen index implementation.
    expect(edgeReads + recordReads).toBeLessThanOrEqual(4 * (500 + (assessed ? 480 : 0)));
  });
}

test('chooser retains graph ordering, current/stale/removed revisions, escaping and object-like identifiers', async () => {
  const fixture = makeCouplingStressFixture(room.diagramId);
  const records = fixture.records.slice(0, 2).map((record, i) => ({
    ...record,
    revision: i + 8,
    assessment: {
      ...record.assessment,
      target: {
        ...record.assessment.target,
        relationshipId: i === 0 ? '__proto__' : 'toString',
        graphVersion: i === 0 ? 1 : 0,
      },
    },
  }));
  const frame: DiagramFrame = {
    target: room,
    sourceVersion: 500,
    coverage: [],
    document: {
      ...createOperationDocument({
        ...fixture.graph,
        edges: fixture.graph.edges.slice(0, 2).map((edge, i) => ({
          ...edge,
          id: i === 0 ? '__proto__' : 'constructor',
          label: i === 0 ? 'Named <&> relationship' : 'Second relationship',
        })),
      }),
      version: 1,
    },
    assessments: records,
  };
  assert(isDiagramFrame(frame));
  const result = await render(frame);
  expect(result.match(/<option\b/g)).toHaveLength(4);
  expect(result).toContain('Named &lt;&amp;&gt; relationship · n0 → n1 · revision 8');
  expect(result).not.toContain('revision 8 · stale');
  expect(result).toContain('Second relationship · n1 → n2 · unassessed');
  expect(result).toContain('toString · removed · revision 9 · stale');
  expect(result.indexOf('value="__proto__"')).toBeLessThan(result.indexOf('value="constructor"'));
  expect(result.indexOf('value="constructor"')).toBeLessThan(result.indexOf('value="toString"'));
});
