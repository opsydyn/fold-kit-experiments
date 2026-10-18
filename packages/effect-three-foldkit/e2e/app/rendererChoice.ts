/**
 * Plain helpers for the e2e pages: the renderer a page's address asks for. Kept apart from
 * the Effect code that mounts the scenes.
 *
 * - (nothing): three's WebGL renderer, the environment's default;
 * - `?renderer=webgpu`: three's WebGPURenderer on its WebGL 2 backend;
 * - `?renderer=webgpu&backend=webgpu`: WebGPURenderer on real WebGPU.
 */
import type { RendererFactory } from '@opsydyn/effect-three';

import { webgpuRendererFactory } from '../../src/dom/webgpu.ts';

type Choice = (canvas: HTMLCanvasElement) => RendererFactory;

const webgpuOn: Readonly<Record<string, Choice>> = {
  webgpu: (canvas) => webgpuRendererFactory(canvas),
};

const fallback: Choice = (canvas) => webgpuRendererFactory(canvas, { forceWebGL: true });

/** The renderer option the page's address asks for, if it asks for one. */
export const rendererFromAddress = (search: string): { readonly renderer?: Choice } => {
  const query = new URLSearchParams(search);
  if (query.get('renderer') !== 'webgpu') return {};
  return { renderer: webgpuOn[query.get('backend') ?? ''] ?? fallback };
};

/** The post effects the page's address names (`?effects=Bloom,Film`), or all of them. */
export const effectsFromAddress = (search: string): ((tag: string) => boolean) => {
  const named = new URLSearchParams(search).get('effects');
  if (named === null) return () => true;
  const tags = new Set(named.split(','));
  return (tag) => tags.has(tag);
};
