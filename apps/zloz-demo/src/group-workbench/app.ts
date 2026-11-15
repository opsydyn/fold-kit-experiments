import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
// oxlint-disable-next-line linteffect/prevent-dynamic-imports -- Literal lazy Astro application entry.
export default lazyApp(() => import('./main'), { prerender: true });
