/** Size-first spiral placement references Jason Davies' d3-cloud:
 * https://github.com/jasondavies/d3-cloud/blob/master/index.js
 * Its Archimedean/rectangular spirals are retained; conservative rotated
 * measured rectangles replace canvas sprites. This is not pixel-mask parity.
 */
export type CloudSpiral = 'archimedean' | 'rectangular';
export type CloudAccessors<T> = Readonly<{
  key: (datum: T, index: number) => string;
  text: (datum: T, index: number) => string;
  width: (datum: T, index: number) => number;
  height: (datum: T, index: number) => number;
  rotation?: (datum: T, index: number) => number;
}>;
export type CloudConfig = Readonly<{
  width: number;
  height: number;
  padding?: number;
  spiral?: CloudSpiral;
  maxSteps?: number;
}>;
export type CloudBounds = Readonly<{ left: number; right: number; top: number; bottom: number }>;
export type CloudWord<T> = Readonly<{
  datum: T;
  key: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  bounds: CloudBounds;
}>;
export type WordCloud<T> = Readonly<{
  words: ReadonlyArray<CloudWord<T>>;
  omitted: ReadonlyArray<T>;
  width: number;
  height: number;
}>;

function spiralFor(config: CloudConfig): (step: number) => readonly [number, number] {
  const ratio = config.width / config.height;
  if (config.spiral !== 'rectangular')
    return (step) => {
      const t = step * 0.1;
      return [ratio * t * Math.cos(t), t * Math.sin(t)];
    };
  let x = 0,
    y = 0;
  return (step) => {
    if (step === 0) return [0, 0];
    switch ((Math.sqrt(1 + 4 * step) - 1) & 3) {
      case 0:
        x += 4 * ratio;
        break;
      case 1:
        y += 4;
        break;
      case 2:
        x -= 4 * ratio;
        break;
      default:
        y -= 4;
        break;
    }
    return [x, y];
  };
}

/** Text bounds must be measured using the same font/size as the SVG renderer.
 * Coordinates are centre anchors. Padding is included in returned bounds.
 * Omitted data is returned for callers to report or relayout at another size.
 */
export function wordCloud<T>(
  data: ReadonlyArray<T>,
  accessors: CloudAccessors<T>,
  config: CloudConfig,
): WordCloud<T> {
  const padding = config.padding ?? 2,
    maxSteps = config.maxSteps ?? 8000;
  if (
    ![config.width, config.height].every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(config.width / config.height)
  )
    throw new RangeError('Cloud dimensions must be finite and positive');
  if (!Number.isFinite(padding) || padding < 0)
    throw new RangeError('Cloud padding must be finite and non-negative');
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100000)
    throw new RangeError('Cloud maxSteps must be an integer in [1, 100000]');
  const keys = new Set<string>();
  const measured = data
    .map((datum, index) => {
      const key = accessors.key(datum, index),
        text = accessors.text(datum, index),
        width = accessors.width(datum, index),
        height = accessors.height(datum, index),
        rotation = accessors.rotation?.(datum, index) ?? 0;
      if (keys.has(key)) throw new RangeError(`Duplicate word key: ${key}`);
      keys.add(key);
      if (![width, height].every((v) => Number.isFinite(v) && v > 0) || !Number.isFinite(rotation))
        throw new RangeError('Word metrics must be finite with positive dimensions');
      const angle = (rotation * Math.PI) / 180;
      const boundWidth =
        Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)) + padding * 2;
      const boundHeight =
        Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)) + padding * 2;
      if (![boundWidth, boundHeight].every(Number.isFinite))
        throw new RangeError('Rotated word metrics overflow');
      return { datum, key, text, width, height, rotation, boundWidth, boundHeight };
    })
    .sort((a, b) => b.height - a.height || b.width - a.width);
  const words: CloudWord<T>[] = [],
    omitted: T[] = [];
  for (const word of measured) {
    let placed = false;
    if (word.text.trim() && word.boundWidth <= config.width && word.boundHeight <= config.height) {
      const spiral = spiralFor(config);
      for (let step = 0; step < maxSteps; step++) {
        const [dx, dy] = spiral(step),
          x = config.width / 2 + dx,
          y = config.height / 2 + dy;
        const bounds = {
          left: x - word.boundWidth / 2,
          right: x + word.boundWidth / 2,
          top: y - word.boundHeight / 2,
          bottom: y + word.boundHeight / 2,
        };
        if (
          bounds.left < 0 ||
          bounds.top < 0 ||
          bounds.right > config.width ||
          bounds.bottom > config.height
        )
          continue;
        if (
          words.some(
            (other) =>
              bounds.left < other.bounds.right &&
              bounds.right > other.bounds.left &&
              bounds.top < other.bounds.bottom &&
              bounds.bottom > other.bounds.top,
          )
        )
          continue;
        words.push({
          datum: word.datum,
          key: word.key,
          text: word.text,
          width: word.width,
          height: word.height,
          rotation: word.rotation,
          x,
          y,
          bounds,
        });
        placed = true;
        break;
      }
    }
    if (!placed) omitted.push(word.datum);
  }
  return { words, omitted, width: config.width, height: config.height };
}
