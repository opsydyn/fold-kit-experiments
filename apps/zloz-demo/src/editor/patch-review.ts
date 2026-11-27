import type { Html } from '@effect/ui/html';
import {
  ZlozError,
  type ZlozModellingPatchReview,
  captureModellingPatch,
  parseModellingPatch,
  resolveModellingPatchReview,
  resolveModellingPatchAcknowledgement,
  applyModellingPatch,
  type ZlozModellingPatch,
  type ZlozModellingPatchConsent,
  type ZlozModellingPatchReceipt,
  type ZlozModellingPatchReviewRequest,
} from '@opsydyn/foldkit-zloz';
import { modellingPatchReview } from '@opsydyn/foldkit-zloz/effect-ui';
import { Match, Result } from 'effect';

import { ReadPatchFile, DownloadPatchArtifact } from './command';
import { workbenchPolicy } from './editor-policy';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { architectureNativePanel } from './native-panel';
import { settingCheckbox } from './native-settings';
import { packetReviewActive } from './packet-reader';
import type { Return } from './transition';
export type PatchWorkbenchState = Readonly<{
  scope: string;
  run: number;
  pending: Readonly<{ run: number; revision: number }> | null;
  patch: ZlozModellingPatch | null;
  consent: ZlozModellingPatchConsent | null;
  receipts: readonly ZlozModellingPatchReceipt[];
  notice: string;
  protected: boolean;
  custom: boolean;
}>;
export function patchWorkbenchState(model: Model): PatchWorkbenchState {
  const scope = `${model.modelIdentity.id}/${model.modelEpoch}`,
    state = model.patchWorkbench;
  return state.scope === scope
    ? state
    : { ...state, scope, pending: null, patch: null, consent: null, notice: '' };
}
function openReason(model: Model): string | null {
  return model.sidebarSection !== 'patch' || model.sidebarCollapsed
    ? 'Show Patch review before opening a proposal.'
    : model.receiptReview ||
        model.receiptRead ||
        packetReviewActive(model) ||
        model.historyReview ||
        model.historyPlayback?.cursor.status === 'playing'
      ? 'Return to the working model and finish other reviews first.'
      : modelSessionBusy(model) || model.placement.type !== 'idle'
        ? 'Finish active edits, imports or layout before reviewing a patch.'
        : null;
}
export function patchWorkbenchReview(model: Model): ZlozModellingPatchReview | null {
  const state = patchWorkbenchState(model);
  // oxlint-disable-next-line linteffect/no-return-null -- This optional host view follows the existing nullable proposal Model contract.
  if (!state.patch) return null;
  const patch = state.patch;
  const attempt = Result.try({
    try: () =>
      resolveModellingPatchReview(
        model.editor,
        { modelId: model.modelIdentity.id, sessionId: state.scope },
        patch,
        {
          consent: state.consent,
          policy: workbenchPolicy(model),
          blockedReason: state.protected
            ? 'Patch Apply is protected.'
            : state.pending
              ? 'Finish or cancel the patch file read.'
              : openReason(model),
        },
      ),
    catch: (error) => {
      if (error instanceof ZlozError) return error.message;
      throw error;
    },
  });
  if (Result.isSuccess(attempt)) return attempt.success;
  return {
    preview: {
      type: 'rejected',
      findings: [
        {
          code: 'invalid-patch',
          severity: 'error',
          message: attempt.failure,
          path: '/source',
          operationId: null,
        },
      ],
    },
    key: null,
    reason: attempt.failure,
    acknowledged: false,
    canApply: false,
  };
}
const receiptId = (receipt: ZlozModellingPatchReceipt) =>
  `${receipt.patch.source.sessionId}:${receipt.revision}`;
