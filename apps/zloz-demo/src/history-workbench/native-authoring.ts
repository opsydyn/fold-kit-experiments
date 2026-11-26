import { Command } from '@effect/ui';
import {
  captureConnectionDocument,
  captureModelDocumentV2,
  captureModellingPatchV2,
  parseModellingPatchV2,
  resolveModellingPatchReviewV2,
  applyModellingPatchV2,
  parseModellingPatchReceiptV2,
  serializeModellingPatchReceiptV2,
  parseEventStormingC4ConversionV2,
  parseEventStormingDddConversionV2,
  createHistoryReviewV2,
  ZlozError,
  compareModelDddRelationshipsV2,
  compareModelEventStormingRelationshipsV2,
  type ZlozModellingPatchV2,
  type ZlozModellingPatchReceiptV2,
  type ZlozConnectionDocument,
  type ZlozHistoryReviewV2,
  type EditorState,
} from '@opsydyn/foldkit-zloz';
import { createReviewPacketV2, openReviewPacketV2 } from '@opsydyn/foldkit-zloz-mermaid';
import { Result } from 'effect';

import {
  ReadNativeFile,
  DownloadNative,
  nativeByteLimit,
  CreateNativeSession,
} from './native-command';
export { nativeByteLimit } from './native-command';
import type { Model } from './state';
export type ArtifactKind = 'proposal' | 'receipt' | 'packet';
export type Inspection = Readonly<{
  text: string;
  title: string;
  before: ZlozConnectionDocument;
  after: ZlozConnectionDocument;
  side: 'baseline' | 'selected';
  review: ZlozHistoryReviewV2;
}>;
export type NativeState = Readonly<{
  sessionId: string | null;
  text: string;
  patch: ZlozModellingPatchV2 | null;
  consent: Readonly<{ key: string; reviewed: boolean; lossesAccepted: boolean }> | null;
  receipts: readonly ZlozModellingPatchReceiptV2[];
  protected: boolean;
  packetConsent: string | null;
  inspection: Inspection | null;
  sequence: number;
  pending: Readonly<{ token: number; epoch: number; revision: number; kind: ArtifactKind }> | null;
  notice: string;
}>;
export function nativeInitial(): NativeState {
  return {
    sessionId: null,
    text: '',
    patch: null,
    consent: null,
    receipts: [],
    protected: false,
    packetConsent: null,
    inspection: null,
    sequence: 0,
    pending: null,
    notice: '',
  };
}
export function nativeDocument(model: Model) {
  return captureModelDocumentV2({
    ...model.identity,
    editions: model.editions,
    snapshot: captureConnectionDocument(model.editor),
  });
}
export function nativeSource(model: Model) {
  return {
    modelId: model.identity.id,
    sessionId: `${model.native.sessionId ?? 'initializing'}/${model.identity.id}/${model.epoch}`,
    revision: model.editor.revision,
    connectionMode: model.editor.connectionMode ?? 'strict',
    graph: model.editor.graph,
  };
}
export function nativeBlocked(model: Model): string | null {
  if (!model.native.sessionId)
    return 'Initialize the authoring session before reviewing or applying proposals.';
  return model.editor.gesture.type !== 'idle' ||
    model.editor.connection !== null ||
    model.editor.edgeLabelDraft !== null ||
    model.editor.fitViewTransition.type !== 'idle'
    ? 'Finish active editor work before authoring or opening artifacts.'
    : model.native.pending
      ? 'Finish or cancel the artifact read.'
      : model.reading
        ? 'Finish the model/archive read.'
        : model.native.inspection || model.review
          ? 'Return to the working model before authoring.'
          : model.preview
            ? 'Finish the restore preview.'
            : model.playback.cursor.status === 'playing'
              ? 'Pause playback before authoring.'
              : model.section !== 'authoring' && model.section !== 'evidence'
                ? 'Open Authoring or Portable review first.'
                : null;
}
export function nativeReview(model: Model) {
  // oxlint-disable-next-line linteffect/no-return-null -- The host's optional decoded proposal has no review until a strict decoder succeeds.
  if (!model.native.patch) return null;
  return resolveModellingPatchReviewV2(model.editor, nativeSource(model), model.native.patch, {
    consent: nativeConsent(model),
    blockedReason:
      nativeBlocked(model) ?? (model.native.protected ? 'Patch Apply is protected.' : null),
    policy: {
      canChangeNodeAppearance: () =>
        model.native.protected ? 'Node appearance is protected.' : null,
    },
  });
}
function nativeConsent(model: Model) {
  const consent = model.native.consent;
  return consent?.reviewed && consent.lossesAccepted
    ? { key: consent.key, reviewed: true as const, lossesAccepted: true as const }
    : null;
}
export function nativeAudits(model: Model) {
  const document = nativeDocument(model),
    selection = { baselineId: model.baselineId };
  return {
    ddd: compareModelDddRelationshipsV2(document, selection),
    workshop: compareModelEventStormingRelationshipsV2(document, selection),
  };
}
export function nativePacket(model: Model) {
  return createReviewPacketV2(
    nativeDocument(model),
    { baselineId: model.baselineId },
    { lossPolicy: 'report' },
  );
}
export function nativePacketKey(model: Model): string {
  return JSON.stringify({
    source: nativeSource(model),
    document: nativeDocument(model),
    baselineId: model.baselineId,
  });
}
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Result.try supplies an unknown thrown value; only the package's typed domain error is recovered.
function errorMessage(error: unknown): string {
  if (error instanceof ZlozError) return error.message;
  throw error;
}
function inspection(
  text: string,
  title: string,
  before: ZlozConnectionDocument,
  after: ZlozConnectionDocument,
  present: EditorState,
  side: 'baseline' | 'selected',
): Inspection {
  return {
    text,
    title,
    before,
    after,
    side,
    review: createHistoryReviewV2(
      { id: `artifact:${side}`, name: title, snapshot: side === 'baseline' ? before : after },
      present,
    ),
  };
}
export function nativeArtifact(
  kind: 'receipt' | 'packet',
  text: string,
  present: EditorState,
  side: 'baseline' | 'selected',
):
  | Readonly<{ type: 'opened'; inspection: Inspection }>
  | Readonly<{ type: 'rejected'; reason: string }> {
  if (new TextEncoder().encode(text).length > nativeByteLimit)
    return { type: 'rejected', reason: 'Artifacts are limited to 1 MiB.' };
  if (kind === 'packet') {
    const opened = openReviewPacketV2(text, side, present);
    if (opened.status !== 'opened') return { type: 'rejected', reason: opened.reason };
    return {
      type: 'opened',
      inspection: inspection(
        text,
        `Review packet: ${opened.packet.model.name}`,
        opened.packet.baseline.snapshot,
        opened.packet.selected.snapshot,
        present,
        side,
      ),
    };
  }
  const patch = Result.try({ try: () => parseModellingPatchReceiptV2(text), catch: errorMessage });
  if (Result.isSuccess(patch)) {
    const receipt = patch.success;
    return {
      type: 'opened',
      inspection: inspection(
        text,
        `Patch receipt: ${receipt.patch.provenance.reason}`,
        {
          version: 2,
          connectionMode: receipt.patch.source.connectionMode,
          graph: receipt.patch.source.graph,
        },
        receipt.snapshot,
        present,
        side,
      ),
    };
  }
  const c4 = Result.try({ try: () => parseEventStormingC4ConversionV2(text), catch: errorMessage });
  if (Result.isSuccess(c4))
    return {
      type: 'opened',
      inspection: inspection(
        text,
        'C4 conversion receipt',
        c4.success.source.document.snapshot,
        c4.success.document.snapshot,
        present,
        side,
      ),
    };
  const ddd = Result.try({
    try: () => parseEventStormingDddConversionV2(text),
    catch: errorMessage,
  });
  if (Result.isSuccess(ddd))
    return {
      type: 'opened',
      inspection: inspection(
        text,
        'DDD conversion receipt',
        ddd.success.source.document.snapshot,
        ddd.success.document.snapshot,
        present,
        side,
      ),
    };
  return {
    type: 'rejected',
    reason: 'Invalid v2 patch, C4 or DDD receipt. No working data changed.',
  };
}
function reviewedText(model: Model, text: string): Model {
  if (new TextEncoder().encode(text).length > nativeByteLimit)
    return {
      ...model,
      native: { ...model.native, patch: null, consent: null, notice: 'Proposal exceeds 1 MiB.' },
    };
  const parsed = parseModellingPatchV2(text);
  return {
    ...model,
    native: {
      ...model.native,
      text,
      consent: null,
      patch: parsed.status === 'parsed' ? parsed.value : null,
      notice:
        parsed.status === 'parsed'
          ? 'Proposal decoded. Review its exact source, changes and losses.'
          : parsed.reason,
    },
  };
}
export function nativeHandlers(model: Model) {
  const notice = (text: string) => ({
    model: { ...model, native: { ...model.native, notice: text } },
  });
  return {
    ClickedStartNativeSession: () =>
      model.native.sessionId ? { model } : { model, commands: [CreateNativeSession.make({})] },
    SucceededNativeSession: ({ id }: { id: string }) =>
      model.native.sessionId || !id.trim()
        ? { model }
        : { model: { ...model, native: { ...model.native, sessionId: id, consent: null } } },
    FailedNativeSession: () =>
      model.native.sessionId
        ? { model }
        : notice('Could not initialize the authoring session. Retry before applying proposals.'),
    ChangedProposalText: ({ text }: { text: string }) => ({
      model: {
        ...model,
        native: { ...model.native, text, patch: null, consent: null, notice: '' },
      },
    }),
    ClickedExampleProposal: () => {
      const blocked = nativeBlocked(model);
      if (blocked) return notice(blocked);
      const node = model.editor.graph.nodes[0];
      if (!node) return notice('Add a node before creating a rename proposal.');
      const attempt = Result.try({
        try: () =>
          captureModellingPatchV2({
            format: 'foldkit-zloz-patch',
            version: 2,
            id: `rename-${model.editor.revision}`,
            source: nativeSource(model),
            provenance: {
              actor: { kind: 'human', id: 'workbench-example' },
              reason: 'Review the Orders label',
              references: [],
            },
            operations: [
              { id: 'rename', type: 'node.replace', node: { ...node, label: 'Orders — reviewed' } },
            ],
          }),
        catch: errorMessage,
      });
      if (Result.isFailure(attempt)) return notice(attempt.failure);
      const text = JSON.stringify(attempt.success, null, 2);
      if (new TextEncoder().encode(text).length > nativeByteLimit)
        return notice(
          'Example proposal exceeds 1 MiB. Use a smaller model or a focused external proposal.',
        );
      return {
        model: {
          ...model,
          native: {
            ...model.native,
            text,
            patch: null,
            consent: null,
            notice: 'Example proposal prepared. Review before Apply.',
          },
        },
      };
    },
    ClickedReviewProposal: () => ({ model: reviewedText(model, model.native.text) }),
    ClickedPatchAcknowledgement: ({ part }: { part: 'reviewed' | 'lossesAccepted' }) => {
      const review = nativeReview(model);
      if (!review?.key || review.reason)
        return notice(review?.reason ?? 'Review a valid proposal first.');
      const previous = model.native.consent?.key === review.key ? model.native.consent : null;
      return {
        model: {
          ...model,
          native: {
            ...model.native,
            consent: {
              key: review.key,
              reviewed: previous?.reviewed ?? false,
              lossesAccepted: previous?.lossesAccepted ?? false,
              [part]: !(previous?.[part] ?? false),
            },
          },
        },
      };
    },
    ClickedApplyProposal: ({ key }: { key: string }) => {
      const review = nativeReview(model);
      if (!review?.canApply || key !== review.key || !model.native.patch)
        return notice(review?.reason ?? 'Review and acknowledge this exact proposal first.');
      const patch = model.native.patch;
      const attempt = Result.try({
        try: () =>
          applyModellingPatchV2(model.editor, nativeSource(model), patch, {
            consent: nativeConsent(model),
            blockedReason: nativeBlocked(model),
            policy: {
              canChangeNodeAppearance: () =>
                model.native.protected ? 'Node appearance is protected.' : null,
            },
          }),
        catch: errorMessage,
      });
      if (Result.isFailure(attempt)) return notice(attempt.failure);
      const result = attempt.success;
      if (result.type !== 'applied')
        return notice(result.type === 'blocked' ? result.reason : 'No authored changes.');
      return {
        model: {
          ...model,
          editor: result.editor,
          preview: null,
          native: {
            ...model.native,
            consent: null,
            receipts: [...model.native.receipts, result.receipt],
            notice: 'Applied with one Undo. Editor and receipt retained together.',
          },
        },
      };
    },
    ClickedPatchProtection: () => ({
      model: {
        ...model,
        native: { ...model.native, protected: !model.native.protected, consent: null },
      },
    }),
    ClickedPacketAcceptance: () => ({
      model: {
        ...model,
        native: {
          ...model.native,
          packetConsent:
            model.native.packetConsent === nativePacketKey(model) ? null : nativePacketKey(model),
        },
      },
    }),
    SelectedPacketBaseline: ({ id }: { id: string }) =>
      model.editions.some((e) => e.id === id) && !model.native.pending && !model.native.inspection
        ? { model: { ...model, baselineId: id, native: { ...model.native, packetConsent: null } } }
        : { model },
    ClickedDownloadNative: ({ kind }: { kind: ArtifactKind }) => {
      let text: string;
      if (kind === 'proposal') {
        if (!model.native.patch)
          return notice('Decode and review the proposal before downloading.');
        text = JSON.stringify(model.native.patch, null, 2);
      } else if (kind === 'receipt') {
        const receipt = model.native.receipts.at(-1);
        if (!receipt) return notice('Apply a proposal to retain a receipt first.');
        text = serializeModellingPatchReceiptV2(receipt);
      } else {
        const packet = nativePacket(model);
        if (packet.status !== 'created')
          return notice(packet.diagnostics.map((d) => d.message).join(' '));
        if (model.native.packetConsent !== nativePacketKey(model))
          return notice('Review and explicitly accept the current packet projection losses.');
        text = JSON.stringify(packet.value);
      }
      if (new TextEncoder().encode(text).length > nativeByteLimit)
        return notice('Artifact exceeds the 1 MiB download/reopening limit.');
      return { model, commands: [DownloadNative.make({ text, kind })] };
    },
    ChoseNativeFile: ({ kind, files: raw }: { kind: ArtifactKind; files: unknown }) => {
      // SAFETY: OnFileChange supplies browser Files; the Command checks size before reading.
      const file = (raw as FileList | readonly File[] | null)?.[0];
      if (!file) return { model };
      const blocked = nativeBlocked(model);
      if (blocked) return notice(blocked);
      if (model.editor.gesture.type !== 'idle' || model.editor.connection)
        return notice('Finish active editor work before reading.');
      const token = model.native.sequence + 1;
      return {
        model: {
          ...model,
          native: {
            ...model.native,
            sequence: token,
            consent: null,
            pending: { token, epoch: model.epoch, revision: model.editor.revision, kind },
            notice: 'Reading artifact…',
          },
        },
        commands: [ReadNativeFile.make({ token, file })],
      };
    },
    SucceededNativeRead: ({ token, text }: { token: number; text: string }) => {
      const pending = model.native.pending;
      if (!pending || pending.token !== token) return { model };
      const next = { ...model, native: { ...model.native, pending: null } };
      if (pending.epoch !== model.epoch || pending.revision !== model.editor.revision)
        return {
          model: {
            ...next,
            native: {
              ...next.native,
              notice: 'Working source changed during read. Artifact not opened.',
            },
          },
        };
      if (pending.kind === 'proposal') return { model: reviewedText(next, text) };
      const opened = nativeArtifact(pending.kind, text, model.editor, 'selected');
      return {
        model: {
          ...next,
          epoch: opened.type === 'opened' ? model.epoch + 1 : model.epoch,
          native: {
            ...next.native,
            inspection: opened.type === 'opened' ? opened.inspection : next.native.inspection,
            consent: null,
            notice:
              opened.type === 'opened'
                ? 'Read-only evidence. Recorded acceptance grants no Apply permission.'
                : opened.reason,
          },
        },
      };
    },
    FailedNativeRead: ({ token, reason }: { token: number; reason: string }) =>
      model.native.pending?.token !== token
        ? { model }
        : { model: { ...model, native: { ...model.native, pending: null, notice: reason } } },
    ClickedCancelNativeRead: () => ({
      commands: model.native.pending
        ? [Command.interrupt(ReadNativeFile, { token: model.native.pending.token })]
        : [],
      model: {
        ...model,
        native: { ...model.native, pending: null, notice: 'Read cancelled. Late results ignored.' },
      },
    }),
    SelectedNativeSide: ({ side }: { side: 'baseline' | 'selected' }) => {
      const current = model.native.inspection;
      if (!current) return { model };
      return {
        model: {
          ...model,
          epoch: model.epoch + 1,
          native: {
            ...model.native,
            inspection: inspection(
              current.text,
              current.title,
              current.before,
              current.after,
              model.editor,
              side,
            ),
          },
        },
      };
    },
    ClickedCloseNativeReview: () => ({
      model: {
        ...model,
        epoch: model.epoch + 1,
        native: {
          ...model.native,
          inspection: null,
          pending: null,
          consent: null,
          notice: 'Returned to working model. Undo preserved.',
        },
      },
    }),
    CompletedNativeDownload: () => notice('Validated artifact downloaded.'),
    FailedNativeDownload: () =>
      notice('Download failed. Working model and retained receipts are unchanged.'),
  };
}
