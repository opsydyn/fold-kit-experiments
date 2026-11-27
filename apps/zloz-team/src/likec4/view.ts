import type { Html } from '@effect/ui/html';

import { creationBody, requestLimit } from './review';
import { acceptedGraphText, candidate, Message, type State } from './state';

export function view(h: Html.H<Message>, model: State, blockedReason = '') {
  const disabled = model.submission !== 'idle';
  const review = model.review;
  const ready = review?.status === 'ready' ? review : null;
  const diagnostics = review?.diagnostics ?? [];
  const emptyImport = model.insideBoard && ready?.graph.nodes.length === 0;
  const nodeLabels = new Map(ready?.graph.nodes.map(({ id, label }) => [id, label]));
  const tooLarge =
    !model.insideBoard &&
    ready?.graphText &&
    model.name.trim() &&
    new TextEncoder().encode(creationBody(model.creationId, model.name, ready.graphText))
      .byteLength > requestLimit;

  const alchemy = model.format === 'alchemy';
  const title = alchemy ? 'Import Alchemy infrastructure' : 'Import a LikeC4 view';
  return h.section
    .attr('aria-label', alchemy ? 'Alchemy infrastructure import' : 'LikeC4 import')
    .style({ display: 'grid', gap: '1rem' })
    .children(
      h.h2.children(title),
      ...(blockedReason ? [h.p.attr('role', 'status').children(blockedReason)] : []),
      ...(emptyImport
        ? [h.p.attr('role', 'status').children('This view has no nodes to import.')]
        : []),
      h.label.children(
        alchemy ? 'Alchemy infrastructure JSON file' : 'LikeC4 JSON file',
        h.input
          .key(String(model.fileKey))
          .attr('type', 'file')
          .attr('accept', '.json,application/json')
          .disabled(disabled)
          .value('')
          .on('change', ({ files }) => Message.SelectedFile({ file: files[0] })),
      ),
      ...(alchemy
        ? [
            h.label.children(
              'Or paste Alchemy infrastructure JSON',
              h.textarea
                .value(model.source)
                .disabled(disabled || model.reading)
                .attr('maxlength', String(requestLimit))
                .on('input', ({ value: text }) => Message.ChangedSnapshotText({ text })),
            ),
            h.button
              .attr('type', 'button')
              .disabled(disabled || model.reading || !model.source.trim())
              .on('click', Message.ClickedReviewSnapshot())
              .children('Review snapshot'),
          ]
        : []),
      h.p.attr('aria-live', 'polite').children(model.reading ? 'Reading file…' : model.notice),
      ...(model.views.length
        ? [
            h.label.children(
              'Static view',
              h.select
                .disabled(disabled)
                .on('change', ({ value: id }) => Message.SelectedView({ id }))
                .children(
                  h.option
                    .attr('value', '')
                    .selected(model.selected === '')
                    .children('Choose a view'),
                  ...model.views.map((id) =>
                    h.option
                      .attr('value', id)
                      .key(id)
                      .selected(model.selected === id)
                      .children(id),
                  ),
                ),
            ),
          ]
        : []),
      ...(ready
        ? [
            h.h3.children('Diagram preview'),
            ...('provenance' in ready
              ? [
                  h.p.children(`Source: ${ready.provenance}`),
                  h.p.children(
                    'Resources, bindings and dependencies from the captured plan. Action labels describe the plan at capture time.',
                  ),
                ]
              : []),
            ...(model.focused
              ? [
                  h.button
                    .attr('type', 'button')
                    .on('click', Message.FocusedFinding({ resource: null }))
                    .children('Show whole stack'),
                ]
              : []),
            ...(ready.svg
              ? [
                  h.img
                    .attr(
                      'src',
                      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ready.svg),
                    )
                    .attr(
                      'alt',
                      model.focused
                        ? 'Read-only preview focused on ' + model.focused
                        : 'Read-only preview of ' + model.selected,
                    )
                    .style({ width: '100%', maxHeight: '26rem', objectFit: 'contain' }),
                ]
              : []),
            h.details.children(
              h.summary.children(
                `Elements and relationships (${ready.graph.nodes.length} nodes, ${ready.graph.edges.length} edges)`,
              ),
              h.ul.children(
                ready.graph.nodes.map((node) => h.li.key(node.id).children(node.label)),
              ),
              h.ul.children(
                ready.graph.edges.map((edge) =>
                  h.li
                    .key(edge.id)
                    .children(
                      `${nodeLabels.get(edge.source.node)} → ${nodeLabels.get(edge.target.node)}${edge.label ? ': ' + edge.label : ''}`,
                    ),
                ),
              ),
            ),
          ]
        : []),
      ...(diagnostics.length
        ? [
            h.h3.children('Import findings'),
            h.ul.children(
              diagnostics.map((item) =>
                h.li.children(
                  `${item.severity === 'info' ? 'Generated' : item.severity === 'loss' ? 'Loss' : 'Error'} · ${item.subject ? item.subject + ' · ' : ''}${item.message}`,
                  ...(alchemy && item.subject
                    ? [
                        h.button
                          .attr('type', 'button')
                          .attr('aria-pressed', String(model.focused === item.subject))
                          .on('click', Message.FocusedFinding({ resource: item.subject }))
                          .children(`Show ${item.subject}`),
                      ]
                    : []),
                ),
              ),
            ),
          ]
        : []),
      ...(ready?.blockers.length
        ? [
            h.p.attr('role', 'alert').children(ready.blockers.join(' ')),
            ...('v3' in ready
              ? [
                  h.a
                    .attr(
                      'href',
                      'data:application/json;charset=utf-8,' + encodeURIComponent(ready.v3),
                    )
                    .attr('download', 'likec4-view.zloz-v3.json')
                    .children('Download ZLOZ v3'),
                ]
              : []),
          ]
        : []),
      ...(ready?.graphText
        ? [
            ...(!model.insideBoard
              ? [
                  h.label.children(
                    'Imported diagram name',
                    h.input
                      .value(model.name)
                      .attr('maxlength', String(120))
                      .disabled(disabled)
                      .on('input', ({ value: value }) => Message.ChangedName({ value })),
                  ),
                ]
              : []),
            ...(diagnostics.some(({ severity }) => severity === 'loss')
              ? [
                  h.label.children(
                    h.input
                      .attr('type', 'checkbox')
                      .checked(model.accepted)
                      .disabled(disabled)
                      .on('click', Message.ChangedAcknowledgement()),
                    ' I reviewed the import losses',
                  ),
                ]
              : []),
            ...(tooLarge
              ? [h.p.attr('role', 'alert').children('This creation request exceeds 1 MiB.')]
              : []),
          ]
        : []),
      ...(review
        ? [
            h.div.children(
              h.button
                .attr('type', 'button')
                .disabled(disabled)
                .on('click', Message.CancelledPreview())
                .children('Cancel preview'),
              h.button
                .attr('type', 'button')
                .disabled(
                  model.insideBoard
                    ? Boolean(blockedReason) || emptyImport || !acceptedGraphText(model)
                    : !candidate(model) || model.submission === 'sending',
                )
                .on('click', Message.ClickedApply())
                .children(
                  model.insideBoard
                    ? 'Import into this board'
                    : model.submission === 'retry'
                      ? 'Retry creation'
                      : alchemy
                        ? 'Create team diagram'
                        : 'Apply',
                ),
            ),
          ]
        : []),
    );
}
