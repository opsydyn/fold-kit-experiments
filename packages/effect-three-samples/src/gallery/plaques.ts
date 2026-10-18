/** What hangs on the gallery wall: where, and what it says. */
import type { Plaque } from './model';

/** The code plaque shows the call that draws it. */
export const code = `label({
  key: 'code',
  text: code,
  colorRanges: highlight(code),
  material: lit ? standard() : null,
})`;

export const plaques: ReadonlyArray<Plaque> = [
  {
    id: 'data',
    degrees: -46,
    text: 'Scenes are data.\nThe Model describes this room; effect-three keeps three.js in step with it.',
    fontSize: 0.17,
    maxWidth: 2,
  },
  { id: 'code', degrees: -17, text: code, fontSize: 0.18, maxWidth: 3.6 },
  {
    id: 'labels',
    degrees: 17,
    text: 'Labels are data too.\nColour runs, curves and lit materials are fields; layouts come back as Messages.',
    fontSize: 0.17,
    maxWidth: 2,
  },
];

/** The visitor's note hangs here. */
export const noteDegrees = 45;
