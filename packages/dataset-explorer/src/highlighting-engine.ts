import { createStarryNight } from '@wooorm/starry-night';
import sourceAstro from '@wooorm/starry-night/source.astro';
import sourceJs from '@wooorm/starry-night/source.js';
import sourceJson from '@wooorm/starry-night/source.json';
import sourceShell from '@wooorm/starry-night/source.shell';
import sourceTs from '@wooorm/starry-night/source.ts';
import sourceTsx from '@wooorm/starry-night/source.tsx';

import sourceCss from '@wooorm/starry-night/source.css';

export const createHighlighter = (wasmUrl?: string) =>
  createStarryNight(
    [sourceTs, sourceTsx, sourceJs, sourceCss, sourceJson, sourceShell, sourceAstro],
    wasmUrl ? { getOnigurumaUrlFetch: () => new URL(wasmUrl, window.location.href) } : undefined,
  );
