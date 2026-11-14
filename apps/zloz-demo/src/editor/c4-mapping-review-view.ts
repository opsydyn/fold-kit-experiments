import type { HtmlBuilder } from 'foldkit/html';

import { workbenchC4MappingReview, type C4MappingReviewForm } from './c4-mapping-review';
import { Message } from './message';
import type { Model } from './model';

export function c4MappingReviewPanel(model: Model, h: HtmlBuilder<Message>) {
  const context = workbenchC4MappingReview(model),
    selected = context.selected;
  const document = context.preview.provenance.document;
  const identity = { ...context.scope, key: selected?.key ?? '' };
  // Native control identity follows the reviewed item as optional meaning sections appear.
  const controlKey = `${context.scope.epoch}:${context.scope.revision}:${context.scope.editionId}:${selected?.key ?? ''}`;
  const status = {
    proposed: 'Explicit proposal',
    ambiguous: 'Needs a choice',
    unmapped: 'Unmapped',
    retained: 'Workshop meaning retained',
    blocked: 'Blocked communication',
  };
  const textField = (field: keyof C4MappingReviewForm, label: string) =>
    h.label(
      [h.Key(`c4-field:${controlKey}:${field}`), h.Class('workbench-field')],
      [
        label,
        h.input([
          h.Type('text'),
          h.Key(`c4-input:${controlKey}:${field}`),
          h.AriaLabel(label),
          h.Value(context.form[field]),
          h.Disabled(context.reason !== null),
          h.AriaDescribedBy('c4-review-reason'),
          h.OnInput((value) => Message.ChangedC4ReviewForm({ ...identity, field, value })),
        ]),
      ],
    );
  const action = (value: 'preview' | 'retain' | 'clear' | 'reset', label: string) =>
    h.button(
      [
        h.Type('button'),
        h.Key(`c4-action:${controlKey}:${value}`),
        h.AriaLabel(label),
        h.Disabled(
          !selected ||
            context.reason !== null ||
            (value === 'preview' && context.previewReason !== null),
        ),
        h.AriaDescribedBy(value === 'preview' ? 'c4-preview-reason' : 'c4-review-reason'),
        h.OnClick(Message.ClickedC4ReviewAction({ ...identity, action: value })),
      ],
      [label],
    );
  return h.section(
    [h.AriaLabel('C4 mapping review'), h.Class('mapping-review c4-mapping-review')],
    [
      h.h2([], ['Workshop → C4']),
      h.p(
        [],
        [
          'Review explicit structural interpretations and communication labels. Previewing changes review choices only; the canvas model and Undo history stay unchanged. Conversion and Apply are not available here.',
        ],
      ),
      h.details(
        [],
        [
          h.summary([], ['C4 source provenance']),
          h.dl(
            [h.Class('mapping-provenance')],
            [
              h.dt([], ['Model']),
              h.dd([], [document.name]),
              h.dt([], ['Snapshot']),
              h.dd([], [context.sourceLabel]),
              h.dt([], ['Fork ancestry']),
              h.dd(
                [],
                [
                  document.origin
                    ? `${document.origin.modelName} · ${document.origin.edition.name}`
                    : 'Original model · no fork parent',
                ],
              ),
            ],
          ),
          h.p(
            [],
            [
              'The complete source graph, camera, editions and ancestry are captured by the package preview. No runtime boundaries or protocols are inferred.',
            ],
          ),
          ...(!model.minimalMode && model.diagnosticsEnabled
            ? [
                h.details(
                  [],
                  [
                    h.summary([], ['C4 source identifiers']),
                    h.p([], [`Model: ${document.id}`]),
                    h.p([], [`Session: ${context.preview.provenance.sessionId}`]),
                    h.p([], [`Revision: ${context.preview.provenance.revision}`]),
                  ],
                ),
              ]
            : []),
        ],
      ),
      h.p(
        [h.Id('c4-review-reason'), h.Role('status')],
        [
          context.reason ??
            'Choices require an explicit preview. Leaving an item discards its unpreviewed draft.',
        ],
      ),
      ...(selected
        ? [
            h.label(
              [h.Class('workbench-field')],
              [
                'Review C4 mapping',
                h.select(
                  [
                    h.AriaLabel('Review C4 mapping'),
                    h.Value(selected.key),
                    h.OnChange((key) => Message.SelectedC4ReviewItem({ ...context.scope, key })),
                  ],
                  context.items.map((item) =>
                    h.option(
                      [h.Key(item.key), h.Value(item.key), h.Selected(selected.key === item.key)],
                      [
                        `${item.kind === 'node' ? 'Node' : 'Relation'} · ${item.label} · ${status[item.decision.type]}`,
                      ],
                    ),
                  ),
                ),
              ],
            ),
            h.p([h.Role('status'), h.AriaLabel('C4 mapping target')], [selected.label]),
            h.p(
              [h.Role('status'), h.AriaLabel('C4 mapping decision')],
              [status[selected.decision.type]],
            ),
            h.p([], [selected.decision.reason]),
            ...(selected.decision.type === 'ambiguous'
              ? [
                  h.h3([], ['Possible interpretations']),
                  h.ul(
                    [h.AriaLabel('C4 mapping candidates')],
                    selected.decision.candidates.map((candidate) =>
                      h.li([h.Key(candidate.role)], [candidate.role]),
                    ),
                  ),
                  h.p(
                    [],
                    [
                      'Candidates are non-exhaustive. Choose explicitly or keep workshop meaning; workshop externality does not establish C4 scope.',
                    ],
                  ),
                ]
              : []),
            ...(selected.decision.sourceArchitecture?.family === 'event-storming' &&
            selected.decision.sourceArchitecture.role === 'hotspot'
              ? [
                  h.p(
                    [],
                    [
                      `Authored hotspot status: ${selected.decision.sourceArchitecture.status}. Reinterpreting this annotation would replace that meaning.`,
                    ],
                  ),
                ]
              : []),
            ...(selected.kind === 'node'
              ? [
                  h.label(
                    [h.Class('workbench-field')],
                    [
                      'C4 role',
                      h.select(
                        [
                          h.Key(`c4-role:${controlKey}`),
                          h.AriaLabel('C4 role'),
                          h.Value(context.form.role),
                          h.Disabled(context.reason !== null),
                          h.AriaDescribedBy('c4-preview-reason'),
                          h.OnChange((value) =>
                            Message.ChangedC4ReviewForm({ ...identity, field: 'role', value }),
                          ),
                        ],
                        [
                          h.option([h.Value('')], ['Choose a C4 role']),
                          ...context.roles.map((role) =>
                            h.option(
                              [
                                h.Key(role.value),
                                h.Value(role.value),
                                h.Disabled(role.disabled),
                                h.Selected(role.value === context.form.role),
                              ],
                              [
                                role.disabled
                                  ? `${role.label} — incompatible with group kind`
                                  : role.label,
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  textField('name', 'C4 structural name'),
                  h.label(
                    [h.Class('workbench-field')],
                    [
                      'C4 scope',
                      h.select(
                        [
                          h.Key(`c4-scope:${controlKey}`),
                          h.AriaDescribedBy('c4-review-reason'),
                          h.AriaLabel('C4 scope'),
                          h.Value(context.form.scope),
                          h.Disabled(context.reason !== null),
                          h.OnChange((value) =>
                            Message.ChangedC4ReviewForm({ ...identity, field: 'scope', value }),
                          ),
                        ],
                        [
                          ['', 'Unspecified · do not infer'],
                          ['internal', 'Internal'],
                          ['external', 'External'],
                        ].map(([value, label]) =>
                          h.option(
                            [h.Value(value ?? ''), h.Selected(value === context.form.scope)],
                            [label ?? ''],
                          ),
                        ),
                      ),
                    ],
                  ),
                  ...(context.form.role === 'container' || context.form.role === 'component'
                    ? [textField('technology', 'C4 technology')]
                    : []),
                ]
              : [textField('name', 'C4 communication label')]),
            h.p(
              [h.Id('c4-preview-reason'), h.Role('status')],
              [
                context.previewReason ??
                  'Ready to preview this explicit choice. This does not convert the model.',
              ],
            ),
            h.div(
              [h.Class('workbench-actions')],
              [
                action('preview', 'Preview C4 mapping'),
                action('retain', 'Keep workshop meaning for C4'),
                action('clear', 'Clear C4 choice'),
                action('reset', 'Reset C4 choices'),
              ],
            ),
          ]
        : [h.p([], ['Open a workshop example from Diagram to review its C4 interpretations.'])]),
      h.h3([], ['Unresolved C4 mappings']),
      h.ul(
        [h.AriaLabel('Unresolved C4 mappings')],
        context.items
          .filter(
            (item) =>
              item.decision.type === 'ambiguous' ||
              item.decision.type === 'unmapped' ||
              item.decision.type === 'blocked',
          )
          .map((item) => h.li([h.Key(item.key)], [`${item.label}: ${item.decision.reason}`])),
      ),
      h.h3([], ['Prospective C4 semantic losses']),
      ...(context.preview.disclosures.length
        ? [
            h.ul(
              [h.AriaLabel('C4 semantic losses')],
              context.preview.disclosures.map((loss) =>
                h.li(
                  [h.Key(`${loss.kind}:${loss.id}:${loss.code}`)],
                  [
                    h.strong(
                      [],
                      [
                        context.items.find((item) => item.kind === loss.kind && item.id === loss.id)
                          ?.label ?? loss.id,
                      ],
                    ),
                    h.p([], [loss.reason]),
                  ],
                ),
              ),
            ),
          ]
        : [
            h.p(
              [],
              [
                'No replacements proposed yet. Retention preserves workshop meaning; it is not C4 compatibility.',
              ],
            ),
          ]),
    ],
  );
}
