import { describe, expect, test } from 'bun:test';

import { bodyOf, documentOf, fencesOf, hrefFrom, outputOf, titleOf } from '../src/page';

describe('pages', () => {
  test('fences are found with the line they open on', () => {
    const text =
      '# Title\n\nText.\n\n```plot\n{ "a": 1 }\n```\n\n```js\nnot a plot\n```\n\n```input\n{}\n```\n';
    expect(fencesOf(text)).toEqual([
      { kind: 'plot', source: '{ "a": 1 }\n', line: 5 },
      { kind: 'input', source: '{}\n', line: 13 },
    ]);
  });

  test('a title is the first heading, else the file name', () => {
    expect(titleOf({ file: 'pages/a.md', text: 'intro\n\n# Sales ##\n\n# Other' })).toBe('Sales');
    expect(titleOf({ file: 'pages/notes/q3.md', text: 'no heading' })).toBe('q3');
  });

  test('pages map to output paths, linked relatively', () => {
    expect(outputOf('pages/index.md')).toBe('index.html');
    expect(outputOf('pages/teams/north.md')).toBe('teams/north.html');
    expect(hrefFrom('teams/north.html', 'index.html')).toBe('../index.html');
    expect(hrefFrom('index.html', 'teams/north.html')).toBe('teams/north.html');
    expect(hrefFrom('index.html', 'index.html')).toBe('index.html');
  });

  test('figures replace their fences, raw HTML is escaped, and .md links go to .html', () => {
    const text =
      '# T\n\n<script>alert(1)</script>\n\nSee [north](teams/north.md#top), [south](teams/south.md?region=south#chart), [site](https://x.dev/a.md).\n\n```plot\n{}\n```\n\nAfter.\n';
    const body = bodyOf(text, ['<figure>F</figure>']);
    expect(body).not.toContain('<script>');
    expect(body).toContain('&lt;script&gt;');
    expect(body).toContain('<figure>F</figure>');
    expect(body.indexOf('<figure>')).toBeLessThan(body.indexOf('After.'));
    expect(body).toContain('href="teams/north.html#top"');
    // A link to a view of a page keeps its query (ADR 0116).
    expect(body).toContain('href="teams/south.html?region=south#chart"');
    expect(body).toContain('href="https://x.dev/a.md"');
  });

  test('a document lists the other pages only when there are several', () => {
    const one = documentOf({
      title: 'A',
      output: 'index.html',
      nav: [{ output: 'index.html', title: 'A' }],
      body: '',
    });
    expect(one).not.toContain('<nav');
    const two = documentOf({
      title: 'A',
      output: 'teams/north.html',
      nav: [
        { output: 'index.html', title: 'Home' },
        { output: 'teams/north.html', title: 'North <&>' },
      ],
      body: '<p>x</p>',
    });
    expect(two).toContain('<a href="../index.html">Home</a>');
    expect(two).toContain('aria-current="page" href="north.html">North &lt;&amp;&gt;</a>');
    expect(two).not.toContain('<script');
  });
});
