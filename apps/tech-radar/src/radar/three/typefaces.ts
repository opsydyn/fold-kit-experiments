/**
 * The radar's typefaces: three presets and the system's own. Each sets three roles as CSS
 * custom properties: `--type-display` for names and headings, `--type-text` for prose and
 * controls, and `--type-data` for readings (rings, counts, dates, labels).
 *
 * The families are declared in `astro.config.ts` (Astro's Fonts API), which defines a
 * `--font-*` variable for each; the roles point at those. The full pages and the 3D radar
 * share the reader's choice through `typefaceStorage`.
 *
 * @module
 */
import { Option, Schema } from 'effect';

export const Typeface = Schema.Literals(['instrument', 'mission-control', 'frontier', 'system']);
export type Typeface = typeof Typeface.Type;

/** Instrument unless the reader picked another. */
export const defaultTypeface: Typeface = 'instrument';

/** Where the choice is kept in the browser, by the pages and the radar alike. */
export const typefaceStorage = { key: 'radar-typeface' } as const;

export const typefaceLabels = {
  instrument: 'Instrument',
  'mission-control': 'Mission control',
  frontier: 'Frontier',
  system: 'System',
} as const satisfies Readonly<Record<Typeface, string>>;

/** A stored value as a typeface, or the default if it is missing or not one. */
export const typefaceFrom = (stored: string | null | undefined): Typeface =>
  Option.getOrElse(Schema.decodeUnknownOption(Typeface)(stored), () => defaultTypeface);

type Roles = Readonly<{
  display: string;
  text: string;
  data: string;
  /** Headings set in capitals, and how far apart their letters stand. */
  displayCase: 'none' | 'uppercase';
  displayTracking: string;
  displayWeight: number;
  /** Readings are set slightly smaller where their face runs large. */
  dataScale: number;
}>;

const systemSans = 'system-ui, sans-serif';
const systemMono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Instrument: Airbus's B612, drawn for cockpit displays. Mission control: a Futura-like
 * geometric (Jost) over Inter and IBM Plex Mono, after NASA's 1970s manuals. Frontier: a
 * wide Eurostile-like display (Michroma) in capitals over Exo 2 and Share Tech Mono.
 */
const roles = {
  instrument: {
    display: `var(--font-b612, ${systemSans})`,
    text: `var(--font-b612, ${systemSans})`,
    data: `var(--font-b612-mono, ${systemMono})`,
    displayCase: 'none',
    displayTracking: '0',
    displayWeight: 700,
    dataScale: 0.92,
  },
  'mission-control': {
    display: `var(--font-jost, ${systemSans})`,
    text: `var(--font-inter, ${systemSans})`,
    data: `var(--font-plex-mono, ${systemMono})`,
    displayCase: 'none',
    displayTracking: '-0.01em',
    displayWeight: 600,
    dataScale: 0.92,
  },
  frontier: {
    display: `var(--font-michroma, ${systemSans})`,
    text: `var(--font-exo, ${systemSans})`,
    data: `var(--font-share-tech-mono, ${systemMono})`,
    displayCase: 'uppercase',
    displayTracking: '0.06em',
    displayWeight: 400,
    dataScale: 1,
  },
  system: {
    display: systemSans,
    text: systemSans,
    data: systemMono,
    displayCase: 'none',
    displayTracking: '0',
    displayWeight: 700,
    dataScale: 0.92,
  },
} as const satisfies Readonly<Record<Typeface, Roles>>;

/** A typeface's roles as custom properties, for an element's style. */
export const typeVariables = (typeface: Typeface) => {
  const { display, text, data, displayCase, displayTracking, displayWeight, dataScale } =
    roles[typeface];
  return {
    '--type-display': display,
    '--type-text': text,
    '--type-data': data,
    '--type-display-case': displayCase,
    '--type-display-tracking': displayTracking,
    '--type-display-weight': String(displayWeight),
    '--type-data-scale': String(dataScale),
  };
};

const declarations = (typeface: Typeface): string =>
  Object.entries(typeVariables(typeface))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');

/** The pages' stylesheet of typefaces: the default on `:root`, the others by attribute. */
export const typefaceCss = [
  `:root { ${declarations(defaultTypeface)} }`,
  ...Typeface.literals.map(
    (typeface) => `:root[data-typeface='${typeface}'] { ${declarations(typeface)} }`,
  ),
].join('\n');

/** The Astro font variable whose `.woff` the radar's 3D labels use, per typeface. */
export const labelFontVariables = {
  instrument: '--font-b612',
  'mission-control': '--font-jost',
  frontier: '--font-michroma',
  system: undefined,
} as const satisfies Readonly<Record<Typeface, string | undefined>>;
