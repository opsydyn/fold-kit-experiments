import type { View } from '@effect/ui';
import type { Html } from '@effect/ui/html';
import {
  editionPlaybackReason,
  resolveHistoryChangeNavigatorV2,
  resolveHistoryComparisonPresentationV2,
} from '@opsydyn/foldkit-zloz';
import type { EditorEvent } from '@opsydyn/foldkit-zloz';
import {
  graphSurface,
  historyComparisonV2,
  historyGhostsV2,
  historyChangeNavigatorV2,
  historyMinimap,
} from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { workbenchThemes } from '../editor/theme';
import { Side, Theme } from './message';
import { nativeView } from './native-view';
import { Message, targetFor, type Model } from './state';
export function view(h: Html.H<Message>, model: Model) {
  const displayed = model.native.inspection?.review.editor ?? model.review?.editor ?? model.editor;
  const editor =
    model.reading || model.native.pending ? { ...displayed, readOnly: true } : displayed;
  const artifact = model.native.inspection;
  const baseline = artifact
    ? { id: 'artifact:before', name: 'Before', snapshot: artifact.before }
    : model.editions.find((item) => item.id === model.baselineId);
  const selected = artifact
    ? { id: 'artifact:after', name: 'After', snapshot: artifact.after }
    : model.editions.find((item) => item.id === model.selectedId);
  const presentation =
    baseline && selected
      ? resolveHistoryComparisonPresentationV2(baseline, selected, {
          ghosts: model.ghosts,
          displaySide: artifact?.side ?? model.side,
          minimalMode: model.minimal,
        })
      : null;
  const navigation = resolveHistoryChangeNavigatorV2(presentation?.comparison ?? null, model.side, {
    filters: model.filters,
    filterLabels: { added: 'Added', removed: 'Removed', changed: 'Changed' },
    blockedReason: model.reading ? 'Import active.' : null,
  });
  const scheme = model.theme === 'system' ? (model.systemDark ? 'dark' : 'light') : model.theme;
  const observe = (event: EditorEvent) => Message.ObservedEditor({ epoch: model.epoch, event });
  const button = (text: string, message: Message, disabled = false): View.Content<Message> =>
    h.button.attr('type', 'button').on('click', message).disabled(disabled).children(text);
  const field = (label: string, input: View.Content<Message>): View.Content<Message> =>
    h.label.class('workbench-field').children(label, input);
  const choice = (
    label: string,
    value: string,
    select: (id: string) => Message,
  ): View.Content<Message> =>
    field(
      label,
      h.select
        .attr('aria-label', label)
        .value(value)
        .disabled(model.reading !== null)
        .on('change', ({ value }) => select(value))
        .children(
          ...model.editions.map((item) =>
            h.option
              .attr('value', item.id)
              .selected(value === item.id)
              .children(`${item.name} · ${item.snapshot.connectionMode}`),
          ),
        ),
    );
  const playbackReason = !model.visible
    ? 'Playback pauses while this page is hidden.'
    : editionPlaybackReason(model.playback.cursor);
  const id = `history-v2-${model.epoch}`;
  const layout = () =>
    h.div.class('workbench-layout').children(
      h.aside
        .class('workbench-sidebar')
        .attr('aria-label', 'V2 history controls')
        .children(
          h.a.class('workbench-skip').attr('href', `#${id}-surface`).children('Skip to canvas'),
          h.div
            .class('workbench-sidebar-heading')
            .children(h.h1.children('Architecture through time')),
          h.div
            .class('workbench-sections')
            .attr('aria-label', 'History sections')
            .children(
              ...(['files', 'review', 'playback', 'restore', 'authoring', 'evidence'] as const).map(
                (section) =>
                  h.button
                    .attr('type', 'button')
                    .attr('aria-pressed', String(model.section === section))
                    .on('click', Message.SelectedSection({ section }))
                    .children(
                      section === 'files'
                        ? 'Capture / files'
                        : section === 'review'
                          ? 'Review / compare'
                          : section === 'playback'
                            ? 'Playback'
                            : section === 'restore'
                              ? 'Restore / Undo'
                              : section === 'authoring'
                                ? 'Authoring'
                                : 'Portable review',
                    ),
              ),
            ),
          h.div.class('workbench-sidebar-scroll').children(
            h.details
              .key('canvas-help')
              .children(
                h.summary.children('Canvas help'),
                h.p.children(
                  editor.readOnly
                    ? 'Read-only checkpoint. Drag the background to pan and scroll to zoom. Select a change to reveal it on the chosen side. Working edits and Undo remain independent.'
                    : 'Drag the canvas to pan and scroll to zoom. Drag nodes to move them or use the arrow keys on a focused node.',
                ),
              ),
            h.p.children('Mixed-mode editions. Independent working and read-only review sessions.'),
            h.p
              .attr('role', 'status')
              .attr('aria-live', 'polite')
              .attr('aria-label', 'History workflow status')
              .children(model.notice),
            h.p
              .attr('aria-label', 'Working connection mode')
              .children(`Working mode: ${model.editor.connectionMode ?? 'strict'}`),
            ...(model.review
              ? [
                  h.p
                    .attr('aria-label', 'Review connection mode')
                    .children(`Review mode: ${model.review.editor.connectionMode}`),
                ]
              : []),
            field(
              'Theme',
              h.select
                .attr('aria-label', 'Theme')
                .value(model.theme)
                .on('change', ({ value }) =>
                  Message.SelectedTheme({ theme: Schema.decodeUnknownSync(Theme)(value) }),
                )
                .children(
                  ...['system', 'light', 'dark'].map((value) =>
                    h.option
                      .attr('value', value)
                      .selected(model.theme === value)
                      .children(value),
                  ),
                ),
            ),
            field(
              'Minimal mode',
              h.input
                .attr('type', 'checkbox')
                .checked(model.minimal)
                .on('click', Message.ClickedMinimal()),
            ),
            field(
              'Show minimap',
              h.input
                .attr('type', 'checkbox')
                .checked(model.minimap)
                .on('click', Message.ClickedMinimap()),
            ),
            ...(model.minimap ? [historyMinimap(h, editor, observe)] : []),
            ...(model.section === 'authoring' || model.section === 'evidence'
              ? [nativeView(model, h)]
              : []),
            h.div
              .key('files')
              .attr('hidden', model.section !== 'files' ? '' : undefined)
              .children(
                h.h2.children('Capture and portable files'),
                field(
                  'Edition name',
                  h.input
                    .attr('aria-label', 'Edition name')
                    .value(model.name)
                    .on('input', ({ value: name }) => Message.ChangedName({ name })),
                ),
                button(
                  'Capture working edition',
                  Message.ClickedCapture(),
                  !!model.reading || !model.name.trim(),
                ),
                h.div
                  .class('workbench-actions')
                  .children(
                    button('Download v2 model', Message.ClickedDownload({ kind: 'model' })),
                    button('Download v2 editions', Message.ClickedDownload({ kind: 'archive' })),
                  ),
                field(
                  'Open v2 model',
                  h.input
                    .attr('type', 'file')
                    .key(`file-${model.sequence}`)
                    .attr('accept', '.json,application/json')
                    .disabled(!!model.reading)
                    .attr('aria-label', 'Open v2 model')
                    .on('change', ({ files }) => Message.ChoseFile({ kind: 'model', files })),
                ),
                field(
                  'Merge v2 editions',
                  h.input
                    .attr('type', 'file')
                    .key(`file-${model.sequence}`)
                    .attr('accept', '.json,application/json')
                    .disabled(!!model.reading)
                    .attr('aria-label', 'Merge v2 editions')
                    .on('change', ({ files }) => Message.ChoseFile({ kind: 'archive', files })),
                ),
                ...(model.reading ? [button('Cancel import', Message.ClickedCancelRead())] : []),
                ...(model.previousSession
                  ? [
                      button(
                        'Switch to previous model session',
                        Message.ClickedPreviousSession(),
                        !!model.reading,
                      ),
                    ]
                  : []),
                ...(model.conflict
                  ? [
                      h.div
                        .attr('aria-label', 'Edition import conflict')
                        .children(
                          h.p.children('Import blocked; no editions were replaced.'),
                          historyComparisonV2(
                            h,
                            resolveHistoryComparisonPresentationV2(
                              model.conflict.existing,
                              model.conflict.proposed,
                            ),
                          ),
                        ),
                    ]
                  : []),
                h.details.children(
                  h.summary.children('File compatibility'),
                  h.p.children(
                    'V2 files retain connection modes. Imports use UTF-8 and a 5 MiB limit. The architecture workbench keeps its existing strict-only Mermaid, patch and receipt contracts; incompatible files are rejected, never automatically downgraded.',
                  ),
                ),
              ),
            h.div
              .key('review')
              .attr('hidden', model.section !== 'review' ? '' : undefined)
              .children(
                h.h2.children('Review and compare'),
                choice('Selected edition', model.selectedId, (id) =>
                  Message.SelectedEdition({ id }),
                ),
                choice('Baseline edition', model.baselineId, (id) =>
                  Message.SelectedBaseline({ id }),
                ),
                field(
                  'Comparison side',
                  h.select
                    .attr('aria-label', 'Comparison side')
                    .value(model.side)
                    .disabled(!!model.reading)
                    .on('change', ({ value: side }) =>
                      Message.SelectedSide({ side: Schema.decodeUnknownSync(Side)(side) }),
                    )
                    .children(
                      ...['baseline', 'selected'].map((side) =>
                        h.option
                          .attr('value', side)
                          .selected(model.side === side)
                          .children(side),
                      ),
                    ),
                ),
                button(
                  'Review chosen edition',
                  Message.ClickedReview(),
                  !!model.reading || !targetFor(model),
                ),
                button('Return to working model', Message.ClickedPresent(), !model.review),
                ...(model.review && presentation ? [historyComparisonV2(h, presentation)] : []),
                ...(['enabled', 'nodes', 'edges', 'movements'] as const).map((part) =>
                  field(
                    part === 'enabled' ? 'Show comparison ghosts' : `${part} ghosts`,
                    h.input
                      .attr('type', 'checkbox')
                      .checked(model.ghosts[part])
                      .on('click', Message.ClickedGhost({ part })),
                  ),
                ),
                historyChangeNavigatorV2(
                  h,
                  navigation,
                  {
                    onFilter: (kind) => Message.ClickedFilter({ kind }),
                    onFocus: (request) => Message.ClickedChange({ request }),
                  },
                  { className: 'history-changes', hideStatus: model.minimal },
                ),
                h.div
                  .class('workbench-actions')
                  .children(
                    button(
                      'Previous change',
                      Message.ClickedChangeStep({ direction: 'previous' }),
                      !!model.reading,
                    ),
                    button(
                      'Next change',
                      Message.ClickedChangeStep({ direction: 'next' }),
                      !!model.reading,
                    ),
                  ),
              ),
            h.div
              .key('playback')
              .attr('hidden', model.section !== 'playback' ? '' : undefined)
              .children(
                h.h2.children('Playback'),
                h.p
                  .attr('role', 'status')
                  .attr('aria-live', 'polite')
                  .attr('aria-label', 'Edition playback state')
                  .children(`Playback: ${model.playback.cursor.status}`),
                h.p
                  .attr('aria-label', 'Playback availability')
                  .children(
                    playbackReason ??
                      'Automatic playback is opt-in. Inspection never changes the working model.',
                  ),
                h.div
                  .class('workbench-actions')
                  .children(
                    button(
                      'Play editions',
                      Message.ClickedTransport({ action: 'PlayClicked' }),
                      !!model.reading ||
                        playbackReason !== null ||
                        model.playback.cursor.status === 'playing',
                    ),
                    button('Pause playback', Message.ClickedTransport({ action: 'PauseClicked' })),
                    button(
                      'Rewind editions',
                      Message.ClickedTransport({ action: 'RewindClicked' }),
                      !!model.reading,
                    ),
                    button(
                      'Previous edition',
                      Message.ClickedTransport({ action: 'PreviousClicked' }),
                      !!model.reading,
                    ),
                    button(
                      'Next edition',
                      Message.ClickedTransport({ action: 'NextClicked' }),
                      !!model.reading,
                    ),
                  ),
              ),
            h.div
              .key('restore')
              .attr('hidden', model.section !== 'restore' ? '' : undefined)
              .children(
                h.h2.children('Guarded restore'),
                field(
                  'Protect edition restore',
                  h.input
                    .attr('type', 'checkbox')
                    .checked(model.protectedRestore)
                    .on('click', Message.ClickedProtection()),
                ),
                button(
                  'Preview restore',
                  Message.ClickedRestorePreview(),
                  !model.review || !!model.reading || !targetFor(model),
                ),
                ...(model.preview
                  ? [
                      h.p.children(
                        `Restore ${model.preview.edition.name} · ${model.preview.edition.snapshot.connectionMode}. One Undo restores the previous graph and mode.`,
                      ),
                      button(
                        'Confirm restore',
                        Message.ClickedRestoreConfirm(),
                        model.protectedRestore || !!model.reading,
                      ),
                      button('Cancel restore', Message.ClickedRestoreCancel()),
                    ]
                  : []),
                h.div
                  .class('workbench-actions')
                  .children(
                    button(
                      'Undo working edit',
                      observe({ type: 'UndoPressed' }),
                      !!model.review || !!model.reading || !model.editor.past.length,
                    ),
                    button(
                      'Redo working edit',
                      observe({ type: 'RedoPressed' }),
                      !!model.review || !!model.reading || !model.editor.future.length,
                    ),
                  ),
                field(
                  'Working node label',
                  h.input
                    .attr('aria-label', 'Working node label')
                    .value(model.editor.graph.nodes.find((node) => node.id === 'a')?.label ?? '')
                    .disabled(
                      !!model.review ||
                        !!model.reading ||
                        !model.editor.graph.nodes.some((node) => node.id === 'a'),
                    )
                    .on('input', ({ value: label }) =>
                      observe({ type: 'NodeLabelChanged', id: 'a', label }),
                    ),
                ),
              ),
          ),
        ),
      h.div
        .class('workbench-canvas')
        .style({ minWidth: '0', height: '100%', position: 'relative' })
        .children(
          graphSurface(h, editor, {
            id,
            label: artifact
              ? 'Read-only artifact preview'
              : model.review
                ? 'Read-only edition preview'
                : 'Working history canvas',
            onInput: observe,
            architectureNotation: true,
            resizeHandles: true,
            resizeReadout: !model.minimal,
            onToggleGroup: (id) => observe({ type: 'GroupCollapseToggled', id }),
            wheelNavigation: 'zoom',
            pinchZoom: false,
            theme: workbenchThemes[scheme],
            worldOverlay:
              (model.review || artifact) && presentation
                ? historyGhostsV2<Message>(presentation)
                : null,
          }),
        ),
    );
  return h.div
    .class('flow-workbench history-workbench')
    .attr('data-flow-workbench-color-scheme', scheme)
    .style({ height: '100%', '--zloz-ui-height': '100%' })
    .children(layout());
}