const patchMessages = new Set([
  'ChosePatchFiles',
  'SucceededPatchRead',
  'FailedPatchRead',
  'ClickedPatchReadCancel',
  'ClickedPatchExample',
  'ClickedPatchProtection',
  'ClickedCustomPatchControls',
  'ObservedPatchReviewInput',
  'ClickedPatchDownload',
  'CompletedPatchDownload',
  'FailedPatchDownload',
]);
export function isPatchWorkbenchMessage(message: Message) {
  return patchMessages.has(message._tag);
}
export function updatePatchWorkbench(model: Model, message: Message): Return<Model, Message> {
  const state = patchWorkbenchState(model);
  const set = (next: PatchWorkbenchState): Return<Model, Message> => ({
    model: { ...model, patchWorkbench: next },
  });
  if ('scope' in message && message.scope !== state.scope) return { model };
  return Match.value(message).pipe(
    Match.tag('ClickedPatchProtection', (message) => {
      return set({ ...state, protected: !state.protected });
    }),
    Match.tag('ClickedCustomPatchControls', (message) => {
      return set({ ...state, custom: !state.custom });
    }),
    Match.tag('ClickedPatchExample', (message) => {
      const reason = openReason(model);
      if (reason) return set({ ...state, notice: reason });
      const node = model.editor.graph.nodes[0];
      if (!node) return set({ ...state, notice: 'Add a node before creating a proposal.' });
      const prepared = Result.try({
        try: () =>
          captureModellingPatch({
            format: 'foldkit-zloz-patch',
            version: 1,
            id: `workbench-patch-${state.run + 1}`,
            source: {
              modelId: model.modelIdentity.id,
              sessionId: state.scope,
              revision: model.editor.revision,
              graph: model.editor.graph,
            },
            provenance: {
              actor: { kind: 'human', id: 'workbench-reviewer' },
              reason: 'Clarify a node label after explicit review.',
              references: [],
            },
            operations: [
              {
                id: 'clarify-label',
                type: 'node.replace',
                node: { ...node, label: node.label + ' · reviewed' },
              },
            ],
          }),
        catch: (error) => {
          if (error instanceof ZlozError) return error.message;
          throw error;
        },
      });
      if (Result.isFailure(prepared))
        return set({ ...state, notice: prepared.failure + ' Previous proposal preserved.' });
      const patch = prepared.success;
      return set({
        ...state,
        run: state.run + 1,
        pending: null,
        patch,
        consent: null,
        notice: 'Proposal created from the current source. Working graph unchanged.',
      });
    }),
    Match.tag('ChosePatchFiles', (message) => {
      const reason = openReason(model),
        file = message.files[0];
      if (reason) return set({ ...state, notice: reason });
      if (message.files.length !== 1 || !file || file.size > 1048576)
        return set({
          ...state,
          notice: 'Choose one patch JSON file within 1 MiB. Previous proposal preserved.',
        });
      const run = state.run + 1;
      return {
        model: {
          ...model,
          patchWorkbench: {
            ...state,
            run,
            pending: { run, revision: model.editor.revision },
            notice: 'Reading patch…',
          },
        },
        commands: [ReadPatchFile.make({ scope: state.scope, run, file, maxBytes: 1048576 })],
      };
    }),
    Match.tag('ClickedPatchReadCancel', (message) => {
      return state.pending?.run === message.run
        ? set({ ...state, pending: null, notice: 'Read cancelled. Previous proposal preserved.' })
        : { model };
    }),
    Match.tag('SucceededPatchRead', 'FailedPatchRead', (message) => {
      if (state.pending?.run !== message.run) return { model };
      if (message._tag === 'FailedPatchRead')
        return set({
          ...state,
          pending: null,
          notice: 'Could not read bounded UTF-8 patch. Previous proposal preserved.',
        });
      const reason = openReason(model);
      if (reason || state.pending.revision !== model.editor.revision)
        return set({
          ...state,
          pending: null,
          notice: reason ?? 'Working graph changed while reading. Previous proposal preserved.',
        });
      const parsed = parseModellingPatch(message.json);
      return parsed.status === 'parsed'
        ? set({
            ...state,
            pending: null,
            patch: parsed.value,
            consent: null,
            notice: 'Patch decoded. Inspect the live dry run before Apply.',
          })
        : set({
            ...state,
            pending: null,
            notice: `${parsed.code} at ${parsed.path || '/'}: ${parsed.reason} Previous proposal preserved.`,
          });
    }),
    Match.tag('ObservedPatchReviewInput', (message) => {
      const review = patchWorkbenchReview(model);
      if (!review || !state.patch) return { model };
      // SAFETY: package review controls emit this closed request contract, never imported JSON.
      const request = message.request as ZlozModellingPatchReviewRequest;
      if (request.key !== review.key)
        return set({ ...state, notice: 'Review content changed. Inspect the current proposal.' });
      if (request.type === 'AcknowledgementChanged')
        return set({ ...state, consent: resolveModellingPatchAcknowledgement(review, request) });
      const result = applyModellingPatch(
        model.editor,
        { modelId: model.modelIdentity.id, sessionId: state.scope },
        state.patch,
        {
          consent: state.consent,
          policy: workbenchPolicy(model),
          blockedReason: state.protected
            ? 'Patch Apply is protected.'
            : state.pending
              ? 'Finish or cancel the patch file read.'
              : openReason(model),
        },
      );
      if (result.type === 'blocked') return set({ ...state, notice: result.reason });
      if (result.type === 'unchanged')
        return set({ ...state, notice: 'No authored changes to apply.' });
      return {
        model: {
          ...model,
          editor: result.editor,
          patchWorkbench: {
            ...state,
            patch: null,
            consent: null,
            receipts: [...state.receipts, result.receipt],
            notice:
              'Applied reviewed patch atomically. One Undo restores the complete source; receipt retained.',
          },
        },
      };
    }),
    Match.tag('ClickedPatchDownload', (message) => {
      const receipt = state.receipts.find((r) => receiptId(r) === message.receiptId);
      const value = message.kind === 'proposal' ? state.patch : receipt;
      if (!value)
        return set({ ...state, notice: 'Choose an available proposal or retained receipt.' });
      return {
        model,
        commands: [
          DownloadPatchArtifact.make({
            scope: state.scope,
            kind: message.kind,
            json: JSON.stringify(value, null, 2),
          }),
        ],
      };
    }),
    Match.tag('CompletedPatchDownload', (message) => {
      return set({ ...state, notice: 'Patch artifact downloaded. Working model preserved.' });
    }),
    Match.tag('FailedPatchDownload', (message) => {
      return set({
        ...state,
        notice: 'Could not download the patch artifact. Retained data preserved.',
      });
    }),
    Match.orElse(() => ({ model })),
  );
}

