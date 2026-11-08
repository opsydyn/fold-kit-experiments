import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

// oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Literal lazy entry is owned by the Astro integration.
export default lazyApp(() => import('./main'));
