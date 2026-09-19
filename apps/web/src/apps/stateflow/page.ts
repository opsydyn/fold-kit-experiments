import { definePage } from '@opsydyn/astro-foldkit/define-page';

import * as main from './main';

export default definePage(() => Promise.resolve(main), { flags: () => ({}) });
