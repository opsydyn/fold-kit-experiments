import {
  serializeEditionsV2,
  serializeModelDocumentV2,
  parseEditions,
  parseModelDocument,
} from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { ReadHistoryFile, byteLimit } from '../src/history-workbench/command';
import { Message } from '../src/history-workbench/message';
import { initialDocument } from '../src/history-workbench/state';

test('v2 read Commands decode bounded UTF-8 model/archive data and v1 readers reject their envelopes', async () => {
  const document = initialDocument();
  const modelText = serializeModelDocumentV2(document);
  const editionsText = serializeEditionsV2(document.editions);
  const loaded = await Effect.runPromise(
    ReadHistoryFile({ token: 1, kind: 'model', file: new File([modelText], 'v2-model.json') })
      .effect,
  );
  expect(loaded._tag).toBe('SucceededModelRead');
  const archive = await Effect.runPromise(
    ReadHistoryFile({
      token: 2,
      kind: 'archive',
      file: new File([editionsText], 'v2-editions.json'),
    }).effect,
  );
  expect(archive._tag).toBe('SucceededArchiveRead');
  expect(() => parseModelDocument(modelText)).toThrow();
  expect(() => parseEditions(editionsText)).toThrow();
});

test('file Commands reject excessive size before reading and fail invalid UTF-8/versions without a partial result', async () => {
  let reads = 0;
  class Oversized extends File {
    override arrayBuffer() {
      reads++;
      return super.arrayBuffer();
    }
  }
  const file = new Oversized([' '.repeat(byteLimit + 1)], 'large.json');
  expect(
    await Effect.runPromise(ReadHistoryFile({ token: 3, kind: 'model', file }).effect),
  ).toEqual(Message.FailedRead({ token: 3 }));
  expect(reads).toBe(0);
  for (const bytes of [
    new Uint8Array([255]),
    new TextEncoder().encode('{"format":"foldkit-zloz-model","version":1,"document":{}}'),
    new TextEncoder().encode('{bad'),
  ]) {
    expect(
      await Effect.runPromise(
        ReadHistoryFile({ token: 4, kind: 'model', file: new File([bytes], 'invalid.json') })
          .effect,
      ),
    ).toEqual(Message.FailedRead({ token: 4 }));
  }
});
