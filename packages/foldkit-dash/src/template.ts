/**
 * The project `foldkit-dash new <dir>` writes: a page with two charts, a loader, and
 * instructions for the agent (or person) who takes it from there.
 * @module Template
 */

/** Where `new` puts a copy of the plot spec schema, in the project. */
export const schemaFile = 'plot-spec.schema.json';

/** The plot spec schema, as foldkit-viz publishes it. */
export const schemaUrl = 'https://unpkg.com/@opsydyn/foldkit-viz/schema/plot-spec.schema.json';

const page = `# Weekly sales

Sales by region for the last twelve weeks, from \`data/sales.json.ts\`, which runs when the
site is built.

\`\`\`plot
{
  "width": 720,
  "height": 300,
  "data": "sales.json",
  "marks": [{ "mark": "line", "x": "week", "y": "sales", "stroke": "region" }]
}
\`\`\`

## By region

\`\`\`plot
{
  "width": 720,
  "height": 260,
  "data": "sales.json",
  "marks": [{ "mark": "box", "x": "region", "y": "sales" }]
}
\`\`\`
`;

const loader = `// A data loader: a program that prints JSON rows. \`foldkit-dash build\` runs it and keeps
// what it prints as data/sales.json until this file changes. Read a database, an API or a
// CSV here; the page only ever sees the rows.
const regions = ['North', 'South', 'East', 'West'];
const weeks = 12;

const rows = regions.flatMap((region, r) =>
  Array.from({ length: weeks }, (_, w) => ({
    week: new Date(Date.UTC(2026, 0, 5 + 7 * w)).toISOString().slice(0, 10),
    region,
    sales: Math.round(120 + 25 * r + 30 * Math.sin((w + r) / 2) + 4 * w),
  })),
);

console.log(JSON.stringify(rows));
`;

const agents = `# Working on this dashboard

This is a foldkit-dash project: Markdown pages in \`pages/\`, data in \`data/\`.

- A chart is a fenced block marked \`plot\` holding one JSON plot spec (foldkit-viz's
  grammar of marks). Its schema is \`plot-spec.schema.json\`, here in the project
  (look up \`definitions.LineMark\`, \`BarMark\` and the rest, and \`PositionScaleSpec\`
  for axes). It is also published at ${schemaUrl}.
- \`"data": "name.json"\` reads \`data/name.json\`, or the output of the loader
  \`data/name.json.ts\`: a program Bun runs from this folder, which prints JSON rows (top-level
  \`await\` and Bun's APIs work; it may read files anywhere, such as \`../export.csv\`).
  Rows are objects of plain values; ISO date strings make time axes.
- A band axis shows its categories in the order they first appear in the rows; set the
  axis's \`domain\` to order them yourself.
- Each \`pages/**/*.md\` becomes \`dist/**/*.html\`. Link pages with \`[text](other.md)\`.

The loop:

1. Write or change a page or a loader.
2. \`bunx foldkit-dash check --json\`: every problem with its file, line and spec path.
   Fix them all; exit 0 means none.
3. \`bunx foldkit-dash describe\`: what each chart shows, in words. Check that it says
   what the prose around it claims.
4. \`bunx foldkit-dash build\`: writes \`dist/\`, static HTML (JavaScript only on pages
   with inputs).

Inputs: an \`input\` fence (\`select\`, \`radio\`, \`range\` or \`checkbox\`) puts a control
on the page, and a plot spec uses its value with \`{ "input": "name" }\`, most often in
\`"where": { "region": { "input": "region" } }\`, which keeps the rows a chart draws.
\`where\` works without inputs too: \`"where": { "region": "North" }\`.

\`bunx foldkit-dash dev\` serves the site and rebuilds it as files change, for a person
watching.
`;

const gitignore = `dist/
node_modules/
`;

/** Every file of a new project, by path. */
export const starter: ReadonlyArray<readonly [string, string]> = [
  ['AGENTS.md', agents],
  ['pages/index.md', page],
  ['data/sales.json.ts', loader],
  ['.gitignore', gitignore],
];
