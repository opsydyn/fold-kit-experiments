import { describe, expect, test } from 'bun:test';

import { Message } from '../../src/radar/three/message';
import type { Model } from '../../src/radar/three/model';
import { sceneFor } from '../../src/radar/three/scene';
import {
  defaultTypeface,
  Typeface,
  typefaceCss,
  typefaceFrom,
  typeVariables,
} from '../../src/radar/three/typefaces';
import { init, update } from '../../src/radar/three/update';
import { demoRadar } from '../../src/test/fixture';

const labelFonts = { frontier: '/_astro/fonts/michroma.woff' };
const start = init({ dataset: demoRadar, labelFonts }).model;
const step = (model: Model, message: Message): Model => update(model, message).model;
/** The fonts the scene's labels ask troika for. */
const labelFontsOf = (model: Model): ReadonlyArray<string | undefined> => [
  ...new Set(
    sceneFor(model).children.flatMap((node) => (node._tag === 'Label' ? [node.font] : [])),
  ),
];

describe('typefaces', () => {
  test('the radar opens in the default, and asks for the one the reader picked last', () => {
    expect(start.typeface).toBe(defaultTypeface);
    expect(init({ dataset: demoRadar }).commands?.map(({ name }) => name)).toContain(
      'LoadTypeface',
    );
    expect(step(start, Message.SucceededLoadTypeface({ typeface: 'frontier' })).typeface).toBe(
      'frontier',
    );
  });

  test('a picked typeface is saved for every page, and is not part of the link', () => {
    const chosen = update(start, Message.ChoseTypeface({ typeface: 'mission-control' }));
    expect(chosen.model.typeface).toBe('mission-control');
    expect(chosen.commands?.map(({ name }) => name)).toEqual(['SaveTypeface']);
  });

  test('a stored value that is not a typeface, or none at all, reads as the default', () => {
    for (const typeface of Typeface.literals) expect(typefaceFrom(typeface)).toBe(typeface);
    for (const stored of [null, '', 'comic-sans', 'FRONTIER']) {
      expect(typefaceFrom(stored)).toBe(defaultTypeface);
    }
  });

  test('every typeface sets every role, and the pages get a rule for each', () => {
    const roles = Object.keys(typeVariables(defaultTypeface));
    for (const typeface of Typeface.literals) {
      expect(Object.keys(typeVariables(typeface))).toEqual(roles);
      expect(typefaceCss).toContain(`[data-typeface='${typeface}']`);
    }
  });

  test("the 3D labels take the typeface's display face, or the radar's own Inter", () => {
    const frontier = step(start, Message.ChoseTypeface({ typeface: 'frontier' }));
    expect(labelFontsOf(frontier)).toEqual(['/_astro/fonts/michroma.woff']);
    expect(labelFontsOf(start)).toEqual(['/models/inter-latin-400-normal.woff']);
  });
});
