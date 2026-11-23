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
  zlozPlaybackControls,
  zlozView,
} from '@opsydyn/foldkit-zloz/foldkit';
import type { HtmlBuilder } from 'foldkit/html';

import { teamCanvasTheme } from '../appearance/canvas';
import { graphAt, type History } from './evolution';

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
  const changes = comparison
    ? [...comparison.nodes, ...comparison.edges].map((change) => {
        const label = (change.after ?? change.before)?.label || change.id;
        const detail =
          change.kind === 'changed'
            ? [change.semanticChanged ? 'content' : '', change.layoutChanged ? 'geometry' : '']
                .filter(Boolean)
                .join(' and ')
            : '';
        return h.li([], [`${label} · ${change.kind}${detail ? ` (${detail})` : ''}`]);
      })
    : [];
  return h.section(
    [h.Class('team-history'), h.AriaLabel('Board history')],
    [
      h.header(
        [h.Class('team-history-controls')],
        [
          h.button(
            [h.Id('history-back-live'), h.Type('button'), h.OnClick(actions.close)],
            ['Back to live'],
          ),
          h.strong([], [`Read-only · Version ${review.editionId}`]),
          h.span([], [`Live version ${latest}`]),
          zlozEditionScrubberInput(h, scrubber, ({ editionId }) =>
            actions.playback({ type: 'EditionSelected', id: editionId ?? '' }),
          ),
          h.label(
            [],
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
          zlozPlaybackControls(
            h,
            resolveEditionPlaybackControls(cursor, { editionLabel: `Version ${review.editionId}` }),
            actions.playback,
          ),
          ...(comparison
            ? [
                h.details(
                  [],
                  [
                    h.summary([], [`Changes from version ${baseline} (${changes.length})`]),
                    changes.length ? h.ul([], changes) : h.p([], ['No graph changes.']),
                  ],
                ),
              ]
            : []),
        ],
      ),
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
        renderWorldOverlay: (_context, builder) =>
          comparison ? zlozHistoryGhosts(builder, comparison) : null,
      }),
    ],
  );
}

export function navigateHistory(state: Review, event: EditorEvent): Review {
  const review = updateHistoryReview(state.review, event);
  return review === state.review ? state : { ...state, review };
}
