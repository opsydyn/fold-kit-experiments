import { definePage } from '@opsydyn/astro-foldkit/define-page';
import { Schema } from 'effect';
import { Flags } from './flags';

export default definePage<Flags, Flags>(() => import('./page-main'), {
  flags: ({ props }) => Schema.decodeUnknownSync(Flags)(props),
});
