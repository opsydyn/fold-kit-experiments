import { parseDiagramCheckpoint } from '@opsydyn/foldkit-zloz-alchemy/checkpoint';
import type { DiagramCheckpoint } from '@opsydyn/foldkit-zloz-alchemy/checkpoint';
import { BodyRejected } from '@opsydyn/zloz-server/src/http-body';
import { Schema } from 'effect';

import { forward } from './backend';
import { boundedFormData } from './form-data';

export interface RecoveryPreview {
  readonly checkpoint: DiagramCheckpoint;
  readonly text: string;
  readonly expectedVersion: number;
  readonly operationId: string;
}
export interface RecoveryPage {
  readonly status: number;
  readonly message: string;
  readonly preview: RecoveryPreview | null;
  readonly applied: boolean;
}
const Version = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
  ),
);
const Id = Schema.String.pipe(Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,128}$/)));
export async function recoveryPage(
  request: Request,
  teamId: string,
  diagramId: string,
): Promise<RecoveryPage> {
  const path = `/api/zloz/diagrams/${teamId}/${diagramId}`;
  const empty = { status: 200, message: '', preview: null, applied: false };
  const currentResponse = await forward(
    new Request(new URL(`${path}/checkpoint`, request.url), {
      headers: { cookie: request.headers.get('cookie') ?? '' },
    }),
  );
  if (!currentResponse.ok)
    return {
      ...empty,
      status: currentResponse.status,
      message: 'Checkpoint recovery requires current owner access.',
    };
  if (request.method !== 'POST') {
    await currentResponse.body?.cancel();
    return empty;
  }
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return { ...empty, status: 403, message: 'This request came from another site.' };
  let preview: RecoveryPreview | null = null;
  try {
    const current = await parseDiagramCheckpoint(await currentResponse.text());
    const form = await boundedFormData(request, 2_097_152);
    const file = form.get('file');
    const text =
      file instanceof File && file.size ? await file.text() : String(form.get('checkpoint') ?? '');
    const checkpoint = await parseDiagramCheckpoint(text);
    if (checkpoint.target.teamId !== teamId || checkpoint.target.diagramId !== diagramId)
      return { ...empty, status: 400, message: 'This checkpoint belongs to another diagram.' };
    const action = form.get('action');
    preview = {
      checkpoint,
      text: JSON.stringify(checkpoint),
      expectedVersion: current.documentVersion,
      operationId: crypto.randomUUID(),
    };
    if (action === 'preview') return { ...empty, preview };
    if (action !== 'apply')
      return { ...empty, status: 400, message: 'Choose Preview before applying recovery.' };
    preview = {
      ...preview,
      operationId: Schema.decodeUnknownSync(Id)(form.get('operationId')),
      expectedVersion: Schema.decodeUnknownSync(Version)(
        form.has('expectedVersion') && String(form.get('expectedVersion')).trim()
          ? Number(form.get('expectedVersion'))
          : null,
      ),
    };
    const response = await forward(
      new Request(new URL(`${path}/restore`, request.url), {
        method: 'POST',
        headers: {
          origin: new URL(request.url).origin,
          cookie: request.headers.get('cookie') ?? '',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          operationId: preview.operationId,
          expectedVersion: preview.expectedVersion,
          checkpoint,
        }),
      }),
    );
    if (!response.ok)
      return {
        ...empty,
        preview,
        status: response.status,
        message:
          'Recovery outcome is unknown. Retry Apply with this same preview, or inspect the current diagram.',
      };
    const result = Schema.decodeUnknownSync(
      Schema.Struct({
        status: Schema.Literals(['restored', 'conflict', 'unchanged']),
        documentVersion: Version,
      }),
    )(await response.json());
    if (result.status === 'conflict')
      return {
        ...empty,
        preview,
        status: 409,
        message: 'The diagram changed after this preview. Review a new preview before applying.',
      };
    return {
      ...empty,
      applied: true,
      message:
        result.status === 'unchanged'
          ? 'The graph already matches this checkpoint.'
          : `Recovered as version ${result.documentVersion}.`,
    };
  } catch (error) {
    return {
      ...empty,
      preview,
      status: error instanceof BodyRejected ? error.status : 400,
      message:
        'Choose a valid checkpoint file under 2 MiB. Its target and integrity digest must match.',
    };
  }
}
