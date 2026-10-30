import { describe, expect, test } from 'bun:test';

import { markdownFiles, slugOf, titled } from '../src/repoDocs';
import { siteHref } from '../src/repoLinks';

const options = {
  repoRoot: '/repo/',
  docsRoot: '/repo/docs/',
  base: '/fold-kit-experiments/docs/',
  repo: 'opsydyn/fold-kit-experiments',
  branch: 'main',
};

describe('pages from docs/', () => {
  test('a file is its path without .md, lowercased; a README is its folder', () => {
    expect(slugOf('effect-three/PLAN.md')).toBe('effect-three/plan');
    expect(slugOf('adr/0001-require-verified-main-pull-requests.md')).toBe(
      'adr/0001-require-verified-main-pull-requests',
    );
    expect(slugOf('README.md')).toBe('index');
    expect(slugOf('spikes/README.md')).toBe('spikes');
  });

  test('the first heading is the title, and leaves the body', () => {
    expect(titled('# ADR-001: `Greenfield`\n\nWhy.\n', 'x')).toEqual({
      title: 'ADR-001: Greenfield',
      body: '\n\nWhy.\n',
    });
    expect(titled('No heading.', 'fallback').title).toBe('fallback');
  });

  test('every markdown file in docs/ but the hidden ones is a page, each with a title', async () => {
    const root = new URL('../../../docs/', import.meta.url).pathname;
    const files = await markdownFiles(root);
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((file) => file.split('/').some((part) => part.startsWith('.')))).toBe(false);
    const untitled = await Promise.all(
      files.map(async (file) => ({ file, text: await Bun.file(`${root}${file}`).text() })),
    ).then((read) => read.filter(({ text }) => !/^#[ \t]+\S/m.test(text)).map(({ file }) => file));
    expect(untitled).toEqual([]);
  });
});

describe('links', () => {
  test('a link to another doc goes to its page, keeping the anchor', () => {
    expect(
      siteHref('../releases/foldkit-0.170.md#releasing', '/repo/docs/spikes/x.md', options),
    ).toBe('/fold-kit-experiments/docs/releases/foldkit-0.170/#releasing');
  });

  test('a link to anything else in the repository goes to GitHub', () => {
    expect(
      siteHref('../../packages/effect-three/src/index.ts', '/repo/docs/adr/x.md', options),
    ).toBe(
      'https://github.com/opsydyn/fold-kit-experiments/blob/main/packages/effect-three/src/index.ts',
    );
  });
});
