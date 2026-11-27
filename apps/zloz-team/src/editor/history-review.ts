import { Html } from '@effect/ui/html';
import {
  compareEditions,
  editionScrubberRequest,
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
  type ZlozEditionScrubberContext,
  type ZlozHistoryReview,
  type ZlozEditionPlaybackEvent,
  type ZlozHistoryComparison,
} from '@opsydyn/foldkit-zloz';
import {
  graphSurface,
  historyGhosts,
  resolveConnectionList,
  viewportControl,
  viewportControlActions,
} from '@opsydyn/foldkit-zloz/effect-ui';

import { teamCanvasTheme } from '../appearance/canvas';
import { graphAt, type History } from './evolution';
import { createConnectionsView } from './native-connections';
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
  h: Html.H<M>,
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
    return h.li.children(`${label} · ${summary}`);
  };
  const changes = comparison
    ? [
        ...comparison.nodes.map((change) => changeRow(change, workshopChangeLabel(change))),
        ...comparison.edges.map((change) => changeRow(change)),
      ]
    : [];
  return h.section
    .class('team-history')
    .attr('aria-label', 'Board history')
    .children(
      historyCanvas(h, state, actions.navigate),
      h.footer
        .class('team-history-controls')
        .attr('aria-label', 'Rewind transport')
        .children(
          h.div
            .class('rewind-readouts')
            .children(
              h.strong.children(`Read-only · Version ${review.editionId}`),
              h.span.children(`Live version ${latest}`),
              h.button
                .id('history-back-live')
                .attr('type', 'button')
                .on('click', actions.close)
                .children('Back to live'),
            ),
          h.div.class('rewind-deck').children(
            playbackKeys(h, cursor, actions.playback),
            h.div
              .class('rewind-scale')
              .style({
                '--rewind-intervals': String(Math.max(1, history.samples.length - 1)),
              })
              .children(
                scrubberInput(h, scrubber, actions.playback),
                h.div
                  .class('rewind-range')
                  .children(
                    history.samples.length === 1
                      ? 'Only one version in this session window'
                      : `Session window · Versions ${history.samples[0]?.version}–${history.samples.at(-1)?.version}`,
                  ),
              ),
            ...(history.samples.length > 1
              ? [
                  h.label.class('rewind-compare').children(
                    'Compare with',
                    h.select
                      .value(baseline)
                      .on('change', ({ value }) => actions.baseline(value))
                      .children(
                        h.option.attr('value', '').children('No comparison'),
                        ...history.samples.map(({ version }) =>
                          h.option
                            .key(String(version))
                            .attr('value', String(version))
                            .children(`Version ${version}`),
                        ),
                      ),
                  ),
                ]
              : []),
          ),
          ...(cursor.reducedMotion && history.samples.length > 1
            ? [h.small.children('Reduced motion · Step or scrub manually.')]
            : []),
          ...(comparison
            ? [
                h.div.class('rewind-changes').children(
                  h.button
                    .attr('type', 'button')
                    .attr('popovertarget', 'history-diff')
                    .children(`Changes from version ${baseline} (${changes.length})`),
                  h.div
                    .id('history-diff')
                    .attr('popover', 'auto')
                    .class('rewind-diff')
                    .attr('role', 'region')
                    .attr('aria-label', 'Version differences')
                    .children(
                      changes.length ? h.ul.children(changes) : h.p.children('No graph changes.'),
                    ),
                ),
              ]
            : []),
        ),
    );
}

export function navigateHistory(state: Review, event: EditorEvent): Review {
  const review = updateHistoryReview(state.review, event);
  return review === state.review ? state : { ...state, review };
}

const playbackSymbols = [
  ['rewind', '◀◀'],
  ['previous', '│◀'],
  ['play', '▶'],
  ['pause', 'Ⅱ'],
  ['next', '▶│'],
] as const;
function playbackKeys<M>(
  h: Html.H<M>,
  cursor: ZlozEditionPlayback,
  send: (event: ZlozEditionPlaybackEvent) => M,
) {
  const controls = resolveEditionPlaybackControls(cursor);
  return h.div
    .class('rewind-keys')
    .attrs({ role: 'group', 'aria-label': 'Playback controls' })
    .children(
      ...playbackSymbols.map(([name, symbol]) => {
        const control = controls.actions[name];
        return h.button
          .key(name)
          .attrs({
            type: 'button',
            'aria-label': control.label,
            title: control.reason ?? control.label,
          })
          .disabled(control.disabled)
          .on('click', send(control.event))
          .children(h.span.attr('aria-hidden', 'true').children(symbol));
      }),
    );
}
function scrubberInput<M>(
  h: Html.H<M>,
  context: ZlozEditionScrubberContext,
  send: (event: ZlozEditionPlaybackEvent) => M,
) {
  return h.input
    .attrs({
      type: 'range',
      min: '0',
      max: String(Math.max(0, context.entries.length - 1)),
      step: '1',
      'aria-label': context.label,
      'aria-valuetext': context.valueText,
      title: context.rangeReason ?? undefined,
    })
    .value(String(context.current?.index ?? 0))
    .disabled(context.rangeReason !== null)
    .on('input', ({ value }) => {
      const { editionId } = editionScrubberRequest(context, value);
      return editionId === null ? undefined : send({ type: 'EditionSelected', id: editionId });
    });
}
function historyCanvas<M>(h: Html.H<M>, state: Review, send: (event: EditorEvent) => M) {
  const editor = state.review.editor;
  const controls = viewportControlActions(editor);
  const connections = resolveConnectionList(editor, editor.graph.edges, {
    id: 'history-diagram',
    compact: false,
    contextActions: false,
    toolbarEdgeId: undefined,
  });
  return h.div.class('rewind-canvas').children(
    graphSurface(h, editor, {
      id: 'history-diagram',
      label: 'Historical diagram',
      descriptionId: 'history-canvas-help',
      onInput: send,
      theme: teamCanvasTheme,
      wheelNavigation: 'zoom',
      worldOverlay: state.comparison
        ? historyGhosts(
            state.comparison,
            { enabled: true, nodes: true, edges: true, movements: true },
            'selected',
            { renderNode: (change) => workshopGhost(change, h) },
          )
        : null,
    }),
    h.details
      .class('rewind-navigation')
      .children(
        h.summary.children('Canvas controls'),
        ...[controls.zoomIn, controls.zoomOut, controls.fitView].map((action) =>
          viewportControl(h, action, send).children(action.label),
        ),
        h.span
          .id('history-canvas-help')
          .children(
            'Drag the background to pan. Scroll to zoom. Use the timeline to review a version.',
          ),
        h.details.children(
          h.summary.children('Relationships'),
          createConnectionsView((id) => send({ type: 'EdgeSelected', id, additive: false }))(
            connections,
            h,
          ),
        ),
      ),
  );
}
