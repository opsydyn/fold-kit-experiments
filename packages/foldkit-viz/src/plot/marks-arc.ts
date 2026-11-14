import { arc, arcCentroid } from '../shape/arc.js';
import { fail, keysOf, numeric, paintOf, read, titlesOf, withTitle } from './channels.js';
import type { Context, Graphics } from './channels.js';
import type { ArcMark, Graphic, Row } from './types.js';

/**
 * The arc mark: a pie, donut or gauge filling its panel. Slices follow the
 * rows in order, each taking its share of the sweep from `start` to `end`.
 */

const DEG = Math.PI / 180;
const round = (n: number): number => Math.round(n * 100) / 100;

export function validateArc(mark: ArcMark, path: string): void {
  if (mark.inner !== undefined && !(mark.inner >= 0 && mark.inner < 1))
    fail(`${path}.inner`, 'must be in [0, 1)');
  const start = mark.start ?? 0,
    end = mark.end ?? start + 360;
  if (!(Number.isFinite(start) && Number.isFinite(end) && end > start))
    fail(`${path}.end`, 'must be after start');
  if (mark.padAngle !== undefined && !(mark.padAngle >= 0))
    fail(`${path}.padAngle`, 'must be zero or more');
}

export function arcGraphics(
  mark: ArcMark,
  rows: ReadonlyArray<Row>,
  path: string,
  index: number,
  context: Context,
): Graphics {
  const { bounds } = context;
  const values = read(rows, mark.value, `${path}.value`).map((v) => {
    const n = numeric(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = values.reduce((sum, v) => sum + v, 0);
  const cx = round(bounds.left + bounds.width / 2),
    cy = round(bounds.top + bounds.height / 2);
  const outer = Math.max(1, Math.min(bounds.width, bounds.height) / 2 - 4);
  const inner = outer * (mark.inner ?? 0);
  const start = (mark.start ?? 0) * DEG;
  const sweep = ((mark.end ?? (mark.start ?? 0) + 360) - (mark.start ?? 0)) * DEG;
  const pad = (mark.padAngle ?? 0) * DEG;
  const keys = keysOf(rows, mark, index);
  const titles = titlesOf(rows, mark.title, `${path}.title`);
  const fills = paintOf(rows, mark.fill, `${path}.fill`, context, 'currentColor');
  const strokes = paintOf(rows, mark.stroke, `${path}.stroke`, context, 'none');
  const opacity = mark.opacity ?? 1;
  const graphics: Graphic[] = [];
  let at = start;
  values.forEach((value, i) => {
    const angle = total > 0 ? (value / total) * sweep : 0;
    const config = {
      innerRadius: inner,
      outerRadius: outer,
      startAngle: at,
      endAngle: at + angle,
      padAngle: pad,
    };
    at += angle;
    if (angle <= 0) return;
    graphics.push({
      kind: 'path',
      key: keys[i] ?? `${index}:${i}`,
      d: arc(config),
      translate: [cx, cy],
      fill: fills[i] ?? 'currentColor',
      stroke: strokes[i] ?? 'none',
      strokeWidth: mark.strokeWidth ?? 1,
      opacity,
      ...withTitle(titles[i]),
    });
    // A share label where the slice has room for it.
    if (mark.labels === true && angle > 0.3) {
      const [lx, ly] = arcCentroid(config);
      graphics.push({
        kind: 'text',
        key: `${keys[i] ?? `${index}:${i}`}:label`,
        x: round(cx + lx),
        y: round(cy + ly + 4),
        text: `${Math.round((value / total) * 100)}%`,
        fill: '#ffffff',
        anchor: 'middle',
        opacity: 1,
      });
    }
  });
  const text =
    mark.text === undefined ? undefined : read(rows.slice(0, 1), mark.text, `${path}.text`)[0];
  if (text !== undefined && text !== null)
    graphics.push({
      kind: 'text',
      key: `${index}:centre`,
      x: cx,
      y: round(cy + 5),
      text: String(text),
      fill: 'currentColor',
      anchor: 'middle',
      opacity: 1,
    });
  return graphics;
}
