import { writeFile } from 'node:fs/promises';

import { captureModelDocument, serializeModelDocument } from '@opsydyn/foldkit-zloz';

import literal from '../../foldkit-zloz/test/fixtures/modelling-patch-v1.json';
await writeFile(
  new URL('patch-source.model.json', import.meta.url),
  serializeModelDocument(
    captureModelDocument({
      id: literal.source.modelId,
      name: 'Commerce',
      snapshot: { graph: literal.source.graph },
      editions: [],
      origin: null,
    }),
  ),
);
