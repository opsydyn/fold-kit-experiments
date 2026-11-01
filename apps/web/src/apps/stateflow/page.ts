import { definePage } from '@opsydyn/astro-foldkit/define-page';
import { Option } from 'effect';

import * as main from './main';
import { sessionFrom } from './share';

export default definePage<Record<never, never>, typeof main.Flags.Type>(
  () => Promise.resolve(main),
  { flags: ({ url }) => ({ session: Option.getOrNull(sessionFrom(url.href)) }) },
);
