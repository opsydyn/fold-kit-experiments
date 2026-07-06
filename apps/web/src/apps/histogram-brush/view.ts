import type { Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import type { Message } from './message';
import { GotHistogramMessage, GotScatterMessage } from './message';
import type { Model } from './model';

const LABEL_STYLE = {
  fontSize: '0.75rem',
  color: 'var(--chart-label, #888)',
  marginBottom: '0.5rem',
  fontWeight: '600',
  display: 'block',
};

const STATUS_STYLE = {
  fontSize: '0.8rem',
  color: 'var(--chart-label, #888)',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap' as const,
};

export const view = (model: Model): Document => {
  const h = html<Message>();

  const brushDomain = Histogram.getBrushDomain(model.histogram);
  const filteredCount = model.scatter.points.length;
  const totalCount = model.allPoints.length;
  const hasBrush = brushDomain !== null;

  const histogram: Html = Histogram.view({
    model: model.histogram,
    toParentMessage: (msg) => GotHistogramMessage({ inner: msg }),
    ariaLabel: 'Histogram — response time distribution, drag to brush-filter',
  });

  const scatter: Html = Scatter.view({
    model: model.scatter,
    toParentMessage: (msg) => GotScatterMessage({ inner: msg }),
    ariaLabel: 'Scatter — response time vs error rate',
  });

  const rangeLabel = hasBrush
    ? `${Math.round(brushDomain[0])}ms – ${Math.round(brushDomain[1])}ms`
    : 'All requests';

  const countLabel = hasBrush ? `${filteredCount} of ${totalCount} points` : `${totalCount} points`;

  const clearButton = h.button(
    [
      h.Style({
        fontSize: '0.75rem',
        padding: '0.2rem 0.6rem',
        borderRadius: '4px',
        border: '1px solid var(--card-border, #1e1e33)',
        background: 'var(--card-bg, #12121f)',
        color: 'var(--page-text, #e8e8ff)',
        cursor: 'pointer',
        opacity: hasBrush ? '1' : '0.4',
        transition: 'opacity 120ms',
      }),
      h.OnClick(GotHistogramMessage({ inner: Histogram.ClearedHistogramBrush() })),
      h.Attribute('aria-label', 'Clear brush selection'),
    ],
    ['Clear'],
  );

  const statusBar = h.div(
    [h.Style(STATUS_STYLE)],
    [
      clearButton,
      h.span([], [rangeLabel]),
      h.span([h.Style({ color: hasBrush ? '#6366f1' : 'var(--chart-label, #888)' })], [countLabel]),
    ],
  );

  return {
    title: 'Histogram Brush Filter — foldkit-viz',
    body: h.div(
      [h.Style({ display: 'flex', flexDirection: 'column', gap: '0.75rem' })],
      [
        h.div(
          [h.Style({ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' })],
          [
            h.div(
              [h.Style({ flex: '1 1 380px' })],
              [
                h.span([h.Style(LABEL_STYLE)], ['Response time distribution — drag to filter']),
                histogram,
              ],
            ),
            h.div(
              [h.Style({ flex: '1 1 340px' })],
              [
                h.span(
                  [h.Style(LABEL_STYLE)],
                  [hasBrush ? 'Error rate — filtered range' : 'Error rate vs response time'],
                ),
                brushDomain !== null && filteredCount === 0
                  ? h.div(
                      [
                        h.Style({
                          height: '260px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--chart-label, #888)',
                          fontSize: '0.85rem',
                        }),
                      ],
                      ['No data in selected range'],
                    )
                  : scatter,
              ],
            ),
          ],
        ),
        statusBar,
      ],
    ),
  };
};
