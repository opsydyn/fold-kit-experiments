/** Run at build time with Bun. Output is static data; views import no parser or Core catalog. */
import { copyFile, readFile, mkdir, writeFile } from 'node:fs/promises';

import { compilePhosphorIcon } from '../src/compile';

const output = new URL('./generated/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(
  new URL('../LICENSE', import.meta.resolve('@phosphor-icons/core')),
  new URL('PHOSPHOR-LICENSE', output),
);
for (const name of ['user', 'package', 'cloud', 'stack', 'cube']) {
  const source = await readFile(
    new URL(import.meta.resolve(`@phosphor-icons/core/assets/duotone/${name}-duotone.svg`)),
    'utf8',
  );
  const definition = compilePhosphorIcon(source);
  await writeFile(
    new URL(`${name}.ts`, output),
    `// Generated from @phosphor-icons/core 2.1.1 (MIT).\nimport type { PhosphorIconDefinition } from '@opsydyn/foldkit-phosphor';\nexport const ${name}Icon = ${JSON.stringify(definition)} as const satisfies PhosphorIconDefinition;\n`,
  );
}
