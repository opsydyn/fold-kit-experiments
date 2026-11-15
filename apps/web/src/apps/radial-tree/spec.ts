import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

const BRANCHES: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  ['Germanic', ['English', 'German', 'Dutch', 'Swedish']],
  ['Romance', ['Spanish', 'French', 'Italian', 'Romanian']],
  ['Slavic', ['Russian', 'Polish', 'Serbian']],
  ['Indo-Iranian', ['Hindi', 'Persian', 'Bengali']],
  ['Hellenic', ['Greek']],
  ['Celtic', ['Welsh', 'Irish']],
];

const languages: ReadonlyArray<Row> = BRANCHES.flatMap(([branch, members]) =>
  members.map((language) => ({ path: `Indo-European/${branch}/${language}`, branch })),
);

export const spec: PlotSpec = {
  width: 440,
  height: 360,
  title: 'Indo-European languages',
  description: 'Twenty Indo-European languages grouped by branch, as a radial cluster.',
  margins: { top: 4, right: 4, bottom: 4, left: 4 },
  data: languages,
  color: { legend: false },
  marks: [
    {
      mark: 'tree',
      path: 'path',
      layout: 'cluster',
      radial: true,
      fill: 'branch',
      stroke: { value: '#94a3b8' },
    },
  ],
};
