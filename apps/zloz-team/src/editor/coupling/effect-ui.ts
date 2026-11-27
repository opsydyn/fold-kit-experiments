import { Mount } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import { orbitGeometry } from '@opsydyn/foldkit-viz/chart/orbit';
import { orbitChart } from '@opsydyn/foldkit-viz/effect-ui/orbit';
import { hatchPattern } from '@opsydyn/foldkit-viz/effect-ui/paint';

import type {
  CouplingCohort,
  CouplingReadiness,
  RecordedCouplingRow,
  RemovedCouplingRow,
} from '../coupling-projection';
import { observeWidth } from './measure';
import { Message } from './message';
import { Model, PAGE_SIZE } from './model';
import {
  assessed,
  colours,
  integrations,
  labels,
  outcomeLabel,
  readinessKeys,
} from './presentation';
import { currentRows, pageRows } from './update';

const ObserveCouplingWidth = Mount.makeStream('CouplingWidth', { args: {} }, observeWidth);

export function view<P>(
  model: Model,
  h: Html.H<P>,
  toParent: (message: Message) => P,
  context: Readonly<{ selectedId: string | null; connectionNotice: string }>,
) {
  const projection = model.projection;
  const hatchId = `hatch-${h.id('coupling')}`;
  const button = (label: string, message: Message, disabled = false) =>
    h.button
      .attr('type', 'button')
      .disabled(disabled)
      .on('click', toParent(message))
      .children(label);
  const readiness = (counts: CouplingReadiness, title: string) =>
    h.section
      .attr('aria-label', title)
      .children(
        h.h3.children(title),
        h.p.children(`${counts.total} current relationships`),
        h.dl
          .class('coupling-readiness')
          .children(
            readinessKeys.map((key) =>
              h.div.children(h.dt.children(labels[key]), h.dd.children(String(counts[key]))),
            ),
          ),
      );
  const comparisonContext = (group: CouplingCohort) =>
    h.dl
      .class('coupling-context')
      .children(
        h.div.children(h.dt.children('Abstraction scope'), h.dd.children(group.abstraction)),
        h.div.children(h.dt.children('Time horizon'), h.dd.children(group.horizon)),
        h.div.children(h.dt.children('Assessment model'), h.dd.children(group.modelVersion)),
      );
  const evidence = (row: RecordedCouplingRow | RemovedCouplingRow) =>
    h.details
      .class('coupling-evidence')
      .children(
        h.summary.children('Evidence and provenance'),
        h.p.children(
          `Author ${row.record.authoredBy} · revision ${row.record.revision} · assessed graph version ${row.record.assessment.target.graphVersion}`,
        ),
        h.dl.children(
          Object.entries(row.record.assessment.inputs).map(([field, input]) =>
            h.div.children(
              h.dt.children(field === 'integrationType' ? 'Integration type' : field),
              h.dd.children(
                input.status === 'known'
                  ? `${input.value} · ${input.basis} · ${input.rationale}`
                  : `Unknown · ${input.reason}`,
              ),
            ),
          ),
        ),
        ...(row.state === 'unknown'
          ? [h.p.children(`Missing inputs: ${row.result.missing.join(', ')}`)]
          : []),
        ...(row.state === 'stale' || row.state === 'invalid-binding'
          ? [
              h.p.children(
                `Review required: ${row.result.code}. Current graph version ${projection.status === 'ready' ? projection.stamp.graphVersion : 'unavailable'}.`,
              ),
            ]
          : []),
      );
  if (projection.status === 'waiting')
    return h.section
      .class('coupling-map')
      .attr('aria-label', 'Balanced Coupling assessment map')
      .children(
        h.h2.children('Balanced Coupling assessment map'),
        h.p.children('Waiting for a confirmed diagram.'),
      );
  const rows = pageRows(model);
  const all = currentRows(model);
  const marks = rows.filter(assessed);
  const cohort = projection.cohorts.find((group) => group.cohort.key === model.cohort);
  const counts = cohort?.readiness;
  const comparable = counts
    ? counts['complementary-balance'] + counts['low-volatility-balance'] + counts.imbalance
    : 0;
  const removed = projection.removed.slice(
    model.removedPage * PAGE_SIZE,
    (model.removedPage + 1) * PAGE_SIZE,
  );
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  return h.section
    .class('coupling-map')
    .attr('aria-label', 'Balanced Coupling assessment map')
    .attr('data-coupling-source', String(projection.stamp.sourceVersion))
    .attr('data-coupling-graph-version', String(projection.stamp.graphVersion))
    .children(
      h.h2
        .id('coupling-map-heading')
        .attr('tabindex', String(-1))
        .children('Balanced Coupling assessment map'),
      h.p.children(
        'Compare fully assessed relationships from the confirmed diagram. Their abstraction scope, time horizon and assessment model must match exactly.',
      ),
      ...(context.connectionNotice
        ? [h.p.class('coupling-notice').children(context.connectionNotice)]
        : []),
      ...(!projection.rows.length ? [h.p.children('No relationships to assess.')] : []),
      h.label.children(
        'Scope and horizon',
        h.select
          .attr('aria-label', 'Scope and horizon')
          .on('change', ({ value: key }) => toParent(Message.SelectedCohort({ key })))
          .children(
            h.option
              .attr('value', '')
              .selected(model.cohort === null)
              .children('All scopes · table view'),
            ...projection.cohorts.map((group) =>
              h.option
                .attr('value', group.cohort.key)
                .selected(model.cohort === group.cohort.key)
                .children(
                  `${group.cohort.abstraction} · ${group.cohort.horizon} · ${group.cohort.modelVersion}`,
                ),
            ),
          ),
      ),
      ...(cohort
        ? [
            comparisonContext(cohort.cohort),
            h.p
              .class('coupling-comparability')
              .children(
                comparable === 0
                  ? 'No current outcomes to compare in this group.'
                  : comparable === 1
                    ? 'One relationship has a current outcome. A comparison needs a second fully assessed relationship in this group.'
                    : `${comparable} of ${cohort.rows.length} relationships have comparable outcomes.`,
              ),
          ]
        : [
            h.p.children(
              projection.cohorts.length
                ? 'Choose a scope and time horizon to compare outcomes. The table shows the context of each assessment.'
                : 'A shared assessment on a current relationship supplies the scope and time horizon.',
            ),
          ]),
      h.div
        .class('coupling-measure')
        .onMount(Mount.map(ObserveCouplingWidth(), toParent))
        .children(
          cohort && marks.length && model.width !== null && model.width >= 300
            ? [
                h.figure.class('coupling-orbit').children(
                  orbitChart(h, {
                    geometry: orbitGeometry(
                      marks,
                      {
                        key: (row) => row.relationshipId,
                        value: () => 1,
                        halo: (row) => row.integrationType,
                      },
                      { size: 300, nodeRadius: { min: 22, max: 22 } },
                    ),
                    title: 'Assessed relationships on this page',
                    description: `${cohort.cohort.abstraction} · ${cohort.cohort.horizon} · ${cohort.cohort.modelVersion}. ${marks.length} assessed of ${rows.length} displayed relationships. Equal-sized markers. Details in the relationship table.`,
                    coreFill: 'var(--panel)',
                    coreStroke: 'var(--rule)',
                    centre: [
                      { text: String(marks.length), colour: 'var(--ink)', size: 24 },
                      { text: 'ON THIS PAGE', colour: 'var(--muted)', size: 10 },
                    ],
                    defs: [
                      hatchPattern(h, {
                        id: hatchId,
                        colour: 'var(--danger)',
                        spacing: 6,
                        strokeWidth: 2,
                      }),
                    ],
                    haloColour: (key) => {
                      const kind = integrations.find((kind) => kind === key);
                      return kind === undefined ? 'var(--muted)' : colours[kind];
                    },
                    nodeStyle: (node) => ({
                      fill:
                        node.datum.state === 'imbalance'
                          ? `url(#${hatchId})`
                          : node.datum.state === 'low-volatility-balance'
                            ? 'var(--panel)'
                            : 'var(--accent)',
                      stroke: node.datum.state === 'imbalance' ? 'var(--danger)' : 'var(--ink)',
                    }),
                    labelFor: (row) =>
                      `${row.relationship.label ?? row.relationshipId}: ${row.sourceLabel} to ${row.targetLabel}. Integration ${row.integrationType}. ${outcomeLabel(row)}. Select relationship ${row.relationshipId}.`,
                    selectedKey: context.selectedId,
                    onSelect: (id) => toParent(Message.ClickedRelationship({ id })),
                  }),
                  h.figcaption.children(
                    `${marks.length} assessed relationships on this page. Solid: complementary balance. Hollow: low-volatility balance. Hatched: imbalanced. All outcomes have text labels in the table.`,
                  ),
                ),
              ]
            : cohort
              ? [
                  h.p.children(
                    !marks.length
                      ? 'No current fully assessed relationships on this page. Review the readiness states and evidence below.'
                      : 'The table provides the complete reading at this width.',
                  ),
                ]
              : [],
        ),
      ...(cohort
        ? [
            h.ul
              .class('coupling-legend')
              .attr('aria-label', 'Integration types on this page')
              .children(
                integrations.map((kind) =>
                  h.li.children(
                    h.span.class('coupling-category').style({ color: colours[kind] }).children('●'),
                    `${kind}: ${marks.filter((row) => row.integrationType === kind).length}`,
                  ),
                ),
              ),
            h.p
              .class('coupling-note')
              .children(
                'Integration counts describe only the assessed relationships displayed on this page.',
              ),
          ]
        : []),
      readiness(projection.readiness, 'Whole-diagram readiness'),
      ...(cohort ? [readiness(cohort.readiness, 'Selected-cohort readiness')] : []),
      h.table.class('coupling-table').children(
        h.caption.children(
          `Relationships · page ${model.page + 1} of ${pageCount} · ${all.length} in ${cohort ? 'selected cohort' : 'all scopes'}`,
        ),
        h.thead.children(
          h.tr.children(
            h.th.attr('scope', 'col').children('Relationship'),
            h.th.attr('scope', 'col').children('Assessment'),
          ),
        ),
        h.tbody.children(
          rows.map((row) =>
            h.tr
              .key(row.relationshipId)
              .attr('data-coupling-row', row.relationshipId)
              .attr('data-coupling-state', row.state)
              .children(
                h.th
                  .attr('scope', 'row')
                  .children(
                    h.strong.children(row.relationship.label ?? row.relationshipId),
                    h.p.children(`${row.sourceLabel} → ${row.targetLabel}`),
                    h.p.children(row.relationshipId),
                    button(
                      `Select relationship ${row.relationshipId}`,
                      Message.ClickedRelationship({ id: row.relationshipId }),
                    ),
                  ),
                h.td.children(
                  h.p.class('coupling-outcome').children(outcomeLabel(row)),
                  ...(row.state === 'not-started'
                    ? [h.p.children('No shared assessment yet.')]
                    : [
                        h.p.children(`Integration: ${row.integrationType ?? 'unknown'}`),
                        ...(!cohort ? [comparisonContext(row.cohort)] : []),
                        evidence(row),
                      ]),
                  button(
                    `Review assessment ${row.relationshipId}`,
                    Message.ClickedReview({ id: row.relationshipId }),
                  ),
                ),
              ),
          ),
        ),
      ),
      h.nav
        .class('coupling-pages')
        .attr('aria-label', 'Relationship pages')
        .children(
          button('Previous relationships', Message.ClickedPage({ delta: -1 }), model.page === 0),
          h.span.children(`${model.page + 1} / ${pageCount}`),
          button(
            'Next relationships',
            Message.ClickedPage({ delta: 1 }),
            model.page + 1 === pageCount,
          ),
        ),
      ...(projection.removed.length
        ? [
            h.section.attr('aria-label', 'Retained removed assessments').children(
              h.h3.children(
                `Retained assessments · ${projection.removed.length} removed relationships`,
              ),
              h.p.children(
                'Across all scopes. Outside the current-edge and cohort totals; these records cannot select a canvas relationship.',
              ),
              ...removed.map((row) =>
                h.article
                  .key(row.relationshipId)
                  .children(
                    h.h4.children(row.relationshipId),
                    h.p.children(
                      `${row.record.assessment.target.sourceNodeId} → ${row.record.assessment.target.targetNodeId} · removed`,
                    ),
                    comparisonContext(row.cohort),
                    evidence(row),
                    button(
                      `Review retained assessment ${row.relationshipId}`,
                      Message.ClickedReview({ id: row.relationshipId }),
                    ),
                  ),
              ),
              h.nav
                .class('coupling-pages')
                .attr('aria-label', 'Retained assessment pages')
                .children(
                  button(
                    'Previous retained assessments',
                    Message.ClickedRemovedPage({ delta: -1 }),
                    model.removedPage === 0,
                  ),
                  h.span.children(`Page ${model.removedPage + 1}`),
                  button(
                    'Next retained assessments',
                    Message.ClickedRemovedPage({ delta: 1 }),
                    (model.removedPage + 1) * PAGE_SIZE >= projection.removed.length,
                  ),
                ),
            ),
          ]
        : []),
      h.p
        .attr('role', 'status')
        .attr('aria-live', 'polite')
        .class('coupling-announcement')
        .children(model.announcement),
    );
}
