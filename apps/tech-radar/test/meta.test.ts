import { describe, expect, test } from 'bun:test';

import { feedXml, linkPreview, sitemapXml, sitePaths } from '../src/radar/meta';
import { editionEntryPaths, editionsIn } from '../src/radar/pages';
import { demoRadar } from '../src/test/fixture';

const editions = editionsIn(demoRadar, 'Fourth edition');
const about = { title: 'Tech radar', intro: 'Functional programming & AI tooling.' };
const site = new URL('https://radar.example/');
const preview = (params: Record<string, string>) => linkPreview(demoRadar, editions, about, params);

describe("the 3D radar's link previews", () => {
  test('name the pinned entry and its ring in the edition the link shows', () => {
    const codex = demoRadar.entries.find(({ id }) => id === 'codex');
    expect(preview({ entry: 'codex' })).toEqual({
      title: 'Codex · Trial · Tech radar',
      description: codex?.description ?? '',
    });
    expect(preview({ entry: 'codex', edition: '2026-06-14' }).title).toBe(
      'Codex · Assess · Tech radar',
    );
  });

  test('name the category a link stands at', () => {
    expect(preview({ view: 'cluster:tools' })).toEqual({
      title: 'Tools · Tech radar',
      description: 'Tools on the radar, fourth edition.',
    });
  });

  test("name an earlier edition, and fall back to the radar's own preview", () => {
    expect(preview({ edition: '2025-10-14' }).title).toBe('First edition · Tech radar');
    expect(preview({})).toEqual({ title: 'Tech radar', description: about.intro });
    expect(preview({ entry: 'no-such-entry', edition: 'soon' })).toEqual(preview({}));
  });
});

describe('the feed', () => {
  const feed = feedXml(demoRadar, editions, about, site);

  test('has an entry per edition, newest first, linking to its page', () => {
    const titles = [...feed.matchAll(/<entry>\s*<title>([^<]+)</g)].map((match) => match[1]);
    expect(titles).toEqual([
      'Fourth edition · 2026-10-14',
      'Third edition · 2026-06-14',
      'Second edition · 2026-02-14',
      'First edition · 2025-10-14',
    ]);
    expect(feed).toContain('<link href="https://radar.example/edition/2026-10-14/"/>');
    expect(feed).toContain('<updated>2026-10-14T00:00:00Z</updated>');
  });

  test('escapes its text, so the HTML content stays one XML text node', () => {
    expect(feed).toContain('<subtitle>Functional programming &amp; AI tooling.</subtitle>');
    expect(feed).toContain('&lt;ul&gt;&lt;li&gt;');
    expect(feed).not.toContain('<ul>');
  });
});

describe('the sitemap', () => {
  test('lists every page once, as absolute addresses', () => {
    const paths = sitePaths(demoRadar, editions);
    expect(paths.length).toBe(
      1 +
        4 +
        editions.length +
        demoRadar.entries.length +
        editionEntryPaths(demoRadar, editions).length,
    );
    expect(new Set(paths).size).toBe(paths.length);
    const xml = sitemapXml(paths, site);
    expect(xml).toContain('<loc>https://radar.example/blip/codex/</loc>');
    expect(xml).toContain('<loc>https://radar.example/edition/2025-10-14/blip/foldkit/</loc>');
  });
});
