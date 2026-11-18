import { mkdir, readFile, writeFile } from 'node:fs/promises';

import { compilePhosphorIcon } from '@opsydyn/foldkit-phosphor/compile';

const names = [
  'user',
  'package',
  'cloud',
  'stack',
  'cube',
  'plus',
  'arrow-counter-clockwise',
  'trash',
  'download-simple',
] as const;
const definitions = await Promise.all(
  names.map(async (name) => {
    const source = await readFile(
      new URL(import.meta.resolve(`@phosphor-icons/core/assets/duotone/${name}-duotone.svg`)),
      'utf8',
    );
    return [name, compilePhosphorIcon(source)] as const;
  }),
);
await writeFile(
  new URL('../src/appearance/icon-data.ts', import.meta.url),
  `// Generated from @phosphor-icons/core 2.1.1; see public/third-party/PHOSPHOR-LICENSE.\nimport type { PhosphorIconDefinition } from '@opsydyn/foldkit-phosphor';\nexport const icons = ${JSON.stringify(Object.fromEntries(definitions))} as const satisfies Readonly<Record<string, PhosphorIconDefinition>>;\n`,
);
const notices = new URL('../public/third-party/', import.meta.url);
await mkdir(notices, { recursive: true });
const license = await readFile(
  new URL('../LICENSE', import.meta.resolve('@phosphor-icons/core')),
  'utf8',
);
await writeFile(new URL('PHOSPHOR-LICENSE', notices), license.replaceAll('\r\n', '\n'));
