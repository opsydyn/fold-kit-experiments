// Enforces the plan's coverage gate for the kernel (PLAN.md, Phase 1): at least 95% of
// the lines in src/kernel/** run under the tests. Reads the lcov report `bun test
// --coverage --coverage-reporter=lcov` writes; a kernel file no test loads counts as
// wholly uncovered, since Bun reports only the files it loaded.
import { Glob } from 'bun';

const threshold = 95;
const report = process.argv[2] ?? 'coverage/lcov.info';

type Lines = { readonly hit: number; readonly found: number };

const parse = (lcov: string): ReadonlyMap<string, Lines> => {
  const files = new Map<string, Lines>();
  let file: string | undefined;
  let found = 0;
  for (const line of lcov.split('\n')) {
    if (line.startsWith('SF:')) file = line.slice(3);
    else if (line.startsWith('LF:')) found = Number(line.slice(3));
    else if (line.startsWith('LH:') && file !== undefined) {
      files.set(file, { hit: Number(line.slice(3)), found });
    }
  }
  return files;
};

const covered = parse(await Bun.file(report).text());
const kernel = [...new Glob('src/kernel/**/*.ts').scanSync('.')];
let hit = 0;
let found = 0;
const unloaded: Array<string> = [];
for (const file of kernel) {
  const lines = [...covered].find(([path]) => path.endsWith(file))?.[1];
  if (lines === undefined) {
    // Unloaded: count its lines as missed (type-only modules have none worth counting).
    const text = await Bun.file(file).text();
    const code = text
      .split('\n')
      .filter((line) => /^\s*(export\s+)?(const|let|function|class)\b/.test(line));
    if (code.length > 0) unloaded.push(file);
    found += code.length;
    continue;
  }
  hit += lines.hit;
  found += lines.found;
}
const percent = (100 * hit) / Math.max(1, found);
const summary = `kernel line coverage ${percent.toFixed(2)}% (${hit}/${found}), gate ${threshold}%`;
if (unloaded.length > 0) console.error(`no test loads: ${unloaded.join(', ')}`);
if (percent < threshold) {
  console.error(`check-coverage: ${summary}`);
  process.exit(1);
}
console.log(`check-coverage: ${summary}`);
