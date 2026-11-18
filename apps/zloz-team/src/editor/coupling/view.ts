import { orbitGeometry } from '@opsydyn/foldkit-viz/chart/orbit';
import { orbitChart } from '@opsydyn/foldkit-viz/foldkit/orbit';
import { hatchPattern } from '@opsydyn/foldkit-viz/foldkit/paint';
import type { ZlozCouplingIntegration } from '@opsydyn/foldkit-zloz/coupling';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import type {
  CouplingReadiness,
  CouplingRow,
  RecordedCouplingRow,
  RemovedCouplingRow,
} from '../coupling-projection';
import { Message } from './message';
import { Model, PAGE_SIZE } from './model';
import { ObserveCouplingWidth } from './mount';
import { currentRows, pageRows } from './update';

const labels = {
  'complementary-balance': 'Complementary balance',
  'low-volatility-balance': 'Low-volatility balance',
  imbalance: 'Imbalanced',
  unknown: 'Unknown inputs',
  stale: 'Stale graph pin',
  'invalid-binding': 'Invalid binding',
  'not-started': 'Not started',
} as const;
const readinessKeys = [
  'complementary-balance',
  'low-volatility-balance',
  'imbalance',
  'unknown',
  'stale',
  'invalid-binding',
  'not-started',
] as const;
const integrations = ['intrusive', 'functional', 'model', 'contract'] as const;
const colours = {
  intrusive: 'var(--danger)',
  functional: 'var(--accent)',
  model: 'var(--c4)',
  contract: 'var(--ddd)',
};
const assessed = (
  row: CouplingRow,
): row is Extract<
  RecordedCouplingRow,
  { state: 'complementary-balance' | 'low-volatility-balance' | 'imbalance' }
> & { readonly integrationType: ZlozCouplingIntegration } =>
  (row.state === 'complementary-balance' ||
    row.state === 'low-volatility-balance' ||
    row.state === 'imbalance') &&
  row.integrationType !== null;
