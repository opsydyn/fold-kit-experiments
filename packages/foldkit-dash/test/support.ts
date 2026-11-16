/** Projects for the tests, written to a fresh folder under the OS's temp directory. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A new project holding `files` (paths from its root), and its root. */
export const project = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), 'foldkit-dash-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
};

/** JSON, as a fence holds it. */
export type Json =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<Json>
  | { readonly [key: string]: Json };

/** A ```plot fence holding `spec`. */
export const fence = (spec: Json): string =>
  `\`\`\`plot\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n`;

export const rows = [
  { month: 'Jan', units: 12, region: 'north' },
  { month: 'Feb', units: 9, region: 'south' },
  { month: 'Mar', units: 15, region: 'north' },
];

/** A bar chart of `data`: a file name in data/, or rows. */
export const bars = (data: string | ReadonlyArray<Json>) => ({
  width: 400,
  height: 240,
  data,
  marks: [{ mark: 'bar', x: 'month', y: 'units' }],
});
