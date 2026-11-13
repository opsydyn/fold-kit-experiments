import {
  ZlozError,
  type ZlozModellingPatchReview,
  captureModellingPatch,
  parseModellingPatch,
  resolveModellingPatchReview,
  resolveModellingPatchAcknowledgement,
  applyModellingPatch,
  type ZlozModellingPatchChange,
  type ZlozModellingPatch,
  type ZlozModellingPatchConsent,
  type ZlozModellingPatchReceipt,
  type ZlozModellingPatchReviewRequest,
} from '@opsydyn/foldkit-zloz';
import { zlozModellingPatchReview } from '@opsydyn/foldkit-zloz/foldkit';
import { Match, Result } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';

import { ReadPatchFile, DownloadPatchArtifact } from './command';
import { workbenchPolicy } from './editor-policy';
import { Message } from './message';
import type { Model } from './model';
import { modelSessionBusy } from './model-sessions';
import { packetReviewActive } from './packet-reader';
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
        commands: [ReadPatchFile({ scope: state.scope, run, file, maxBytes: 1048576 })],
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
          DownloadPatchArtifact({
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

export function patchWorkbenchPanel(model: Model, h: HtmlBuilder<Message>) {
  if (model.sidebarSection !== 'patch' || model.sidebarCollapsed) return [];
  const state = patchWorkbenchState(model),
    review = patchWorkbenchReview(model),
    last = state.receipts.at(-1);
  const input = (request: ZlozModellingPatchReviewRequest) =>
    Message.ObservedPatchReviewInput({ scope: state.scope, request });
  const baseOptions = {
    showCounts: !model.minimalMode && model.diagnosticsEnabled && model.diagnostics.measurements,
    instructions: !model.minimalMode && model.diagnosticsEnabled && model.diagnostics.instructions,
  };
  const customChange = (change: ZlozModellingPatchChange, builder: HtmlBuilder<Message>) =>
    builder.details(
      [builder.Class('patch-change-card')],
      [
        builder.summary(
          [],
          [builder.strong([], ['Proposed change']), ` · ${change.entity} ${change.id}`],
        ),
        builder.pre([], [JSON.stringify({ before: change.before, after: change.after }, null, 2)]),
      ],
    );
  const reviewOptions = state.custom ? { ...baseOptions, renderChange: customChange } : baseOptions;
  return [
    h.button(
      [
        h.Type('button'),
        h.Disabled(openReason(model) !== null),
        h.OnClick(Message.ClickedPatchExample({ scope: state.scope })),
      ],
      ['Prepare label patch from current model'],
    ),
    h.label(
      [],
      [
        'Open modelling patch',
        h.input([
          h.Type('file'),
          h.Accept('.json,application/json'),
          h.OnFileChange((files) =>
            Message.ChosePatchFiles({ scope: state.scope, files: [...files] }),
          ),
        ]),
      ],
    ),
    ...(state.pending
      ? [
          h.button(
            [
              h.Type('button'),
              h.OnClick(
                Message.ClickedPatchReadCancel({ scope: state.scope, run: state.pending.run }),
              ),
            ],
            ['Cancel patch read'],
          ),
        ]
      : []),
    h.label(
      [],
      [
        h.input([
          h.Type('checkbox'),
          h.Checked(state.protected),
          h.OnClick(Message.ClickedPatchProtection()),
        ]),
        'Protect patch Apply',
      ],
    ),
    h.button(
      [h.Type('button'), h.OnClick(Message.ClickedCustomPatchControls())],
      [state.custom ? 'Use native patch controls' : 'Use custom patch controls'],
    ),
    h.p([h.Role('status'), h.AriaLive('polite')], [state.notice]),
    ...(review ? [zlozModellingPatchReview(h, review, input, reviewOptions)] : []),
    ...(state.patch
      ? [
          h.button(
            [
              h.Type('button'),
              h.OnClick(
                Message.ClickedPatchDownload({
                  scope: state.scope,
                  kind: 'proposal',
                  receiptId: '',
                }),
              ),
            ],
            ['Download proposal'],
          ),
        ]
      : []),
    ...(last
      ? [
          h.p(
            [],
            [
              `Retained receipt · ${last.patch.source.modelId} · ${last.patch.id} · ${last.patch.provenance.reason}`,
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(
                Message.ClickedPatchDownload({
                  scope: state.scope,
                  kind: 'receipt',
                  receiptId: receiptId(last),
                }),
              ),
            ],
            ['Download patch receipt'],
          ),
          h.details(
            [],
            [
              h.summary([], ['Receipt source, provenance and result']),
              h.pre([], [JSON.stringify(last, null, 2)]),
            ],
          ),
        ]
      : []),
    h.button(
      [
        h.Type('button'),
        h.Disabled(
          model.editor.past.length === 0 || model.editor.readOnly || openReason(model) !== null,
        ),
        h.OnClick(
          Message.ObservedModelInput({
            modelId: model.modelIdentity.id,
            epoch: model.modelEpoch,
            message: { type: 'UndoPressed' },
          }),
        ),
      ],
      ['Undo'],
    ),
  ];
}
