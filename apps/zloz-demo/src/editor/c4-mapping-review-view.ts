import type { Html } from '@effect/ui/html';

import { workbenchC4MappingReview, type C4MappingReviewForm } from './c4-mapping-review';
import { c4PlanReviewPanel } from './c4-plan-review-view';
import { c4RetainedConversions } from './c4-retained-conversions-view';
import { Message } from './message';
import type { Model } from './model';
import { receiptReviewPanel } from './receipt-review';

export function c4MappingReviewPanel<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  if (model.receiptReview) return receiptReviewPanel(model, h, send);
  const context = workbenchC4MappingReview(model),
    selected = context.selected;
  const document = context.preview.provenance.document;
  const unresolved = context.items.filter(
    (item) =>
      item.decision.type === 'ambiguous' ||
      item.decision.type === 'unmapped' ||
      item.decision.type === 'blocked',
  );
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
    h.label
      .key(`c4-field:${controlKey}:${field}`)
      .class('workbench-field')
      .children(
        label,
        h.input
          .attr('type', 'text')
          .key(`c4-input:${controlKey}:${field}`)
          .attr('aria-label', label)
          .value(context.form[field])
          .disabled(context.reason !== null)
          .attr('aria-describedby', 'c4-review-reason')
          .on('input', ({ value }) =>
            send(Message.ChangedC4ReviewForm({ ...identity, field, value })),
          ),
      );
  const action = (value: 'preview' | 'retain' | 'clear' | 'reset', label: string) =>
    h.button
      .attr('type', 'button')
      .key(`c4-action:${controlKey}:${value}`)
      .attr('aria-label', label)
      .disabled(
        !selected ||
          context.reason !== null ||
          (value === 'preview' && context.previewReason !== null),
      )
      .attr('aria-describedby', value === 'preview' ? 'c4-preview-reason' : 'c4-review-reason')
      .on('click', send(Message.ClickedC4ReviewAction({ ...identity, action: value })))
      .children(label);
  return h.section
    .attr('aria-label', 'C4 mapping review')
    .class('mapping-review c4-mapping-review')
    .children(
      h.h2.children('Workshop → C4'),
      h.p.children(
        'Review explicit structural interpretations and communication labels. Previewing changes review choices only; the canvas model and Undo history stay unchanged. Review placements and exact losses below, acknowledge them, then explicitly Apply as one Undo step.',
      ),
      h.details.children(
        h.summary.children('C4 source provenance'),
        h.dl
          .class('mapping-provenance')
          .children(
            h.dt.children('Model'),
            h.dd.children(document.name),
            h.dt.children('Snapshot'),
            h.dd.children(context.sourceLabel),
            h.dt.children('Fork ancestry'),
            h.dd.children(
              document.origin
                ? `${document.origin.modelName} · ${document.origin.edition.name}`
                : 'Original model · no fork parent',
            ),
          ),
        h.p.children(
          'The complete source graph, camera, editions and ancestry are captured by the package preview. No runtime boundaries or protocols are inferred.',
        ),
        ...(!model.minimalMode && model.diagnosticsEnabled
          ? [
              h.details.children(
                h.summary.children('C4 source identifiers'),
                h.p.children(`Model: ${document.id}`),
                h.p.children(`Session: ${context.preview.provenance.sessionId}`),
                h.p.children(`Revision: ${context.preview.provenance.revision}`),
              ),
            ]
          : []),
      ),
      h.p
        .id('c4-review-reason')
        .attr('role', 'status')
        .children(
          context.reason ??
            'Choices require an explicit preview. Leaving an item discards its unpreviewed draft.',
        ),
      ...(selected
        ? [
            h.label.class('workbench-field').children(
              'Review C4 mapping',
              h.select
                .attr('aria-label', 'Review C4 mapping')
                .value(selected.key)
                .on('change', ({ value: key }) =>
                  send(Message.SelectedC4ReviewItem({ ...context.scope, key })),
                )
                .children(
                  ...context.items.map((item) =>
                    h.option
                      .key(item.key)
                      .attr('value', item.key)
                      .selected(selected.key === item.key)
                      .children(
                        `${item.kind === 'node' ? 'Node' : 'Relation'} · ${item.label} · ${status[item.decision.type]}`,
                      ),
                  ),
                ),
            ),
            h.p
              .attr('role', 'status')
              .attr('aria-label', 'C4 mapping target')
              .children(selected.label),
            h.p
              .attr('role', 'status')
              .attr('aria-label', 'C4 mapping decision')
              .children(status[selected.decision.type]),
            h.p.children(selected.decision.reason),
            ...(selected.decision.type === 'ambiguous'
              ? [
                  h.h3.children('Possible interpretations'),
                  h.ul
                    .attr('aria-label', 'C4 mapping candidates')
                    .children(
                      ...selected.decision.candidates.map((candidate) =>
                        h.li.key(candidate.role).children(candidate.role),
                      ),
                    ),
                  h.p.children(
                    'Candidates are non-exhaustive. Choose explicitly or keep workshop meaning; workshop externality does not establish C4 scope.',
                  ),
                ]
              : []),
            ...(selected.decision.sourceArchitecture?.family === 'event-storming' &&
            selected.decision.sourceArchitecture.role === 'hotspot'
              ? [
                  h.p.children(
                    `Authored hotspot status: ${selected.decision.sourceArchitecture.status}. Reinterpreting this annotation would replace that meaning.`,
                  ),
                ]
              : []),
            ...(selected.kind === 'node'
              ? [
                  h.label.class('workbench-field').children(
                    'C4 role',
                    h.select
                      .key(`c4-role:${controlKey}`)
                      .attr('aria-label', 'C4 role')
                      .value(context.form.role)
                      .disabled(context.reason !== null)
                      .attr('aria-describedby', 'c4-preview-reason')
                      .on('change', ({ value }) =>
                        send(Message.ChangedC4ReviewForm({ ...identity, field: 'role', value })),
                      )
                      .children(
                        h.option.attr('value', '').children('Choose a C4 role'),
                        ...context.roles.map((role) =>
                          h.option
                            .key(role.value)
                            .attr('value', role.value)
                            .disabled(role.disabled)
                            .selected(role.value === context.form.role)
                            .children(
                              role.disabled
                                ? `${role.label} — incompatible with group kind`
                                : role.label,
                            ),
                        ),
                      ),
                  ),
                  textField('name', 'C4 structural name'),
                  h.label.class('workbench-field').children(
                    'C4 scope',
                    h.select
                      .key(`c4-scope:${controlKey}`)
                      .attr('aria-describedby', 'c4-review-reason')
                      .attr('aria-label', 'C4 scope')
                      .value(context.form.scope)
                      .disabled(context.reason !== null)
                      .on('change', ({ value }) =>
                        send(Message.ChangedC4ReviewForm({ ...identity, field: 'scope', value })),
                      )
                      .children(
                        ...[
                          ['', 'Unspecified · do not infer'],
                          ['internal', 'Internal'],
                          ['external', 'External'],
                        ].map(([value, label]) =>
                          h.option
                            .attr('value', value ?? '')
                            .selected(value === context.form.scope)
                            .children(label ?? ''),
                        ),
                      ),
                  ),
                  ...(context.form.role === 'container' || context.form.role === 'component'
                    ? [textField('technology', 'C4 technology')]
                    : []),
                ]
              : [textField('name', 'C4 communication label')]),
            h.p
              .id('c4-preview-reason')
              .attr('role', 'status')
              .children(
                context.previewReason ??
                  'Ready to preview this explicit choice. This does not convert the model.',
              ),
            h.div
              .class('workbench-actions')
              .children(
                action('preview', 'Preview C4 mapping'),
                action('retain', 'Keep workshop meaning for C4'),
                action('clear', 'Clear C4 choice'),
                action('reset', 'Reset C4 choices'),
              ),
          ]
        : [h.p.children('Open a workshop example from Diagram to review its C4 interpretations.')]),
      c4PlanReviewPanel(model, h, send, context),
      c4RetainedConversions(model, h, send),
      receiptReviewPanel(model, h, send),
      h.h3.children('Unresolved C4 mappings'),
      h.ul
        .attr('aria-label', 'Unresolved C4 mappings')
        .children(
          ...(unresolved.length
            ? unresolved.map((item) =>
                h.li.key(item.key).children(`${item.label}: ${item.decision.reason}`),
              )
            : [h.li.key('no-unresolved').children('No unresolved mapping choices.')]),
        ),
      h.h3.children('Prospective C4 semantic losses'),
      h.p.children(
        'These mapping-preview findings precede placement review. Use Exact C4 plan losses above for acknowledgement.',
      ),
      ...(context.preview.disclosures.length
        ? [
            h.ul
              .attr('aria-label', 'C4 semantic losses')
              .children(
                ...context.preview.disclosures.map((loss) =>
                  h.li
                    .key(`${loss.kind}:${loss.id}:${loss.code}`)
                    .children(
                      h.strong.children(
                        context.items.find((item) => item.kind === loss.kind && item.id === loss.id)
                          ?.label ?? loss.id,
                      ),
                      h.p.children(loss.reason),
                    ),
                ),
              ),
          ]
        : [
            h.p.children(
              'No replacements proposed yet. Retention preserves workshop meaning; it is not C4 compatibility.',
            ),
          ]),
    );
}
