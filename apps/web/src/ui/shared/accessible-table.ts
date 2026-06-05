import type { Html, html } from 'foldkit/html';

type H<M> = ReturnType<typeof html<M>>;

/**
 * CSS class applied to the wrapper — positions the element off-screen
 * so it is available to screen readers but invisible to sighted users.
 * Applied via inline style to avoid requiring a global stylesheet.
 */
const SR_ONLY_STYLE: Record<string, string> = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  'white-space': 'nowrap',
  border: '0',
};

/**
 * Render a screen-reader-only `<figure>` containing the SVG chart and a
 * visually-hidden `<table>` with the raw data.
 *
 * Screen readers can navigate the table cells to read each data point
 * without relying on visual SVG structure.
 *
 * @param h       - foldkit html DSL
 * @param chart   - the SVG chart element
 * @param caption - visible caption / chart title (maps to `<caption>`)
 * @param headers - column header strings (maps to `<th scope="col">`)
 * @param rows    - 2D array of cell values, each row matches headers
 */
export function withAccessibleTable<M>(
  h: H<M>,
  chart: Html,
  caption: string,
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string>>,
): Html {
  const tableEl = h.table(
    [h.Style(SR_ONLY_STYLE)],
    [
      h.caption([], [caption]),
      h.thead(
        [],
        [
          h.tr(
            [],
            headers.map((header) => h.th([h.Attribute('scope', 'col')], [header])),
          ),
        ],
      ),
      h.tbody(
        [],
        rows.map((row) =>
          h.tr(
            [],
            row.map((cell, ci) =>
              ci === 0 ? h.th([h.Attribute('scope', 'row')], [cell]) : h.td([], [cell]),
            ),
          ),
        ),
      ),
    ],
  );

  return h.figure([], [chart, tableEl]);
}

/**
 * Wrap any content in a screen-reader-only `<span>`.
 * Useful for status announcements that should be heard but not seen.
 */
export function srOnly<M>(h: H<M>, text: string): Html {
  return h.span([h.Style(SR_ONLY_STYLE)], [text]);
}
