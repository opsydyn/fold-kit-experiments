import {
  compareEditions,
  createEditionPlayback,
  createHistoryReview,
  playbackEditionId,
  resolveEditionPlaybackControls,
  resolveEditionScrubber,
  updateEditionPlayback,
  updateHistoryReview,
  type EditorEvent,
  type EditorState,
  type ZlozEditionPlayback,
  type ZlozHistoryReview,
  type ZlozEditionPlaybackEvent,
  type ZlozHistoryComparison,
} from '@opsydyn/foldkit-zloz';
import {
  zlozEditionScrubberInput,
  zlozHistoryGhosts,
  zlozPlaybackControl,
  zlozPlaybackControls,
  zlozView,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { teamCanvasTheme } from '../appearance/canvas';
import { graphAt, type History } from './evolution';
import { workshopChangeLabel, workshopGhost } from './workshop-ghost';

function editionAt(history: History, id: string) {
  const graph = graphAt(history, Number(id));
  return graph ? { id, name: `Version ${id}`, snapshot: { graph } } : null;
}

export type Review = Readonly<{
  history: History;
  review: ZlozHistoryReview;
  cursor: ZlozEditionPlayback;
  comparison: ZlozHistoryComparison | null;
}>;

export function openHistory(
  history: History,
  version: number,
  live: EditorState,
  reducedMotion: boolean,
): Review | null {
  const edition = editionAt(history, String(version));
  if (!edition) return null;
  const cursor = createEditionPlayback(
    history.samples.map((sample) => String(sample.version)),
    {
      reducedMotion,
    },
  );
  return {
    history,
    review: createHistoryReview(edition, live),
    cursor: updateEditionPlayback(cursor, { type: 'EditionSelected', id: edition.id }),
    comparison: null,
  };
}

export function advanceHistory(state: Review, event: ZlozEditionPlaybackEvent): Review {
  if (
    event.type === 'EditionSelected' &&
    !state.history.samples.some(({ version }) => String(version) === event.id)
  )
    return state;
  const cursor = updateEditionPlayback(state.cursor, event);
  const id = playbackEditionId(cursor);
  const edition = id && id !== state.review.editionId ? editionAt(state.history, id) : null;
  if (!edition) return cursor === state.cursor ? state : { ...state, cursor };
  return {
    ...state,
    cursor,
    review: createHistoryReview(edition, state.review.editor),
    comparison: state.comparison ? compareEditions(state.comparison.baseline, edition) : null,
  };
}

export function chooseBaseline(state: Review, id: string): Review {
  const prior = id ? editionAt(state.history, id) : null;
  if (id && !prior) return state;
  const selected = editionAt(state.history, state.review.editionId);
  const comparison = prior && selected ? compareEditions(prior, selected) : null;
  return { ...state, comparison };
}

export function historyView<M>(
  h: HtmlBuilder<M>,
  state: Review,
  latest: number,
  actions: {
    close: M;
    playback: (event: ZlozEditionPlaybackEvent) => M;
    baseline: (id: string) => M;
    navigate: (event: EditorEvent) => M;
  },
) {
  const { cursor, history, review, comparison } = state;
  const baseline = comparison?.baseline.id ?? '';
  const scrubber = resolveEditionScrubber(cursor, {
    label: 'Review version',
    labelEdition: (id) => `Version ${id}`,
  });
  const changeRow = (
    change: ZlozHistoryComparison['nodes'][number] | ZlozHistoryComparison['edges'][number],
    workshopLabel?: string,
  ) => {
    const label = (change.after ?? change.before)?.label || change.id;
    const detail =
      change.kind === 'changed'
        ? [change.semanticChanged ? 'content' : '', change.layoutChanged ? 'geometry' : '']
            .filter(Boolean)
            .join(' and ')
        : '';
    const summary = workshopLabel ?? `${change.kind}${detail ? ` (${detail})` : ''}`;
    return h.li([], [`${label} · ${summary}`]);
  };
  const changes = comparison
    ? [
        ...comparison.nodes.map((change) => changeRow(change, workshopChangeLabel(change))),
        ...comparison.edges.map((change) => changeRow(change)),
      ]
    : [];
  return h.section(
    [h.Class('team-history'), h.AriaLabel('Board history')],
    [
      zlozView(h, review.editor, {
        id: 'history-diagram',
        label: 'Historical diagram',
        height: 'fill',
        theme: teamCanvasTheme,
        onEvent: actions.navigate,
        contextActions: false,
        nodeToolbar: false,
        edgeToolbar: false,
        viewportControls: true,
        autoPan: false,
        renderCanvasHelp: (_context, builder) =>
          builder.span(
            [],
            ['Drag the background to pan. Scroll to zoom. Use the timeline to review a version.'],
          ),
        renderLayout: ({ canvas, help, controls, status, connections }, builder) =>
          builder.div(
            [builder.Class('rewind-canvas')],
            [
              canvas,
              builder.details(
                [builder.Class('rewind-navigation')],
                [
                  builder.summary([], ['Canvas controls']),
                  ...(controls ? [controls] : []),
                  help,
                  builder.details([], [builder.summary([], ['Relationships']), connections]),
                ],
              ),
              status,
            ],
          ),
        renderWorldOverlay: (_context, builder) =>
          comparison ? zlozHistoryGhosts(builder, comparison, { renderNode: workshopGhost }) : null,
      }),
      h.footer(
        [h.Class('team-history-controls'), h.AriaLabel('Rewind transport')],
        [
          h.div(
            [h.Class('rewind-readouts')],
            [
              h.strong([], [`Read-only · Version ${review.editionId}`]),
              h.span([], [`Live version ${latest}`]),
              h.button(
                [h.Id('history-back-live'), h.Type('button'), h.OnClick(actions.close)],
                ['Back to live'],
              ),
            ],
          ),
          h.div(
            [h.Class('rewind-deck')],
            [
              zlozPlaybackControls(h, resolveEditionPlaybackControls(cursor), actions.playback, {
                controls: ['rewind', 'previous', 'play', 'pause', 'next'],
                attributes: [h.Class('rewind-keys')],
                renderControl: (control, builder, onEvent) =>
                  zlozPlaybackControl(
                    builder,
                    control,
                    onEvent,
                    control.reason === null ? [builder.Title(control.label)] : [],
                    [
                      builder.span(
                        [builder.AriaHidden(true)],
                        [
                          { previous: '│◀', play: '▶', pause: 'Ⅱ', next: '▶│', rewind: '◀◀' }[
                            control.name
                          ],
                        ],
                      ),
                    ],
                  ),
                renderReason: () => null,
              }),
              h.div(
                [
                  h.Class('rewind-scale'),
                  h.Style({
                    '--rewind-intervals': String(Math.max(1, history.samples.length - 1)),
                  }),
                ],
                [
                  zlozEditionScrubberInput(h, scrubber, ({ editionId }) =>
                    actions.playback({ type: 'EditionSelected', id: editionId ?? '' }),
                  ),
                  h.div(
                    [h.Class('rewind-range')],
                    [
                      history.samples.length === 1
                        ? 'Only one version in this session window'
                        : `Session window · Versions ${history.samples[0]?.version}–${history.samples.at(-1)?.version}`,
                    ],
                  ),
                ],
              ),
              ...(history.samples.length > 1
                ? [
                    h.label(
                      [h.Class('rewind-compare')],
                      [
                        'Compare with',
                        h.select(
                          [h.Value(baseline), h.OnChange(actions.baseline)],
                          [
                            h.option([h.Value('')], ['No comparison']),
                            ...history.samples.map(({ version }) =>
                              h.option(
                                [h.Key(String(version)), h.Value(String(version))],
                                [`Version ${version}`],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ]
                : []),
            ],
          ),
          ...(cursor.reducedMotion && history.samples.length > 1
            ? [h.small([], ['Reduced motion · Step or scrub manually.'])]
            : []),
          ...(comparison
            ? [
                h.div(
                  [h.Class('rewind-changes')],
                  [
                    h.button(
                      [h.Type('button'), h.Popovertarget('history-diff')],
                      [`Changes from version ${baseline} (${changes.length})`],
                    ),
                    h.div(
                      [
                        h.Id('history-diff'),
                        h.Popover('auto'),
                        h.Class('rewind-diff'),
                        h.Role('region'),
                        h.AriaLabel('Version differences'),
                      ],
                      [changes.length ? h.ul([], changes) : h.p([], ['No graph changes.'])],
                    ),
                  ],
                ),
              ]
            : []),
        ],
      ),
    ],
  );
}

export function navigateHistory(state: Review, event: EditorEvent): Review {
  const review = updateHistoryReview(state.review, event);
  return review === state.review ? state : { ...state, review };
}
