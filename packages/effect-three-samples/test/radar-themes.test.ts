import { describe, expect, test } from 'bun:test';

import { Option } from 'effect';

import { choiceFrom } from '../src/radar/command';
import { alignedOf, constellations, vantageOf } from '../src/radar/constellations';
import { Message } from '../src/radar/message';
import { type Model, themeOf } from '../src/radar/model';
import { draftingGrid, materialsFor, sceneFor } from '../src/radar/scene';
import { outerRadius } from '../src/radar/space';
import { cssVariables, resolveTheme, Theme, ThemeChoice, themes } from '../src/radar/themes';
import { init, update } from '../src/radar/update';

const opened = init();
const start = opened.model;
const step = (model: Model, message: Message): Model => update(model, message).model;
const allThemes: ReadonlyArray<Theme> = Theme.literals;
const keysOf = (model: Model): ReadonlyArray<string> =>
  sceneFor(model).children.map((node) => node.key);
const themed = (theme: Theme): Model => step(start, Message.ChoseTheme({ choice: theme }));

describe('themes', () => {
  test('every theme has every token, and the same shared material ids', () => {
    const ids = (theme: Theme) => materialsFor(themes[theme]).map(({ id }) => id);
    const night = Object.keys(themes.night).sort();
    for (const theme of allThemes) {
      expect(Object.keys(themes[theme]).sort()).toEqual(night);
      // The same ids: a theme change updates live materials in place.
      expect(ids(theme)).toEqual(ids('night'));
    }
  });

  test('Auto follows the reader’s settings; a choice wins over them', () => {
    const settings = [
      { scheme: 'dark', contrast: 'standard' },
      { scheme: 'light', contrast: 'standard' },
      { scheme: 'dark', contrast: 'more' },
      { scheme: 'light', contrast: 'more' },
    ] as const;
    expect(settings.map((each) => resolveTheme('auto', each))).toEqual([
      'night',
      'paper',
      'contrast',
      'contrast',
    ]);
    for (const each of settings) expect(resolveTheme('blueprint', each)).toBe('blueprint');
  });

  test('the radar follows the colour scheme until the reader picks a theme', () => {
    expect(themeOf(start)).toBe('night');
    const light = step(start, Message.ChangedColorScheme({ scheme: 'light' }));
    expect(themeOf(light)).toBe('paper');
    expect(themeOf(step(light, Message.ChoseTheme({ choice: 'night' })))).toBe('night');
    expect(themeOf(step(start, Message.ChangedContrast({ contrast: 'more' })))).toBe('contrast');
  });

  test('a picked theme is saved, and the saved one is looked for as the radar opens', () => {
    expect(opened.commands?.map(({ name }) => name)).toEqual(['LoadThemeChoice']);
    const chosen = update(start, Message.ChoseTheme({ choice: 'paper' }));
    expect(chosen.model.themeChoice).toBe('paper');
    expect(chosen.commands?.map(({ name }) => name)).toEqual(['SaveThemeChoice']);
    const restored = step(start, Message.SucceededLoadThemeChoice({ choice: 'blueprint' }));
    expect(themeOf(restored)).toBe('blueprint');
  });

  test('a stored value that is not a choice, or none at all, reads as Auto', () => {
    for (const choice of ThemeChoice.literals) expect(choiceFrom(choice)).toBe(choice);
    for (const stored of [null, '', 'sepia', 'NIGHT']) expect(choiceFrom(stored)).toBe('auto');
  });

  test('the sidebar and overlays read the theme as custom properties', () => {
    expect(cssVariables('night')['--surface']).toBe('#12121f');
    expect(cssVariables('paper')['--text']).toBe('#1d1c1a');
    expect(cssVariables('paper')['color-scheme']).toBe('light');
    expect(cssVariables('night')['color-scheme']).toBe('dark');
  });

  test('stars only in Night; the constellations hide wherever there is no sky', () => {
    expect(keysOf(start)).toContain('stars');
    for (const theme of ['blueprint', 'paper', 'contrast'] as const) {
      expect(keysOf(themed(theme))).not.toContain('stars');
    }
    const [hexagon] = constellations;
    const atVantage = (model: Model): Model => ({
      ...model,
      camera: {
        ...model.camera,
        position: hexagon === undefined ? [0, 0, 12] : vantageOf(hexagon),
      },
    });
    expect(Option.isSome(alignedOf(atVantage(start)))).toBe(true);
    expect(Option.isNone(alignedOf(atVantage(themed('paper'))))).toBe(true);
  });

  test('Blueprint rules a drafting grid under the radar; no other theme has one', () => {
    const gridOf = (model: Model) => keysOf(model).filter((key) => key.startsWith('grid:'));
    const lines = gridOf(themed('blueprint'));
    expect(lines).toHaveLength((draftingGrid.reach * 2 + 1) * 2);
    for (const theme of ['night', 'paper', 'contrast'] as const) {
      expect(gridOf(themed(theme))).toEqual([]);
    }
    // A floor below the outer shell, never through the radar.
    expect(draftingGrid.level).toBeLessThan(-outerRadius);
  });

  test('High contrast: no translucent shells, no glow, bolder labels and edges', () => {
    const { contrast, night } = themes;
    expect(contrast.shellOpacity).toBe(0);
    expect(contrast.glow).toBe(contrast.surface);
    expect(contrast.labelOutline).toBeGreaterThan(night.labelOutline);
    expect(contrast.edgeStrength).toBeGreaterThan(night.edgeStrength);
    const shell = materialsFor(contrast).find(({ id }) => id === 'shell');
    expect(shell?.material.opacity).toBe(0);
  });

  test('categories keep the validated slots: dark steps on dark surfaces, light on Paper', () => {
    expect(themes.night.categories).toEqual({
      techniques: 0x9085e9,
      tools: 0x008300,
      platforms: 0xc98500,
      'languages-frameworks': 0xd55181,
    });
    expect(themes.blueprint.categories).toEqual(themes.night.categories);
    expect(themes.contrast.categories).toEqual(themes.night.categories);
    expect(themes.paper.categories).toEqual({
      techniques: 0x6250d6,
      tools: 0x008300,
      platforms: 0xeda100,
      'languages-frameworks': 0xe87ba4,
    });
    // Two types share each theme's neutral; their line styles tell them apart.
    for (const theme of allThemes) {
      const { relationships } = themes[theme];
      expect(relationships['guards-against']).toBe(relationships['alternative-to']);
    }
  });
});
