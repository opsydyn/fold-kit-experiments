export const quickStart = `import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { line } from '@opsydyn/foldkit-viz/shape/line';

const values = [10, 45, 23, 88, 67];
const x = linear({ domain: [0, 4], range: [0, 400] });
const y = linear({ domain: [0, 100], range: [200, 0] });

const points = values.map(
  (value, index): readonly [number, number] => [x(index), y(value)],
);
const path = line(points, { curve: 'catmullRom' });
// Use path as the d attribute of an SVG <path>.
`;

export const astroExample = `---
import { linear } from '@opsydyn/foldkit-viz/math/scale';
import { line } from '@opsydyn/foldkit-viz/shape/line';

const values = [10, 45, 23, 88, 67];
const x = linear({ domain: [0, 4], range: [0, 400] });
const y = linear({ domain: [0, 100], range: [200, 0] });
const points = values.map(
  (value, index): readonly [number, number] => [x(index), y(value)],
);
const path = line(points, { curve: 'catmullRom' });
---
<svg viewBox="0 0 400 200" role="img" aria-label="Sample values">
  <path d={path ?? ''} fill="none" stroke="currentColor" stroke-width="2" />
</svg>`;
