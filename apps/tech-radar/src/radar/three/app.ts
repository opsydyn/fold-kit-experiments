import { lazyApp } from '@opsydyn/astro-foldkit/define-app';

import type { RadarProps } from './main';

import './styles.css';

export default lazyApp<RadarProps>(() => import('./main'));
