import type { PlotSpec, Row } from '@opsydyn/foldkit-viz/plot';

const FAMILIES = [
  {
    name: 'Systems',
    color: '#f97316',
    languages: [
      ['C', 18],
      ['C++', 15],
      ['Go', 12],
      ['Rust', 8],
      ['Zig', 3],
    ],
  },
  {
    name: 'General',
    color: '#14b8a6',
    languages: [
      ['Python', 28],
      ['Java', 20],
      ['C#', 16],
      ['Kotlin', 9],
      ['Swift', 8],
    ],
  },
  {
    name: 'Web',
    color: '#3b82f6',
    languages: [
      ['JS', 30],
      ['TS', 22],
      ['PHP', 10],
      ['Ruby', 8],
    ],
  },
  {
    name: 'Functional',
    color: '#8b5cf6',
    languages: [
      ['Elixir', 6],
      ['Erlang', 5],
      ['Haskell', 4],
      ['OCaml', 3],
      ['F#', 3],
    ],
  },
  {
    name: 'Query',
    color: '#ec4899',
    languages: [
      ['SQL', 25],
      ['GraphQL', 8],
      ['HQL', 4],
    ],
  },
] as const;

const leaves: ReadonlyArray<Row> = FAMILIES.flatMap((f) =>
  f.languages.map(([language, usage]) => ({
    path: `${f.name}/${language}`,
    family: f.name,
    usage,
  })),
);

export const spec: PlotSpec = {
  width: 440,
  height: 320,
  title: 'Language families',
  description: 'Programming languages packed into their families, sized by usage.',
  margins: { top: 4, right: 4, bottom: 4, left: 4 },
  data: leaves,
  color: { domain: FAMILIES.map((f) => f.name), range: FAMILIES.map((f) => f.color) },
  marks: [{ mark: 'pack', path: 'path', value: 'usage', fill: 'family' }],
};
