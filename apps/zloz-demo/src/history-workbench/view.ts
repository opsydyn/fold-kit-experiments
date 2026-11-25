import {
  editionPlaybackReason,
  resolveHistoryChangeNavigatorV2,
  resolveHistoryComparisonPresentationV2,
} from '@opsydyn/foldkit-zloz';
import type { EditorEvent } from '@opsydyn/foldkit-zloz';
import {
  zlozView,
  zlozHistoryComparisonPresentationV2,
  zlozHistoryGhostsV2,
  zlozHistoryChangeNavigatorV2,
  type ZlozViewLayoutParts,
} from '@opsydyn/foldkit-zloz/foldkit';
import { Schema } from 'effect';
import type { Document, Html, HtmlBuilder } from 'foldkit/html';

import { workbenchThemes } from '../editor/theme';
import { Side, Theme } from './message';
import { nativeView } from './native-view';
import { Message, targetFor, type Model } from './state';

export function view(model: Model, h: HtmlBuilder<Message>): Document {
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
  const button = (text: string, message: Message, disabled = false): Html =>
    h.button([h.Type('button'), h.OnClick(message), h.Disabled(disabled)], [text]);
  const field = (label: string, input: Html): Html =>
    h.label([h.Class('workbench-field')], [label, input]);
  const choice = (label: string, value: string, select: (id: string) => Message): Html =>
    field(
      label,
      h.select(
        [
          h.AriaLabel(label),
          h.Value(value),
          h.Disabled(model.reading !== null),
          h.OnChange(select),
        ],
        model.editions.map((item) =>
          h.option(
            [h.Value(item.id), h.Selected(value === item.id)],
            [`${item.name} · ${item.snapshot.connectionMode}`],
          ),
        ),
      ),
    );
  const playbackReason = !model.visible
    ? 'Playback pauses while this page is hidden.'
    : editionPlaybackReason(model.playback.cursor);
  const layout = (parts: ZlozViewLayoutParts): Html =>
    h.div(
      [h.Class('workbench-layout')],
      [
        h.aside(
          [h.Class('workbench-sidebar'), h.AriaLabel('V2 history controls')],
          [
            h.a([h.Class('workbench-skip'), h.Href('#' + parts.canvasId)], ['Skip to canvas']),
            h.div(
              [h.Class('workbench-sidebar-heading')],
              [h.h1([], ['Architecture through time'])],
            ),
            h.div(
              [h.Class('workbench-sections'), h.AriaLabel('History sections')],
              (['files', 'review', 'playback', 'restore', 'authoring', 'evidence'] as const).map(
                (section) =>
                  h.button(
                    [
                      h.Type('button'),
                      h.AriaPressed(String(model.section === section)),
                      h.OnClick(Message.SelectedSection({ section })),
                    ],
                    [
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
                    ],
                  ),
              ),
            ),
            h.div(
              [h.Class('workbench-sidebar-scroll')],
              [
                h.details([], [h.summary([], ['Canvas help']), parts.help]),
                h.p(
                  [],
                  ['Mixed-mode editions. Independent working and read-only review sessions.'],
                ),
                h.p(
                  [h.Role('status'), h.AriaLive('polite'), h.AriaLabel('History workflow status')],
                  [model.notice],
                ),
                h.p(
                  [h.AriaLabel('Working connection mode')],
                  [`Working mode: ${model.editor.connectionMode ?? 'strict'}`],
                ),
                ...(model.review
                  ? [
                      h.p(
                        [h.AriaLabel('Review connection mode')],
                        [`Review mode: ${model.review.editor.connectionMode}`],
                      ),
                    ]
                  : []),
                field(
                  'Theme',
                  h.select(
                    [
                      h.AriaLabel('Theme'),
                      h.Value(model.theme),
                      h.OnChange((value) =>
                        Message.SelectedTheme({ theme: Schema.decodeUnknownSync(Theme)(value) }),
                      ),
                    ],
                    ['system', 'light', 'dark'].map((value) =>
                      h.option([h.Value(value), h.Selected(model.theme === value)], [value]),
                    ),
                  ),
                ),
                field(
                  'Minimal mode',
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(model.minimal),
                    h.OnClick(Message.ClickedMinimal()),
                  ]),
                ),
                field(
                  'Show minimap',
                  h.input([
                    h.Type('checkbox'),
                    h.Checked(model.minimap),
                    h.OnClick(Message.ClickedMinimap()),
                  ]),
                ),
                ...(parts.controls ? [parts.controls] : []),
                ...(parts.minimap ? [parts.minimap] : []),
                ...(model.section === 'authoring' || model.section === 'evidence'
                  ? [nativeView(model, h)]
                  : []),
                h.div(
                  [h.Hidden(model.section !== 'files')],
                  [
                    h.h2([], ['Capture and portable files']),
                    field(
                      'Edition name',
                      h.input([
                        h.AriaLabel('Edition name'),
                        h.Value(model.name),
                        h.OnInput((name) => Message.ChangedName({ name })),
                      ]),
                    ),
                    button(
                      'Capture working edition',
                      Message.ClickedCapture(),
                      !!model.reading || !model.name.trim(),
                    ),
                    h.div(
                      [h.Class('workbench-actions')],
                      [
                        button('Download v2 model', Message.ClickedDownload({ kind: 'model' })),
                        button(
                          'Download v2 editions',
                          Message.ClickedDownload({ kind: 'archive' }),
                        ),
                      ],
                    ),
                    field(
                      'Open v2 model',
                      h.input([
                        h.Type('file'),
                        h.Key(`file-${model.sequence}`),
                        h.Accept('.json,application/json'),
                        h.Disabled(!!model.reading),
                        h.AriaLabel('Open v2 model'),
                        h.OnFileChange((files) => Message.ChoseFile({ kind: 'model', files })),
                      ]),
                    ),
                    field(
                      'Merge v2 editions',
                      h.input([
                        h.Type('file'),
                        h.Key(`file-${model.sequence}`),
                        h.Accept('.json,application/json'),
                        h.Disabled(!!model.reading),
                        h.AriaLabel('Merge v2 editions'),
                        h.OnFileChange((files) => Message.ChoseFile({ kind: 'archive', files })),
                      ]),
                    ),
                    ...(model.reading
                      ? [button('Cancel import', Message.ClickedCancelRead())]
                      : []),
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
                          h.div(
                            [h.AriaLabel('Edition import conflict')],
                            [
                              h.p([], ['Import blocked; no editions were replaced.']),
                              zlozHistoryComparisonPresentationV2(
                                h,
                                resolveHistoryComparisonPresentationV2(
                                  model.conflict.existing,
                                  model.conflict.proposed,
                                ),
                              ),
                            ],
                          ),
                        ]
                      : []),
                    h.details(
                      [],
                      [
                        h.summary([], ['File compatibility']),
                        h.p(
                          [],
                          [
                            'V2 files retain connection modes. Imports use UTF-8 and a 5 MiB limit. The architecture workbench keeps its existing strict-only Mermaid, patch and receipt contracts; incompatible files are rejected, never automatically downgraded.',
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Hidden(model.section !== 'review')],
                  [
                    h.h2([], ['Review and compare']),
                    choice('Selected edition', model.selectedId, (id) =>
                      Message.SelectedEdition({ id }),
                    ),
                    choice('Baseline edition', model.baselineId, (id) =>
                      Message.SelectedBaseline({ id }),
                    ),
                    field(
                      'Comparison side',
                      h.select(
                        [
                          h.AriaLabel('Comparison side'),
                          h.Value(model.side),
                          h.Disabled(!!model.reading),
                          h.OnChange((side) =>
                            Message.SelectedSide({ side: Schema.decodeUnknownSync(Side)(side) }),
                          ),
                        ],
                        ['baseline', 'selected'].map((side) =>
                          h.option([h.Value(side), h.Selected(model.side === side)], [side]),
                        ),
                      ),
                    ),
                    button(
                      'Review chosen edition',
                      Message.ClickedReview(),
                      !!model.reading || !targetFor(model),
                    ),
                    button('Return to working model', Message.ClickedPresent(), !model.review),
                    ...(model.review && presentation
                      ? [zlozHistoryComparisonPresentationV2(h, presentation)]
                      : []),
                    ...(['enabled', 'nodes', 'edges', 'movements'] as const).map((part) =>
                      field(
                        part === 'enabled' ? 'Show comparison ghosts' : `${part} ghosts`,
                        h.input([
                          h.Type('checkbox'),
                          h.Checked(model.ghosts[part]),
                          h.OnClick(Message.ClickedGhost({ part })),
                        ]),
                      ),
                    ),
                    zlozHistoryChangeNavigatorV2(
                      h,
                      navigation,
                      {
                        onFilter: (kind) => Message.ClickedFilter({ kind }),
                        onFocus: (request) => Message.ClickedChange({ request }),
                      },
                      model.minimal
                        ? { attributes: [h.Class('history-changes')], renderStatus: () => null }
                        : { attributes: [h.Class('history-changes')] },
                    ),
                    h.div(
                      [h.Class('workbench-actions')],
                      [
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
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Hidden(model.section !== 'playback')],
                  [
                    h.h2([], ['Playback']),
                    h.p(
                      [
                        h.Role('status'),
                        h.AriaLive('polite'),
                        h.AriaLabel('Edition playback state'),
                      ],
                      [`Playback: ${model.playback.cursor.status}`],
                    ),
                    h.p(
                      [h.AriaLabel('Playback availability')],
                      [
                        playbackReason ??
                          'Automatic playback is opt-in. Inspection never changes the working model.',
                      ],
                    ),
                    h.div(
                      [h.Class('workbench-actions')],
                      [
                        button(
                          'Play editions',
                          Message.ClickedTransport({ action: 'PlayClicked' }),
                          !!model.reading ||
                            playbackReason !== null ||
                            model.playback.cursor.status === 'playing',
                        ),
                        button(
                          'Pause playback',
                          Message.ClickedTransport({ action: 'PauseClicked' }),
                        ),
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
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Hidden(model.section !== 'restore')],
                  [
                    h.h2([], ['Guarded restore']),
                    field(
                      'Protect edition restore',
                      h.input([
                        h.Type('checkbox'),
                        h.Checked(model.protectedRestore),
                        h.OnClick(Message.ClickedProtection()),
                      ]),
                    ),
                    button(
                      'Preview restore',
                      Message.ClickedRestorePreview(),
                      !model.review || !!model.reading || !targetFor(model),
                    ),
                    ...(model.preview
                      ? [
                          h.p(
                            [],
                            [
                              `Restore ${model.preview.edition.name} · ${model.preview.edition.snapshot.connectionMode}. One Undo restores the previous graph and mode.`,
                            ],
                          ),
                          button(
                            'Confirm restore',
                            Message.ClickedRestoreConfirm(),
                            model.protectedRestore || !!model.reading,
                          ),
                          button('Cancel restore', Message.ClickedRestoreCancel()),
                        ]
                      : []),
                    h.div(
                      [h.Class('workbench-actions')],
                      [
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
                      ],
                    ),
                    field(
                      'Working node label',
                      h.input([
                        h.AriaLabel('Working node label'),
                        h.Value(
                          model.editor.graph.nodes.find((node) => node.id === 'a')?.label ?? '',
                        ),
                        h.Disabled(
                          !!model.review ||
                            !!model.reading ||
                            !model.editor.graph.nodes.some((node) => node.id === 'a'),
                        ),
                        h.OnInput((label) => observe({ type: 'NodeLabelChanged', id: 'a', label })),
                      ]),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        h.div(
          [
            h.Class('workbench-canvas'),
            h.Style({ 'min-width': '0', height: '100%', position: 'relative' }),
          ],
          [parts.canvas],
        ),
      ],
    );
  return {
    title: 'History workbench | ZLOZ',
    body: h.div(
      [
        h.Class('history-workbench'),
        h.DataAttribute('flow-workbench-color-scheme', scheme),
        h.Style({ height: '100%' }),
      ],
      [
        zlozView(h, editor, {
          id: `history-v2-${model.epoch}`,
          label: artifact
            ? 'Read-only artifact preview'
            : model.review
              ? 'Read-only edition preview'
              : 'Working history canvas',
          onEvent: observe,
          height: 'fill',
          theme: workbenchThemes[scheme],
          minimalMode: model.minimal,
          minimap: model.minimap,
          renderLayout: layout,
          renderCanvasHelp: (context, builder) =>
            builder.p(
              [],
              [
                context.readOnly
                  ? 'Read-only checkpoint. Drag the background to pan and scroll to zoom. Select a change to reveal it on the chosen side. Working edits and Undo remain independent.'
                  : context.defaultText,
              ],
            ),
          renderWorldOverlay: (_context, builder) =>
            (model.review || artifact) && presentation
              ? zlozHistoryGhostsV2(builder, presentation)
              : null,
        }),
      ],
    ),
  };
}