const nativePatchReview = architectureNativePanel<Model>((h, model, send) => {
  const state = patchWorkbenchState(model);
  const review = patchWorkbenchReview(model);
  const last = state.receipts.at(-1);
  const blocked = openReason(model) !== null;
  const diagnostics = !model.minimalMode && model.diagnosticsEnabled;
  const reviewOptions = {
    showCounts: diagnostics && model.diagnostics.measurements,
    instructions: diagnostics && model.diagnostics.instructions,
  };
  const button = (label: string, message: Message, disabled = false) =>
    h.button.attr('type', 'button').disabled(disabled).on('click', send(message)).children(label);
  return h.div.children(
    button(
      'Prepare label patch from current model',
      Message.ClickedPatchExample({ scope: state.scope }),
      blocked,
    ),
    h.label.children(
      'Open modelling patch',
      h.input
        .attr('type', 'file')
        .attr('accept', '.json,application/json')
        .value('')
        .on('change', ({ files }) =>
          send(Message.ChosePatchFiles({ scope: state.scope, files: [...files] })),
        ),
    ),
    state.pending
      ? button(
          'Cancel patch read',
          Message.ClickedPatchReadCancel({ scope: state.scope, run: state.pending.run }),
        )
      : null,
    h.label.children(
      settingCheckbox(h, state.protected, send(Message.ClickedPatchProtection())),
      'Protect patch Apply',
    ),
    button(
      state.custom ? 'Use native patch controls' : 'Use custom patch controls',
      Message.ClickedCustomPatchControls(),
    ),
    h.p.attr('role', 'status').attr('aria-live', 'polite').children(state.notice),
    review
      ? modellingPatchReview(
          h,
          review,
          (request) => send(Message.ObservedPatchReviewInput({ scope: state.scope, request })),
          state.custom
            ? {
                ...reviewOptions,
                renderChange: (change, builder) =>
                  builder.details
                    .class('patch-change-card')
                    .children(
                      builder.summary.children(
                        builder.strong.children('Proposed change'),
                        ` · ${change.entity} ${change.id}`,
                      ),
                      builder.pre.children(
                        JSON.stringify({ before: change.before, after: change.after }, null, 2),
                      ),
                    ),
              }
            : reviewOptions,
        )
      : null,
    state.patch
      ? button(
          'Download proposal',
          Message.ClickedPatchDownload({ scope: state.scope, kind: 'proposal', receiptId: '' }),
        )
      : null,
    last
      ? [
          h.p.children(
            `Retained receipt · ${last.patch.source.modelId} · ${last.patch.id} · ${last.patch.provenance.reason}`,
          ),
          button(
            'Download patch receipt',
            Message.ClickedPatchDownload({
              scope: state.scope,
              kind: 'receipt',
              receiptId: receiptId(last),
            }),
          ),
          h.details.children(
            h.summary.children('Receipt source, provenance and result'),
            h.pre.children(JSON.stringify(last, null, 2)),
          ),
        ]
      : null,
    button(
      'Undo',
      Message.ObservedModelInput({
        modelId: model.modelIdentity.id,
        epoch: model.modelEpoch,
        message: { type: 'UndoPressed' },
      }),
      model.editor.past.length === 0 || model.editor.readOnly || blocked,
    ),
  );
});

export function patchWorkbenchPanel<M>(model: Model, h: Html.H<M>, send: (message: Message) => M) {
  return model.sidebarSection === 'patch' && !model.sidebarCollapsed
    ? [nativePatchReview(h, model, 'architecture-effect-ui', 'patch-review', send)]
    : [];
}
