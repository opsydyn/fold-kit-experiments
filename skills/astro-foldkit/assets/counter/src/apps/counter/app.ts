import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
import type { Flags } from './flags';

type Props = Flags & { readonly noMeta?: boolean | '' };
// `init` and `view` are pure, so the island pre-renders: its count is in the
// HTML before any JavaScript runs, and the client replaces it on boot.
export default lazyApp<Props>(() => import('./main'), { prerender: true });
