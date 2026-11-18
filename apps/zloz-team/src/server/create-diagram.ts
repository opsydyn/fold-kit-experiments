import { parseGraph, serializeGraph } from '@opsydyn/foldkit-zloz';
import { BodyRejected } from '@opsydyn/zloz-server/src/http-body';
import { Data, Schema } from 'effect';

import { forward } from './backend';
import { boundedFormData } from './form-data';

class CreationFormRejected extends Data.TaggedError('CreationFormRejected') {}

/** Bound multipart bytes before parsing files. IDs survive a failed form submission. */
export async function createDiagram(request: Request, teamId: string) {
  let id: string = crypto.randomUUID();
  let name = '';
  let graphText = '';
  if (request.method !== 'POST') return { id, name, graphText, error: '', status: 200 };
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return { id, name, graphText, error: 'This request came from another site.', status: 403 };
  try {
    const form = await boundedFormData(request, 1_048_576);
    id = Schema.decodeUnknownSync(
      Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/))),
    )(form.get('creationId'));
    name = String(form.get('name') ?? '').trim();
    if (!name || name.length > 120) throw new CreationFormRejected();
    const file = form.get('file');
    graphText =
      file instanceof File && file.size
        ? await file.text()
        : String(form.get('graph') ?? '').trim();
    const graph = graphText ? parseGraph(graphText) : { nodes: [], edges: [] };
    const response = await forward(
      new Request(new URL(`/api/zloz/diagrams/${teamId}/${id}`, request.url), {
        method: 'POST',
        headers: {
          origin: new URL(request.url).origin,
          cookie: request.headers.get('cookie') ?? '',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ operationId: id, name, graph: JSON.parse(serializeGraph(graph)) }),
      }),
    );
    if (!response.ok)
      return {
        id,
        name,
        graphText,
        error:
          response.status === 403
            ? 'Your role does not allow creating diagrams.'
            : 'Creation did not finish. Keep this form and retry to recover the same diagram.',
        status: response.status,
      };
    return { id, name, graphText, error: '', status: 303 };
  } catch (error) {
    return {
      id,
      name,
      graphText,
      error: 'Enter a name and a valid exported Zloz graph (up to 250 nodes and 500 edges).',
      status: error instanceof BodyRejected ? error.status : 400,
    };
  }
}
