import { readFile, writeFile } from 'node:fs/promises';

import { parseReviewPacket } from '../src/index';
import literal from '../test/fixtures/review-packet-v1.json';
const text = await readFile(
  new URL('../test/fixtures/review-packet-v1.json', import.meta.url),
  'utf8',
);
const parsed = parseReviewPacket(text);
const invalid: typeof literal = JSON.parse(text);
invalid.diagnostics = [];
const inconsistent = parseReviewPacket(JSON.stringify(invalid));
const wide = parseReviewPacket('[' + Array(150001).fill(0).join(',') + ']');
if (parsed.status !== 'parsed' || inconsistent.status !== 'rejected' || wide.status !== 'rejected')
  throw new Error('Decoder qualification failed');
await writeFile(
  new URL('review-packet-parse-results.json', import.meta.url),
  JSON.stringify(
    {
      literal: {
        status: parsed.status,
        model: parsed.value.model,
        baseline: parsed.value.baseline.source,
        selected: parsed.value.selected.source,
        summary: parsed.value.comparison.summary,
        frozen: Object.isFrozen(parsed.value),
      },
      inconsistent,
      wide,
    },
    null,
    2,
  ) + '\n',
);
