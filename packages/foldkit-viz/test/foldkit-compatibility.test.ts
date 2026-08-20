import { describe, expect, it } from 'bun:test';

import { Schema } from 'effect';
import { TextDirection } from 'foldkit/html';

describe('FoldKit 0.148 document compatibility', () => {
  it('keeps TextDirection values decodable for chart hosts', () => {
    const decode = Schema.decodeSync(TextDirection);
    const directions = ['Ltr', 'Rtl', 'Auto'] as const;

    expect(directions.map((direction) => decode(direction))).toEqual(['Ltr', 'Rtl', 'Auto']);
  });
});
