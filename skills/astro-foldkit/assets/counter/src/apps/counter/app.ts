import { lazyApp } from '@opsydyn/astro-foldkit/define-app';
import type { Flags } from './flags';

type Props = Flags & { readonly noMeta?: boolean | '' };
export default lazyApp<Props>(() => import('./main'));
