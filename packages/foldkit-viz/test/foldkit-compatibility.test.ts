import { describe, expect, it } from 'bun:test';

import { Schema } from 'effect';
import { TextDirection } from 'foldkit/html';
import type { Return } from 'foldkit/update';

describe('FoldKit 0.163 document compatibility', () => {
  it('keeps TextDirection values decodable for chart hosts', () => {
    const decode = Schema.decodeSync(TextDirection);
    const directions = ['Ltr', 'Rtl', 'Auto'] as const;

    expect(directions.map((direction) => decode(direction))).toEqual(['Ltr', 'Rtl', 'Auto']);
  });

  it('accepts the record-shaped update contract', () => {
    const result: Return<{ readonly count: number }, never> = {
      model: { count: 1 },
    };

    expect(result.model.count).toBe(1);
    expect(result.commands).toBeUndefined();
  });
});
