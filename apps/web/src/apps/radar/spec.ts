import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const AXES = ['Performance', 'Expressiveness', 'Type Safety', 'Ecosystem', 'Dev Speed'];
const LANGUAGES = [
  { name: 'TypeScript', color: '#3b82f6', scores: [7, 8, 9, 9, 7] },
  { name: 'Rust', color: '#f97316', scores: [10, 6, 10, 6, 4] },
  { name: 'Python', color: '#22c55e', scores: [4, 10, 4, 10, 9] },
];

export const spec: PlotSpec = {
  width: 440,
  height: 320,
  title: 'Language comparison',
  description: 'Three languages scored out of ten on five qualities.',
  coordinates: 'polar',
  data: LANGUAGES.flatMap((l) =>
    l.scores.map((score, i) => ({
      language: l.name,
      quality: AXES[i] ?? '',
      score,
      label: `${l.name}, ${AXES[i] ?? ''}: ${score}`,
    })),
  ),
  x: { label: '', domain: AXES },
  y: { label: 'Score', domain: [0, 10], ticks: 5 },
  color: { domain: LANGUAGES.map((l) => l.name), range: LANGUAGES.map((l) => l.color) },
  marks: [
    { mark: 'area', x: 'quality', y: 'score', fill: 'language', opacity: 0.15 },
    { mark: 'line', x: 'quality', y: 'score', stroke: 'language', strokeWidth: 2 },
    { mark: 'dot', x: 'quality', y: 'score', fill: 'language', title: 'label' },
  ],
};
