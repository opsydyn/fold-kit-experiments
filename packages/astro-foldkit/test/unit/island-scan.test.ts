import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import foldkit from '../../src/index';
import { findIslandEntries } from '../../src/island-scan';

type EnvironmentConfig = { readonly optimizeDeps?: { readonly entries?: ReadonlyArray<string> } };
type VitePlugin = {
  readonly name: string;
  readonly configEnvironment?: (name: string) => EnvironmentConfig | undefined;
};

const write = (root: string, path: string, text: string): void => {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

const scanPlugin = (root: string): VitePlugin | undefined => {
  const updates: Array<{ readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }> = [];
  const setup = foldkit().hooks['astro:config:setup'];
  if (setup === undefined) throw new Error('Expected astro:config:setup hook');
  // SAFETY: The test fixture supplies only the setup members the integration reads.
  setup({
    config: { root: pathToFileURL(`${root}/`), srcDir: pathToFileURL(`${root}/src/`) },
    addClientDirective: () => {},
    addRenderer: () => {},
    updateConfig: (config: { readonly vite?: { readonly plugins?: ReadonlyArray<unknown> } }) => {
      updates.push(config);
    },
  } as never);
  // SAFETY: The test fixture establishes this value before the assertion.
  const plugins = (updates[0]?.vite?.plugins ?? []).flat(
    Number.POSITIVE_INFINITY,
  ) as ReadonlyArray<VitePlugin>;
  return plugins.find((plugin) => plugin.name === 'astro-foldkit:island-scan');
};

describe('client dependency scan of FoldKit islands', () => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'astro-foldkit-scan-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('finds the modules that define islands and page owners', () => {
    write(
      root,
      'src/apps/grid/app.ts',
      "import { lazyApp } from '@opsydyn/astro-foldkit/define-app';",
    );
    write(
      root,
      'src/apps/chart/app.mts',
      'import { defineApp } from "@opsydyn/astro-foldkit/define-app";',
    );
    write(
      root,
      'src/apps/report/page.ts',
      "import { definePage } from '@opsydyn/astro-foldkit/define-page';",
    );
    write(root, 'src/apps/grid/main.ts', "import { Runtime } from 'foldkit';");
    write(root, 'src/lib/data.ts', "import { readFileSync } from 'node:fs';");

    expect([...findIslandEntries(root, join(root, 'src'))].sort()).toEqual([
      'src/apps/chart/app.mts',
      'src/apps/grid/app.ts',
      'src/apps/report/page.ts',
    ]);
  });

  it('ignores declaration files and installed packages', () => {
    const marker = "import '@opsydyn/astro-foldkit/define-app';";
    write(root, 'src/types/islands.d.ts', marker);
    write(root, 'src/vendor/node_modules/pkg/index.ts', marker);

    expect(findIslandEntries(root, join(root, 'src'))).toEqual([]);
  });

  it('escapes glob syntax in island paths', () => {
    write(root, 'src/pages/[slug]/(grid)/app.ts', "import '@opsydyn/astro-foldkit/define-app';");

    expect(findIslandEntries(root, join(root, 'src'))).toEqual([
      'src/pages/\\[slug\\]/\\(grid\\)/app.ts',
    ]);
  });

  it('adds island modules to the client environment scan entries', () => {
    write(root, 'src/apps/grid/app.ts', "import '@opsydyn/astro-foldkit/define-app';");
    const plugin = scanPlugin(root);

    expect(plugin?.configEnvironment?.('client')).toEqual({
      optimizeDeps: { entries: ['src/apps/grid/app.ts'] },
    });
  });

  it('leaves server environments and island-free projects alone', () => {
    write(root, 'src/apps/grid/app.ts', "import '@opsydyn/astro-foldkit/define-app';");
    expect(scanPlugin(root)?.configEnvironment?.('ssr')).toBeUndefined();

    rmSync(join(root, 'src'), { recursive: true, force: true });
    mkdirSync(join(root, 'src'));
    expect(scanPlugin(root)?.configEnvironment?.('client')).toBeUndefined();
  });

  it('tolerates a missing source directory', () => {
    expect(findIslandEntries(root, join(root, 'src'))).toEqual([]);
  });
});