export const outcomeLabel = (row: CouplingRow): string => {
  if (!assessed(row)) return labels[row.state];
  return `${labels[row.state]} · ${row.result.pattern.replaceAll('-', ' ')} · ${row.result.basis.replaceAll('-', ' ')}`;
};
export function view<P>(
  model: Model,
  h: HtmlBuilder<P>,
  toParent: (message: Message) => P,
  context: Readonly<{ selectedId: string | null; connectionNotice: string }>,
): Html {
  const projection = model.projection;
  const button = (label: string, message: Message, disabled = false) =>
    h.button([h.Type('button'), h.Disabled(disabled), h.OnClick(toParent(message))], [label]);
  const readiness = (counts: CouplingReadiness, title: string) =>
    h.section(
      [h.AriaLabel(title)],
      [
        h.h3([], [title]),
        h.p([], [`${counts.total} current relationships`]),
        h.dl(
          [h.Class('coupling-readiness')],
          readinessKeys.map((key) =>
            h.div([], [h.dt([], [labels[key]]), h.dd([], [String(counts[key])])]),
          ),
        ),
      ],
    );
  const evidence = (row: RecordedCouplingRow | RemovedCouplingRow) =>
    h.details(
      [h.Class('coupling-evidence')],
      [
        h.summary([], ['Evidence and provenance']),
        h.p(
          [],
          [
            `Scope: ${row.cohort.abstraction}. Horizon: ${row.cohort.horizon}. Model: ${row.cohort.modelVersion}.`,
          ],
        ),
        h.p(
          [],
          [
            `Author ${row.record.authoredBy} · revision ${row.record.revision} · assessed graph version ${row.record.assessment.target.graphVersion}`,
          ],
        ),
        h.dl(
          [],
          Object.entries(row.record.assessment.inputs).map(([field, input]) =>
            h.div(
              [],
              [
                h.dt([], [field === 'integrationType' ? 'Integration type' : field]),
                h.dd(
                  [],
                  [
                    input.status === 'known'
                      ? `${input.value} · ${input.basis} · ${input.rationale}`
                      : `Unknown · ${input.reason}`,
                  ],
                ),
              ],
            ),
          ),
        ),
        ...(row.state === 'unknown'
          ? [h.p([], [`Missing inputs: ${row.result.missing.join(', ')}`])]
          : []),
        ...(row.state === 'stale' || row.state === 'invalid-binding'
          ? [
              h.p(
                [],
                [
                  `Review required: ${row.result.code}. Current graph version ${projection.status === 'ready' ? projection.stamp.graphVersion : 'unavailable'}.`,
                ],
              ),
            ]
          : []),
      ],
    );
  if (projection.status === 'waiting')
    return h.section(
      [h.Class('coupling-map'), h.AriaLabel('Balanced Coupling assessment map')],
      [
        h.h2([], ['Balanced Coupling assessment map']),
        h.p([], ['Waiting for a confirmed diagram.']),
      ],
    );
  const rows = pageRows(model);
  const all = currentRows(model);
  const marks = rows.filter(assessed);
  const cohort = projection.cohorts.find((group) => group.cohort.key === model.cohort);
  const removed = projection.removed.slice(
    model.removedPage * PAGE_SIZE,
    (model.removedPage + 1) * PAGE_SIZE,
  );
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  return h.section(
    [
      h.Class('coupling-map'),
      h.AriaLabel('Balanced Coupling assessment map'),
      h.DataAttribute('coupling-source', String(projection.stamp.sourceVersion)),
      h.DataAttribute('coupling-graph-version', String(projection.stamp.graphVersion)),
    ],
    [
      h.h2([h.Id('coupling-map-heading'), h.Tabindex(-1)], ['Balanced Coupling assessment map']),
      h.p(
        [],
        [
          'Read-only judgments from the last confirmed diagram. Compare evidence within one scope and horizon.',
        ],
      ),
      ...(context.connectionNotice
        ? [h.p([h.Class('coupling-notice')], [context.connectionNotice])]
        : []),
      readiness(projection.readiness, 'Whole-diagram readiness'),
      ...(!projection.rows.length ? [h.p([], ['No relationships to assess.'])] : []),
      h.label(
        [],
        [
          'Scope and horizon',
          h.select(
            [
              h.AriaLabel('Scope and horizon'),
              h.Value(model.cohort ?? ''),
              h.OnChange((key) => toParent(Message.SelectedCohort({ key }))),
            ],
            [
              h.option([h.Value('')], ['All scopes · table view']),
              ...projection.cohorts.map((group) =>
                h.option(
                  [h.Value(group.cohort.key)],
                  [
                    `${group.cohort.abstraction} · ${group.cohort.horizon} · ${group.cohort.modelVersion}`,
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      ...(cohort
        ? [readiness(cohort.readiness, 'Selected-cohort readiness')]
        : [
            h.p(
              [],
              [
                'Choose one scope and horizon to display an orbit. All scopes remain available in the table.',
              ],
            ),
          ]),
      h.div(
        [
          h.Class('coupling-measure'),
          h.OnMount(Mount.mapMessage(ObserveCouplingWidth(), toParent)),
        ],
        cohort && marks.length && model.width !== null && model.width >= 300
          ? [
              h.figure(
                [h.Class('coupling-orbit')],
                [
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
                    description: `${marks.length} assessed of ${rows.length} displayed relationships. Equal-sized markers. Details in the relationship table.`,
                    coreFill: 'var(--panel)',
                    coreStroke: 'var(--rule)',
                    centre: [
                      { text: String(marks.length), colour: 'var(--ink)', size: 24 },
                      { text: 'ON THIS PAGE', colour: 'var(--muted)', size: 10 },
                    ],
                    defs: [
                      hatchPattern(h, {
                        id: 'team-coupling-imbalance-hatch',
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
                          ? 'url(#team-coupling-imbalance-hatch)'
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
                  h.figcaption(
                    [],
                    [
                      `${marks.length} assessed relationships on this page. Solid: complementary balance. Hollow: low-volatility balance. Hatched: imbalanced. All outcomes have text labels in the table.`,
                    ],
                  ),
                ],
              ),
            ]
          : [
              h.p(
                [],
                [
                  cohort && !marks.length
                    ? 'No current fully assessed relationships on this page. Review the readiness states and evidence below.'
                    : 'The table provides the complete reading at this width.',
                ],
              ),
            ],
      ),
      h.ul(
        [h.Class('coupling-legend'), h.AriaLabel('Integration types on this page')],
        integrations.map((kind) =>
          h.li(
            [],
            [
              h.span([h.Class('coupling-category'), h.Style({ color: colours[kind] })], ['●']),
              `${kind}: ${marks.filter((row) => row.integrationType === kind).length}`,
            ],
          ),
        ),
      ),
      h.p(
        [h.Class('coupling-note')],
        ['Integration counts describe only the assessed relationships displayed on this page.'],
      ),
      h.table(
        [h.Class('coupling-table')],
        [
          h.caption(
            [],
            [
              `Relationships · page ${model.page + 1} of ${pageCount} · ${all.length} in ${cohort ? 'selected cohort' : 'all scopes'}`,
            ],
          ),
          h.thead(
            [],
            [
              h.tr(
                [],
                [h.th([h.Scope('col')], ['Relationship']), h.th([h.Scope('col')], ['Assessment'])],
              ),
            ],
          ),
          h.tbody(
            [],
            rows.map((row) =>
              h.tr(
                [
                  h.Key(row.relationshipId),
                  h.DataAttribute('coupling-row', row.relationshipId),
                  h.DataAttribute('coupling-state', row.state),
                ],
                [
                  h.th(
                    [h.Scope('row')],
                    [
                      h.strong([], [row.relationship.label ?? row.relationshipId]),
                      h.p([], [`${row.sourceLabel} → ${row.targetLabel}`]),
                      h.p([], [row.relationshipId]),
                      button(
                        `Select relationship ${row.relationshipId}`,
                        Message.ClickedRelationship({ id: row.relationshipId }),
                      ),
                    ],
                  ),
                  h.td(
                    [],
                    [
                      h.p([h.Class('coupling-outcome')], [outcomeLabel(row)]),
                      ...(row.state === 'not-started'
                        ? [h.p([], ['No shared assessment yet.'])]
                        : [
                            h.p([], [`Integration: ${row.integrationType ?? 'unknown'}`]),
                            evidence(row),
                          ]),
                      button(
                        `Review assessment ${row.relationshipId}`,
                        Message.ClickedReview({ id: row.relationshipId }),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      h.nav(
        [h.Class('coupling-pages'), h.AriaLabel('Relationship pages')],
        [
          button('Previous relationships', Message.ClickedPage({ delta: -1 }), model.page === 0),
          h.span([], [`${model.page + 1} / ${pageCount}`]),
          button(
            'Next relationships',
            Message.ClickedPage({ delta: 1 }),
            model.page + 1 === pageCount,
          ),
        ],
      ),
      ...(projection.removed.length
        ? [
            h.section(
              [h.AriaLabel('Retained removed assessments')],
              [
                h.h3(
                  [],
                  [`Retained assessments · ${projection.removed.length} removed relationships`],
                ),
                h.p(
                  [],
                  [
                    'Across all scopes. Outside the current-edge and cohort totals; these records cannot select a canvas relationship.',
                  ],
                ),
                ...removed.map((row) =>
                  h.article(
                    [h.Key(row.relationshipId)],
                    [
                      h.h4([], [row.relationshipId]),
                      h.p(
                        [],
                        [
                          `${row.record.assessment.target.sourceNodeId} → ${row.record.assessment.target.targetNodeId} · removed`,
                        ],
                      ),
                      evidence(row),
                      button(
                        `Review retained assessment ${row.relationshipId}`,
                        Message.ClickedReview({ id: row.relationshipId }),
                      ),
                    ],
                  ),
                ),
                h.nav(
                  [h.Class('coupling-pages'), h.AriaLabel('Retained assessment pages')],
                  [
                    button(
                      'Previous retained assessments',
                      Message.ClickedRemovedPage({ delta: -1 }),
                      model.removedPage === 0,
                    ),
                    h.span([], [`Page ${model.removedPage + 1}`]),
                    button(
                      'Next retained assessments',
                      Message.ClickedRemovedPage({ delta: 1 }),
                      (model.removedPage + 1) * PAGE_SIZE >= projection.removed.length,
                    ),
                  ],
                ),
              ],
            ),
          ]
        : []),
      h.p(
        [h.Role('status'), h.AriaLive('polite'), h.Class('coupling-announcement')],
        [model.announcement],
      ),
    ],
  );
}
