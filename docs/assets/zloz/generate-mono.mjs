/** Geometry is authored only in the three color marks. Monochrome files are derived. */
import { readFile, writeFile } from 'node:fs/promises';

for (const name of ['assembly-junction', 'nested-frame', 'connected-planes']) {
  const source = await readFile(new URL(`./${name}.svg`, import.meta.url), 'utf8');
  const mono = source
    .replace(/fill="var\([^"]+\)"/gu, 'fill="currentColor"')
    .replace(/aria-label="([^"]+)"/u, 'aria-label="$1, monochrome"');
  await writeFile(new URL(`./${name}-mono.svg`, import.meta.url), mono);
}
