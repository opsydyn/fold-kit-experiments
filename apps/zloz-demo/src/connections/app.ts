import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Literal lazy entry belongs to the Astro integration.
export default lazyApp(() => import('./main'));
