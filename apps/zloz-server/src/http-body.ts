import { Data } from 'effect';

export class BodyRejected extends Data.TaggedError('BodyRejected')<{ status: number }> {}

/** Native HTTP boundary: cap bytes before decoding or parsing either form or JSON. */
export async function bodyText(request: Request, limit = 8192): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new BodyRejected({ status: 413 });
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
