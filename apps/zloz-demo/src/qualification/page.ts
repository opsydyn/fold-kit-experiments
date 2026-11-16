import { definePage } from '@opsydyn/astro-foldkit/define-page';
import { Schema } from 'effect';

import { Flags } from './flags';
export default definePage<Flags, Flags>(
  // oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Literal page-owner hydration qualification entry.
  () => import('./page-main'),
  { flags: ({ props }) => Schema.decodeUnknownSync(Flags)(props) },
);
