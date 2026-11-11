import type { HtmlBuilder } from 'foldkit/html';

import { workbenchMappingReview } from './mapping-review';
import { Message } from './message';
import type { Model } from './model';

export function mappingReviewPanel(model: Model, h: HtmlBuilder<Message>) {
  const context = workbenchMappingReview(model),
    { selected, preview } = context;
  const diagnostics = model.diagnosticsEnabled && !model.minimalMode && model.diagnostics.status;
  const losses = selected
    ? preview.disclosures.filter((loss) => loss.kind === selected.kind && loss.id === selected.id)
    : [];
  const alreadyDdd =
    selected?.kind === 'edge' && selected.decision.sourceArchitecture?.family === 'ddd';
  const reason =
    context.reason ??
    (alreadyDdd
      ? 'Existing DDD relationships are inspected here. Workshop choices cannot replace their meaning.'
      : null);
  const states = {
    proposed: 'Proposed',
    ambiguous: 'Needs a choice',
    unmapped: 'Unmapped',
    retained: 'Retained',
    blocked: 'Incompatible',
  };
  return h.section(
    [h.AriaLabel('Workshop mapping preview'), h.Class('mapping-review')],
    [
      h.p(
        [h.Class('mapping-review-intro')],
        [
          'Preview only. Review workshop intent before modelling it as DDD. Choices do not change the canvas or Undo.',
        ],
      ),
      ...(diagnostics
        ? [
            h.div(
              [h.Class('mapping-summary'), h.AriaLabel('Mapping summary')],
              [
                h.span(
                  [],
                  [
                    `${context.items.filter((item) => item.decision.type === 'proposed').length} proposed`,
                  ],
                ),
                h.span(
                  [],
                  [
                    `${context.items.filter((item) => item.decision.type === 'ambiguous' || item.decision.type === 'unmapped' || item.decision.type === 'blocked').length} unresolved`,
                  ],
                ),
                h.span([], [`${preview.disclosures.length} prospective losses`]),
              ],
            ),
          ]
        : []),
      ...(context.items.length
        ? [
            h.label(
              [h.Class('workbench-field')],
              [
                'Review mapping',
                h.select(
                  [
                    h.AriaLabel('Review mapping'),
                    h.OnChange((key) =>
                      Message.SelectedMappingReviewItem({ ...context.scope, key }),
                    ),
                  ],
                  context.items.map((item) =>
                    h.option(
                      [h.Key(item.key), h.Value(item.key), h.Selected(selected?.key === item.key)],
                      [
                        `${item.kind === 'node' ? 'Node' : 'Connection'} · ${item.label} · ${states[item.decision.type]}`,
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ]
        : [
            h.p(
              [],
              [
                'No EventStorming notes in this source. Open the workshop example to explore proposed mappings.',
              ],
            ),
            h.button(
              [
                h.Type('button'),
                h.Disabled(model.historyReview !== null),
                h.OnClick(Message.SelectedExample({ example: 'event-storming' })),
              ],
              ['Open event-storming example'],
            ),
          ]),
      ...(selected
        ? [
            h.div(
              [
                h.Key(selected.key),
                h.Class('mapping-decision'),
                h.DataAttribute('mapping-state', selected.decision.type),
                h.AriaLabel('Mapping decision'),
              ],
              [
                h.span([h.Class('mapping-status')], [states[selected.decision.type]]),
                h.h3([], [selected.label]),
                h.p(
                  [h.Class('mapping-source')],
                  [
                    `Source: ${selected.decision.sourceArchitecture?.family ?? 'untyped'} · ${selected.decision.sourceArchitecture?.role ?? 'connection'}`,
                  ],
                ),
                h.label(
                  [h.Class('workbench-field')],
                  [
                    'Preview choice',
                    h.select(
                      [
                        h.AriaLabel('Preview choice'),
                        h.Disabled(reason !== null),
                        h.AriaDescribedBy('mapping-choice-reason'),
                        h.OnChange((value) =>
                          Message.SelectedMappingReviewChoice({
                            ...context.scope,
                            key: selected.key,
                            value,
                          }),
                        ),
                      ],
                      context.choices.map((choice) =>
                        h.option(
                          [
                            h.Key(choice.value),
                            h.Value(choice.value),
                            h.Selected(context.value === choice.value),
                          ],
                          [choice.label],
                        ),
                      ),
                    ),
                  ],
                ),
                ...(selected.decision.type === 'proposed'
                  ? [
                      h.p(
                        [h.Class('mapping-target')],
                        [
                          `Proposed: DDD · ${selected.decision.architecture.role} (${selected.decision.origin})`,
                        ],
                      ),
                    ]
                  : []),
                ...(selected.decision.type === 'ambiguous'
                  ? [
                      h.p(
                        [],
                        [
                          `Suggested interpretations: ${selected.decision.candidates.map((candidate) => candidate.role).join(', ')}. You can choose another supported DDD role or keep the workshop note.`,
                        ],
                      ),
                    ]
                  : []),
                h.p([h.AriaLabel('Mapping reason')], [selected.decision.reason]),
                h.p(
                  [h.Id('mapping-choice-reason'), h.Class('mapping-choice-reason')],
                  [
                    reason ??
                      'Temporary review choice only. Conversion requires separate freshness, policy and loss-consent checks.',
                  ],
                ),
                ...losses.map((loss) =>
                  h.div(
                    [
                      h.Key(`${loss.kind}:${loss.id}`),
                      h.Class('mapping-loss'),
                      h.AriaLabel('Selected mapping loss'),
                    ],
                    [h.h4([], ['Loss if converted']), h.p([], [loss.reason])],
                  ),
                ),
              ],
            ),
          ]
        : []),
      ...(preview.disclosures.length
        ? [
            h.details(
              [h.Class('mapping-losses')],
              [
                h.summary([], ['All prospective semantic losses']),
                ...preview.disclosures.map((loss) =>
                  h.p(
                    [h.Key(`${loss.kind}:${loss.id}`)],
                    [
                      `${context.items.find((item) => item.kind === loss.kind && item.id === loss.id)?.label ?? loss.id}: ${loss.reason}`,
                    ],
                  ),
                ),
              ],
            ),
          ]
        : []),
      h.p(
        [h.Class('mapping-review-footer')],
        ['No conversion has been applied. Keep the workshop model as the source of truth.'],
      ),
      ...(context.items.length
        ? [
            h.button(
              [
                h.Type('button'),
                h.Disabled(context.reason !== null || context.stored.choices.length === 0),
                h.OnClick(Message.ClickedResetMappingReview(context.scope)),
              ],
              ['Reset preview choices'],
            ),
          ]
        : []),
      ...(model.mappingReviewNotice
        ? [
            h.p(
              [h.Role('status'), h.AriaLabel('Mapping review feedback')],
              [model.mappingReviewNotice],
            ),
          ]
        : []),
    ],
  );
}
