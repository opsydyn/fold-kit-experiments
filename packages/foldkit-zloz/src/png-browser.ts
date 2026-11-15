import { ZlozError } from './graph';
import {
  planPngExport,
  type ZlozPngExportInput,
  type ZlozPngRenderResult,
  type ZlozPngArtifact,
} from './png-export';
/** Optional browser rasterization. Import is safe under Node/SSR; IO occurs only when called. */
import { writeSvgExport } from './svg-writer';
export type ZlozPngBrowserOptions = Readonly<{ signal?: AbortSignal; timeoutMs?: number }>;
class RasterError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
const failure = (code: string, reason: string): ZlozPngRenderResult => ({
  type: 'failed',
  code,
  reason,
});
/** Rebuilds safe SVG; no arbitrary markup or DOM screenshot input. Returned preview/download bytes are identical. */
export async function renderPngExport(
  input: ZlozPngExportInput,
  options: ZlozPngBrowserOptions = {},
): Promise<ZlozPngRenderResult> {
  const timeout = options.timeoutMs ?? 10000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000)
    throw new ZlozError('invalid-edit', 'PNG timeout must be an integer from 1 to 30000 ms.');
  if (options.signal?.aborted) return failure('aborted', 'PNG rendering was cancelled.');
  if (
    globalThis.document === undefined ||
    globalThis.Image === undefined ||
    globalThis.FileReader === undefined
  )
    return failure(
      'unsupported',
      'PNG rasterization requires a browser image, canvas and FileReader.',
    );
  if (input.writing?.allowLosses !== true)
    return failure(
      'loss-consent-required',
      'Review PNG rasterization and SVG findings, then explicitly allow losses.',
    );
  const written = writeSvgExport(input.snapshot, input.svg, input.writing);
  const plan = planPngExport(written, input.png);
  if (plan.type !== 'ready')
    return failure('plan-blocked', 'Resolve PNG/SVG findings before rasterization.');
  if (input.expectedSvg !== undefined && input.expectedSvg !== plan.svg)
    return failure('source-changed', 'The rendered SVG differs from the reviewed source.');
  const controller = new AbortController();
  let timedOut = false;
  const forward = () => controller.abort();
  options.signal?.addEventListener('abort', forward, { once: true });
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeout);
  let abortHandler: () => void = () => {};
  const interrupted = new Promise<never>((_resolve, reject) => {
    abortHandler = () =>
      reject(
        new RasterError(
          timedOut ? 'timeout' : 'aborted',
          timedOut ? 'PNG rasterization timed out.' : 'PNG rendering was cancelled.',
        ),
      );
    controller.signal.addEventListener('abort', abortHandler, { once: true });
  });
  const wait = <T>(promise: Promise<T>) => Promise.race([promise, interrupted]);
  let url: string | null = null,
    canvas: HTMLCanvasElement | null = null,
    image: HTMLImageElement | null = null,
    reader: FileReader | null = null,
    stage = 'decode-failed';
  // oxlint-disable-next-line linteffect/no-try-catch -- Native browser resource boundary must release image URL, reader, handlers and canvas on every outcome.
  try {
    url = URL.createObjectURL(new Blob([plan.svg], { type: 'image/svg+xml' }));
    image = new Image();
    image.src = url;
    await wait(image.decode());
    stage = 'canvas-unavailable';
    canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext('2d');
    if (!context) throw new RasterError(stage, 'A 2D canvas context is unavailable.');
    context.drawImage(image, 0, 0, plan.width, plan.height);
    stage = 'encoding-failed';
    const bufferCanvas = canvas;
    const blob = await wait(
      new Promise<Blob>((resolve, reject) =>
        bufferCanvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(
                  new RasterError('encoding-failed', 'The browser returned an empty PNG encoding.'),
                ),
          'image/png',
        ),
      ),
    );
    if (blob.type !== 'image/png' || blob.size < 33 || blob.size > plan.maxBytes)
      throw new RasterError(
        'output-invalid',
        'PNG encoding has an invalid MIME, size or byte budget.',
      );
    const bytes = new Uint8Array(await wait(blob.arrayBuffer())),
      header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (
      signature.some((byte, i) => bytes[i] !== byte) ||
      header.getUint32(8) !== 13 ||
      header.getUint32(12) !== 0x49484452 ||
      header.getUint32(16) !== plan.width ||
      header.getUint32(20) !== plan.height
    )
      throw new RasterError(
        'output-invalid',
        'PNG signature or IHDR dimensions do not match the reviewed output.',
      );
    reader = new FileReader();
    const activeReader = reader;
    const dataUrl = await wait(
      new Promise<string>((resolve, reject) => {
        activeReader.onload = () =>
          // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Native FileReader returns string | ArrayBuffer | null; validate the readAsDataURL result at the IO boundary.
          typeof activeReader.result === 'string'
            ? resolve(activeReader.result)
            : reject(new RasterError('output-invalid', 'PNG data URL could not be read.'));
        activeReader.onerror = () =>
          reject(new RasterError('encoding-failed', 'PNG bytes could not be read.'));
        activeReader.onabort = () =>
          reject(new RasterError('aborted', 'PNG reading was cancelled.'));
        activeReader.readAsDataURL(blob);
      }),
    );
    if (controller.signal.aborted)
      throw new RasterError(timedOut ? 'timeout' : 'aborted', 'PNG rendering interrupted.');
    return {
      type: 'rendered',
      artifact: Object.freeze({
        dataUrl,
        byteLength: blob.size,
        width: plan.width,
        height: plan.height,
      }),
    };
  } catch (error) {
    return error instanceof RasterError
      ? failure(error.code, error.message)
      : failure(stage, 'The browser could not decode, draw or encode the reviewed PNG.');
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener('abort', forward);
    controller.signal.removeEventListener('abort', abortHandler);
    if (reader) {
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      if (reader.readyState === 1) reader.abort();
    }
    if (image) {
      image.onload = null;
      image.onerror = null;
      image.src = '';
    }
    if (url !== null) URL.revokeObjectURL(url);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
/** Browser IO only. Uses the exact reviewed PNG data URL; never rerenders on download. */
export function downloadPngArtifact(artifact: ZlozPngArtifact, fileName: string): void {
  if (
    !/^[^/\\\u0000-\u001f]{1,128}\.png$/iu.test(fileName) ||
    !artifact.dataUrl.startsWith('data:image/png;base64,iVBORw0KGgo')
  )
    throw new ZlozError('invalid-edit', 'Invalid reviewed PNG download.');
  const link = Object.assign(document.createElement('a'), {
    href: artifact.dataUrl,
    download: fileName,
  });
  link.click();
}
