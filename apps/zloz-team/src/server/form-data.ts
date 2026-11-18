import { BodyRejected } from '@opsydyn/zloz-server/src/http-body';

/** Bound multipart bytes before the platform parses uploaded files. */
export async function boundedFormData(request: Request, limit: number): Promise<FormData> {
  const reader = request.body?.getReader();
  if (!reader) throw new BodyRejected({ status: 400 });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new BodyRejected({ status: 413 });
      }
      chunks.push(new Uint8Array(chunk.value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(new Blob(chunks), {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  }).formData();
}
