import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';

const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
const frameworks = [
  { name: 'React', color: '#61dafb', ranks: [1, 1, 1, 1, 1, 1] },
  { name: 'Vue', color: '#42b883', ranks: [3, 2, 2, 3, 3, 3] },
  { name: 'Angular', color: '#dd0031', ranks: [2, 3, 3, 2, 2, 2] },
  { name: 'Svelte', color: '#ff3e00', ranks: [6, 5, 4, 4, 4, 4] },
  { name: 'Solid', color: '#2c4f7c', ranks: [8, 8, 7, 5, 5, 5] },
  { name: 'Qwik', color: '#ac7ef4', ranks: [9, 9, 9, 8, 6, 6] },
  { name: 'Astro', color: '#ff5d01', ranks: [7, 7, 6, 6, 7, 7] },
  { name: 'Lit', color: '#324fff', ranks: [4, 4, 5, 7, 8, 8] },
];

export const spec: PlotSpec = {
  width: 440,
  height: 300,
  title: 'Framework rankings',
  description: 'Each framework’s rank from 2019 to 2024, with first place at the top.',
  data: frameworks.flatMap((f) =>
    f.ranks.map((rank, i) => ({ framework: f.name, year: years[i] ?? '', rank })),
  ),
  x: { label: '' },
  y: { label: 'Rank', domain: [9.5, 0.5], ticks: 9, grid: false },
  color: { domain: frameworks.map((f) => f.name), range: frameworks.map((f) => f.color) },
  marks: [
    {
      mark: 'line',
      x: 'year',
      y: 'rank',
      stroke: 'framework',
      strokeWidth: 2.5,
      curve: 'monotoneX',
    },
    { mark: 'dot', x: 'year', y: 'rank', fill: 'framework', r: { value: 4 }, title: 'framework' },
  ],
};
