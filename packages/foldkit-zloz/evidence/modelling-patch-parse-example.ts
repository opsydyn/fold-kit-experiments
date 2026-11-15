import { parseModellingPatch } from '../src/index';
import literal from '../test/fixtures/modelling-patch-v1.json';
const text = JSON.stringify(literal);
console.log(
  JSON.stringify(
    {
      parsed: parseModellingPatch(text),
      duplicate: parseModellingPatch(
        text.replace('"owner":"commerce"', '"owner":"commerce","\\u006fwner":"other"'),
      ),
      unsupported: parseModellingPatch(JSON.stringify({ ...literal, version: 2 })),
      bounded: parseModellingPatch(text, { maxValues: 10 }),
      malformed: parseModellingPatch(text + '{}'),
    },
    null,
    2,
  ),
);
