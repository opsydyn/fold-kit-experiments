import { randomLcg } from '@opsydyn/foldkit-viz/math/random';
import { line } from '@opsydyn/foldkit-viz/shape/line';

import type { Specimen } from './specimens';

export function portrait({ id, kind }: Specimen) {
  const random = randomLcg(Number.parseInt(id.slice(0, 8), 16));
  const effect = kind !== 'value';
  const fill = effect ? '#8ad9bf' : '#ffc688';
  const points = Array.from({ length: 24 }, (_, index) => {
    const angle = (index * Math.PI) / 12;
    const radius = 1 + 0.07 * Math.cos((kind === 'die' ? 8 : 3) * angle) + random() * 0.13;
    return [
      150 + Math.cos(angle) * radius * (effect ? 75 : 68),
      154 + Math.sin(angle) * radius * (effect ? 54 : 61),
    ] as const;
  });
  const body = line(points, { curve: 'catmullRomClosed', digits: 2 });
  const curve = (controlPoints: [number, number][]) =>
    line(controlPoints, { curve: 'basis', digits: 2 });
  const legs = Array.from({ length: 6 }, (_, index) => {
    const x = 91 + index * 24;
    const y = 207 + random() * 13;
    return curve([
      [x, 181],
      [x - 9, 201],
      [x + 5, y],
      [x - 5, y + 4],
    ]);
  });
  const antennae = effect ? [] : [115, 183].map((x) => ({ x, y: 56 + random() * 22 }));
  const spots = Array.from({ length: 11 }, () => ({
    x: 150 + (random() - 0.5) * 110,
    y: 162 + random() * 25,
    r: 1.4 + random() * 2.5,
  }));

  const loop =
    kind === 'never'
      ? curve([
          [131, 112],
          [95, 74],
          [105, 37],
          [145, 43],
          [169, 80],
          [199, 74],
          [205, 43],
          [174, 32],
          [148, 75],
          [162, 111],
        ])
      : null;
  const spikes =
    kind === 'die'
      ? Array.from({ length: 5 }, (_, i) =>
          [
            [92 + i * 23, 123],
            [86 + i * 25, 64 + Math.abs(i - 2) * 10],
            [116 + i * 20, 116],
          ]
            .map((point) => point.join(','))
            .join(' '),
        )
      : [];
  return {
    fill,
    body,
    legs,
    antennae: antennae.map(({ x, y }) => ({
      x,
      y,
      stem: curve([
        [x, 111],
        [x + 8, 88],
        [x, y],
      ]),
    })),
    spots,
    loop,
    spikes,
    eyes: effect ? [127, 172] : [150],
  };
}
