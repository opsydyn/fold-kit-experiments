export type TextLayout = Readonly<{
  lines: ReadonlyArray<string>;
  widths: ReadonlyArray<number>;
  overflow: boolean;
}>;
export type TextLayoutConfig = Readonly<{ width: number; maxLines?: number }>;

/** Greedy wrapping with caller-supplied font measurement. Preserves explicit
 * newlines, collapses intra-line whitespace and breaks long words on graphemes.
 * Overflow means omitted lines or a single grapheme wider than the budget.
 */
export function wrapText(
  text: string,
  measure: (text: string) => number,
  config: TextLayoutConfig,
): TextLayout {
  if (!Number.isFinite(config.width) || config.width <= 0)
    throw new RangeError('Text width must be finite and positive');
  const maxLines = config.maxLines ?? Infinity;
  if (maxLines !== Infinity && (!Number.isInteger(maxLines) || maxLines < 1))
    throw new RangeError('maxLines must be a positive integer');
  const widthOf = (value: string): number => {
    const width = measure(value);
    if (!Number.isFinite(width) || width < 0)
      throw new RangeError('Measured text width must be finite and non-negative');
    return width;
  };
  const lines: string[] = [];
  let overflow = false;
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  if (text.length > 0)
    for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
      let line = '';
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (widthOf(candidate) <= config.width) {
          line = candidate;
          continue;
        }
        if (line) {
          lines.push(line);
          line = '';
        }
        for (const { segment } of segmenter.segment(word)) {
          if (line && widthOf(line + segment) > config.width) {
            lines.push(line);
            line = '';
          }
          if (widthOf(segment) > config.width) overflow = true;
          line += segment;
        }
      }
      lines.push(line);
    }
  if (lines.length > maxLines) overflow = true;
  const visible = lines.slice(0, maxLines);
  return { lines: visible, widths: visible.map(widthOf), overflow };
}
