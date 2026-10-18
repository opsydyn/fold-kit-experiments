/**
 * A small highlighter for the code plaque: colour ranges over a TypeScript snippet, by
 * character index, as `label({ colorRanges })` takes them. Function calls, property
 * names, strings and punctuation each get a colour; everything else is the label's own.
 */
import { colorRange, type LabelColorRange, type Rgb } from '@opsydyn/effect-three';

export const codeColours = {
  plain: 0xe6e3dc,
  call: 0x5b9bff,
  property: 0xb98cff,
  string: 0x4fe0ad,
  punctuation: 0x7d838e,
} as const;

const token =
  /(?<call>[A-Za-z_]\w*)(?=\()|(?<property>[A-Za-z_]\w*)(?=:)|(?<string>'[^']*')|(?<punctuation>[{}()[\],.:=>])/g;

const kinds = ['call', 'property', 'string', 'punctuation'] as const;

/** Colour ranges for `code`: each token in its colour, the text after it back to plain. */
export const highlight = (code: string): ReadonlyArray<LabelColorRange> => {
  const ranges: Array<LabelColorRange> = [colorRange(0, codeColours.plain)];
  for (const match of code.matchAll(token)) {
    const kind = kinds.find((name) => match.groups?.[name] !== undefined);
    if (kind === undefined || match.index === undefined) continue;
    const colour: Rgb = codeColours[kind];
    ranges.push(colorRange(match.index, colour));
    ranges.push(colorRange(match.index + match[0].length, codeColours.plain));
  }
  return ranges;
};
