import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { sitePaths } from '../src/radar/meta';
import { editionsIn } from '../src/radar/pages';
import { blipAt, previewPath, previewsOf, radarSvg } from '../src/radar/preview';
import { demoRadar } from '../src/test/fixture';

const editions = editionsIn(demoRadar, 'Fourth edition');
const tags = [{ tag: 'gpu', ids: ['futhark', 'webgpu'] }];
const previews = previewsOf(demoRadar, editions, tags, { title: 'Tech radar', intro: 'Intro.' });

describe('link previews', () => {
  test('every page in the sitemap has its own card', () => {
    const paths = new Set(previews.map(({ path }) => path));
    expect(paths.size).toBe(previews.length);
    const missing = sitePaths(demoRadar, editions, ['gpu'])
      .map(previewPath)
      .filter((path) => !paths.has(path));
    expect(missing).toEqual([]);
  });

  test("an entry's card names its ring then and rings it on the small radar", () => {
    const first = editions[0];
    const card = previews.find(({ path }) => path === `edition/${first?.date}/blip/effect`);
    expect(card?.badge).toEqual(Option.some('Trial'));
    expect(card?.focus).toEqual(Option.some('effect'));
    expect(radarSvg(demoRadar, card ?? previews[0]!, 420)).toContain('r="20"');
  });

  test("a blip stays inside its category's quarter and its ring's band", () => {
    const { x, y } = blipAt('effect', 'languages-frameworks', 'adopt', 100);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
    expect(Math.hypot(x, y)).toBeLessThan(40);
  });
});
