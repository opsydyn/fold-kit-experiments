import { expect, test } from 'bun:test';

import { createReviewPacketV2 } from '@opsydyn/foldkit-zloz-mermaid';
import { Effect } from 'effect';

import c4 from '../../../packages/foldkit-zloz/test/fixtures/c4-conversion-v2.json';
import ddd from '../../../packages/foldkit-zloz/test/fixtures/ddd-conversion-v2.json';
import {
  nativeArtifact,
  nativeDocument,
  nativePacketKey,
} from '../src/history-workbench/native-authoring';
import {
  ReadNativeFile,
  nativeByteLimit,
  CreateNativeSession,
} from '../src/history-workbench/native-command';
import { init, update, Message } from '../src/history-workbench/state';

test('native file command rejects oversized input before reading and invalid UTF-8 without a partial artifact', async () => {
  let reads = 0;
  class Oversized extends File {
    override arrayBuffer() {
      reads++;
      return super.arrayBuffer();
    }
  }
  const big = new Oversized([' '.repeat(nativeByteLimit + 1)], 'large.json');
  const rejected = await Effect.runPromise(ReadNativeFile({ token: 7, file: big }).effect);
  expect(rejected._tag).toBe('FailedNativeRead');
  expect(reads).toBe(0);
  const invalid = await Effect.runPromise(
    ReadNativeFile({ token: 8, file: new File([new Uint8Array([255])], 'bad.json') }).effect,
  );
  expect(invalid._tag).toBe('FailedNativeRead');
  const valid = await Effect.runPromise(
    ReadNativeFile({ token: 9, file: new File(['{"version":2}'], 'wire.json') }).effect,
  );
  expect(valid).toEqual(Message.SucceededNativeRead({ token: 9, text: '{"version":2}' }));
});

test('C4 and DDD v2 receipts reopen through their strict decoders with detached mode-preserving snapshots', () => {
  const model = init().model;
  for (const wire of [c4, ddd]) {
    const opened = nativeArtifact('receipt', JSON.stringify(wire), model.editor, 'selected');
    expect(opened.type).toBe('opened');
    if (opened.type !== 'opened') return;
    expect(opened.inspection.review.editor.readOnly).toBe(true);
    expect(opened.inspection.review.editor.past).toHaveLength(0);
    expect(opened.inspection.review.editor.connectionMode).toBe(
      opened.inspection.after.connectionMode,
    );
  }
});

test('packet download needs current explicit loss consent; reopening does not grant working authority', () => {
  const model = update(init().model, Message.SelectedSection({ section: 'evidence' })).model;
  expect(update(model, Message.ClickedDownloadNative({ kind: 'packet' })).commands).toBeUndefined();
  const accepted = update(model, Message.ClickedPacketAcceptance()).model;
  expect(accepted.native.packetConsent).toBe(nativePacketKey(model));
  expect(update(accepted, Message.ClickedDownloadNative({ kind: 'packet' })).commands).toHaveLength(
    1,
  );
  const edited = update(
    accepted,
    Message.ObservedEditor({
      epoch: accepted.epoch,
      event: { type: 'NodeLabelChanged', id: 'a', label: 'New' },
    }),
  ).model;
  expect(
    update(edited, Message.ClickedDownloadNative({ kind: 'packet' })).commands,
  ).toBeUndefined();
  const packet = createReviewPacketV2(
    nativeDocument(accepted),
    { baselineId: accepted.baselineId },
    { lossPolicy: 'report' },
  );
  expect(packet.status).toBe('created');
  if (packet.status !== 'created') return;
  const text = JSON.stringify(packet.value);
  expect(nativeArtifact('packet', text, model.editor, 'baseline').type).toBe('opened');
  expect(
    nativeArtifact(
      'packet',
      text.replace('"version":2', '"version":2,"version":2'),
      model.editor,
      'baseline',
    ).type,
  ).toBe('rejected');
  expect(model.editor.past).toHaveLength(0);
});

test('runtime Commands issue distinct page-session identities without external mutable state', async () => {
  const first = await Effect.runPromise(CreateNativeSession().effect);
  const second = await Effect.runPromise(CreateNativeSession().effect);
  expect(first._tag).toBe('SucceededNativeSession');
  expect(second._tag).toBe('SucceededNativeSession');
  if (first._tag !== 'SucceededNativeSession' || second._tag !== 'SucceededNativeSession') return;
  expect(first.id).not.toBe(second.id);
  expect(first.id.length).toBeGreaterThan(0);
});
