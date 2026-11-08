import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
// The Astro integration uses this import as the client island entry.
// oxlint-disable-next-line linteffect/prevent-dynamic-imports
export default lazyApp(() => import('./main'));
