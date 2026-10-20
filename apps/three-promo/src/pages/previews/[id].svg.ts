// Stills of example scenes, drawn at build time without a browser (`previewSvg`): the
// description each example starts from, as SVG.
import { previewSvg } from '@opsydyn/effect-three';
import { type PreviewId, previewScenes } from '@opsydyn/effect-three-samples/previews';
import type { APIRoute, GetStaticPaths } from 'astro';

const isPreviewId = (id: string | undefined): id is PreviewId =>
  id !== undefined && Object.hasOwn(previewScenes, id);

export const getStaticPaths = (() =>
  Object.keys(previewScenes).map((id) => ({ params: { id } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const result = isPreviewId(params.id)
    ? previewSvg(previewScenes[params.id](), { width: 640, height: 400, background: 0xf4f1ea })
    : undefined;
  return result?._tag === 'Preview'
    ? new Response(result.svg, { headers: { 'Content-Type': 'image/svg+xml' } })
    : new Response('No such scene', { status: 404 });
};
