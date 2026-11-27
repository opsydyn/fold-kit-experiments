import { UiSchema, type View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Schema } from 'effect';

import { baseArt } from './client-paths';
import {
  LedgerRevision,
  partyEntryFor,
  roomIdentity,
  type Backdrop,
  type LedgerEntry,
} from './contracts';
import { partyEntryCard } from './party-ledger';

export const LedgerMessage = UiSchema.TaggedEnum({
  ClickedLedgerRefresh: {},
  ClickedCaptureRoom: { roomId: LedgerRevision, expectedBackdrop: LedgerRevision },
  ClickedLedgerEntry: { id: LedgerRevision },
  ChangedEntryTitle: { title: Schema.String },
  ChangedEntryNotes: { notes: Schema.String },
  ClickedSaveEntry: {},
  ClickedUseSavedEntry: {},
  ClickedKeepEntryEdits: {},
  ClickedEditPartyEntry: {},
  ChangedPartyTitle: { title: Schema.String },
  ChangedPartyRecap: { recap: Schema.String },
  ClickedPreviewPartyEntry: {},
  ClickedBackToPartyDraft: {},
  ClickedCancelPartyDraft: {},
  ClickedPublishPartyEntry: {},
});

type Editor = Readonly<{
  base: LedgerEntry;
  title: string;
  notes: string;
  conflict: LedgerEntry | null;
}>;
type PartyDraft = Readonly<{
  stage: 'editing' | 'previewing';
  title: string;
  recap: string;
  expectedVersion: number;
}>;

export type LedgerModel = Readonly<{
  entries: readonly LedgerEntry[];
  editor: Editor | null;
  partyDraft: PartyDraft | null;
  phase: 'idle' | 'loading' | 'capturing' | 'saving' | 'publishing';
  feedback: { text: string; error: boolean } | null;
}>;

export const initialLedger: LedgerModel = {
  entries: [],
  editor: null,
  partyDraft: null,
  phase: 'loading',
  feedback: null,
};

type ApiRequest = {
  action: 'ledger' | 'ledger-capture' | 'ledger-edit' | 'ledger-publish';
  payload: Schema.Json;
};
export const loadLedger: ApiRequest = { action: 'ledger', payload: null };

const openEntry = (entry: LedgerEntry): Editor => ({
  base: entry,
  title: entry.title,
  notes: entry.notes,
  conflict: null,
});
const isDirty = (editor: Editor | null) =>
  !!editor &&
  (editor.title !== editor.base.title || editor.notes !== editor.base.notes || !!editor.conflict);
const canSave = (editor: Editor) => isDirty(editor) && !!editor.title.trim() && !editor.conflict;

type LedgerUpdate = { model: LedgerModel; request?: ApiRequest };

export function updateLedger(model: LedgerModel, message: typeof LedgerMessage.Type): LedgerUpdate {
  if (model.phase !== 'idle') return { model };
  const editor = model.editor;
  const draft = model.partyDraft;
  const editing = isDirty(editor) || !!draft;
  return LedgerMessage.match(message, {
    ClickedLedgerRefresh: () =>
      editing
        ? { model }
        : { model: { ...model, phase: 'loading' as const, feedback: null }, request: loadLedger },
    ClickedCaptureRoom: ({ roomId, expectedBackdrop }) => {
      if (editing) return { model };
      const existing = model.entries.find((entry) => entry.id === roomId);
      if (existing) return { model: { ...model, editor: openEntry(existing), feedback: null } };
      return {
        model: { ...model, phase: 'capturing' as const, feedback: null },
        request: { action: 'ledger-capture' as const, payload: { roomId, expectedBackdrop } },
      };
    },
    ClickedLedgerEntry: ({ id }) => {
      const entry = model.entries.find((item) => item.id === id);
      return !entry || editing
        ? { model }
        : { model: { ...model, editor: openEntry(entry), feedback: null } };
    },
    ChangedEntryTitle: ({ title }) => ({
      model:
        editor && !draft
          ? {
              ...model,
              editor: { ...editor, title },
              feedback: editor.conflict ? model.feedback : null,
            }
          : model,
    }),
    ChangedEntryNotes: ({ notes }) => ({
      model:
        editor && !draft
          ? {
              ...model,
              editor: { ...editor, notes },
              feedback: editor.conflict ? model.feedback : null,
            }
          : model,
    }),
    ClickedSaveEntry: () => {
      if (!editor || draft || !canSave(editor)) return { model };
      return {
        model: { ...model, phase: 'saving' as const, feedback: null },
        request: {
          action: 'ledger-edit' as const,
          payload: {
            id: editor.base.id,
            expectedRevision: editor.base.revision,
            title: editor.title.trim(),
            notes: editor.notes,
          },
        },
      };
    },
    ClickedUseSavedEntry: () => ({
      model: editor
        ? { ...model, editor: openEntry(editor.conflict ?? editor.base), feedback: null }
        : model,
    }),
    ClickedKeepEntryEdits: () => ({
      model: editor?.conflict
        ? { ...model, editor: { ...editor, base: editor.conflict, conflict: null }, feedback: null }
        : model,
    }),
    ClickedEditPartyEntry: () => {
      if (!editor || editing) return { model };
      const { published, room } = editor.base;
      return {
        model: {
          ...model,
          feedback: null,
          partyDraft: {
            stage: 'editing' as const,
            title: published?.title ?? room.title,
            recap: published?.recap ?? '',
            expectedVersion: published?.version ?? 0,
          },
        },
      };
    },
    ChangedPartyTitle: ({ title }) => ({
      model:
        draft?.stage === 'editing'
          ? { ...model, feedback: null, partyDraft: { ...draft, title } }
          : model,
    }),
    ChangedPartyRecap: ({ recap }) => ({
      model:
        draft?.stage === 'editing'
          ? { ...model, feedback: null, partyDraft: { ...draft, recap } }
          : model,
    }),
    ClickedPreviewPartyEntry: () => ({
      model:
        draft?.stage === 'editing' && draft.title.trim()
          ? {
              ...model,
              feedback: null,
              partyDraft: { ...draft, title: draft.title.trim(), stage: 'previewing' as const },
            }
          : model,
    }),
    ClickedBackToPartyDraft: () => ({
      model: draft
        ? { ...model, feedback: null, partyDraft: { ...draft, stage: 'editing' as const } }
        : model,
    }),
    ClickedCancelPartyDraft: () => ({ model: { ...model, partyDraft: null, feedback: null } }),
    ClickedPublishPartyEntry: () => {
      if (!editor || draft?.stage !== 'previewing') return { model };
      return {
        model: { ...model, phase: 'publishing' as const, feedback: null },
        request: {
          action: 'ledger-publish' as const,
          payload: {
            id: editor.base.id,
            title: draft.title,
            recap: draft.recap,
            expectedVersion: draft.expectedVersion,
          },
        },
      };
    },
  });
}

function withEntry(entries: readonly LedgerEntry[], entry: LedgerEntry) {
  return [...entries.filter(({ id }) => id !== entry.id), entry].sort((a, b) => b.id - a.id);
}

export function settleLedger(
  model: LedgerModel,
  action: string,
  reply: { status: number; value: Schema.Json },
  errorText: (value: Schema.Json) => string,
): LedgerModel {
  const idle = { ...model, phase: 'idle' as const };
  if (reply.status === 200) {
    if (action === 'ledger') {
      // SAFETY: The successful Ledger read returns its entry list.
      const entries = reply.value as LedgerEntry[];
      const selected = entries.find((entry) => entry.id === model.editor?.base.id) ?? entries[0];
      return { ...idle, entries, editor: selected ? openEntry(selected) : null };
    }
    // SAFETY: A successful Ledger mutation returns its updated entry.
    const entry = reply.value as LedgerEntry;
    return {
      ...idle,
      entries: withEntry(model.entries, entry),
      editor: openEntry(entry),
      partyDraft: null,
      feedback: {
        text:
          action === 'ledger-publish'
            ? 'Published to the party.'
            : action === 'ledger-capture'
              ? 'Room saved to the Ledger.'
              : 'Entry saved.',
        error: false,
      },
    };
  }
  const feedback = { text: errorText(reply.value), error: true };
  if (reply.status === 409 && action === 'ledger-publish' && model.partyDraft) {
    // SAFETY: The matched Ledger conflict response includes the current entry.
    const { entry } = reply.value as { entry: LedgerEntry };
    return {
      ...idle,
      entries: withEntry(model.entries, entry),
      editor: openEntry(entry),
      partyDraft: {
        ...model.partyDraft,
        stage: 'editing',
        expectedVersion: entry.published?.version ?? 0,
      },
      feedback,
    };
  }
  if (reply.status === 409 && action === 'ledger-edit' && model.editor) {
    // SAFETY: The matched Ledger conflict response includes the current entry.
    const { entry } = reply.value as { entry: LedgerEntry };
    return {
      ...idle,
      entries: withEntry(model.entries, entry),
      editor: { ...model.editor, conflict: entry },
      feedback,
    };
  }
  return { ...idle, feedback };
}

export const partyPublicationHeading = Html.ref('party-publication-heading', 'h3');
export const partyPreviewHeading = Html.ref('party-preview-heading', 'h3');
export const partyTitleInput = Html.ref('party-entry-title', 'input');
export function ledgerView<Parent>(
  h: Html.H<Parent>,
  model: LedgerModel,
  room: Backdrop,
  authoringUrl: string,
  toParent: (message: typeof LedgerMessage.Type) => Parent,
) {
  const editor = model.editor;
  const dirty = isDirty(editor);
  const busy = model.phase !== 'idle';
  const blocked = busy || dirty || !!model.partyDraft;
  const roomId = roomIdentity(room);
  const existing = model.entries.some((entry) => entry.id === roomId);
  const button = (
    label: string,
    message: typeof LedgerMessage.Type,
    disabled: boolean,
    style = 'secondary',
  ) =>
    h.button
      .attr('type', 'button')
      .class(style)
      .disabled(disabled)
      .on('click', toParent(message))
      .children(label);

  return h.section
    .id('librarians-ledger')
    .attr('tabindex', String(-1))
    .class('sprite-panel ledger-panel')
    .attr('aria-labelledby', 'ledger-heading')
    .children(
      h.header
        .class('ledger-heading')
        .children(
          h.div.children(
            h.h2.id('ledger-heading').children('Librarian’s Ledger'),
            h.p.children('DM workspace'),
          ),
          h.div
            .class('ledger-actions')
            .children(
              button(
                existing ? 'Open current room entry' : 'Save room to Ledger',
                LedgerMessage.ClickedCaptureRoom({ roomId, expectedBackdrop: room.revision }),
                blocked,
                'primary',
              ),
              button('Refresh Ledger', LedgerMessage.ClickedLedgerRefresh(), blocked),
            ),
        ),
      h.p
        .attr('role', 'status')
        .class('ledger-status')
        .children(
          model.phase === 'loading'
            ? 'Loading entries…'
            : model.phase === 'capturing'
              ? 'Saving the room…'
              : model.phase === 'saving'
                ? 'Saving the entry…'
                : model.phase === 'publishing'
                  ? 'Publishing to the party…'
                  : model.feedback && !model.feedback.error
                    ? model.feedback.text
                    : dirty
                      ? 'Unsaved edits'
                      : '',
        ),
      ...(model.feedback?.error ? [h.p.attr('role', 'alert').children(model.feedback.text)] : []),
      ...(model.entries.length > 0
        ? [
            h.ul
              .class('ledger-entries')
              .attr('aria-label', 'Saved rooms')
              .children(
                model.entries.map((entry) =>
                  h.li.key(String(entry.id)).children(
                    h.button
                      .attr('type', 'button')
                      .class('ledger-entry')
                      .attr('aria-pressed', String(editor?.base.id === entry.id))
                      .disabled(blocked)
                      .on('click', toParent(LedgerMessage.ClickedLedgerEntry({ id: entry.id })))
                      .children(entry.title),
                  ),
                ),
              ),
          ]
        : []),
      ...(editor
        ? [
            h.div
              .class('ledger-editor')
              .key('entry-' + editor.base.id)
              .children(
                h.div
                  .class('ledger-capture')
                  .children(
                    editor.base.room.style !== 'plain'
                      ? h.img
                          .attr(
                            'src',
                            editor.base.room.style === 'original'
                              ? baseArt + 'aurora-gate.jpg'
                              : authoringUrl + 'ledger-art/' + editor.base.id,
                          )
                          .attr('alt', 'Captured backdrop for ' + editor.base.room.title)
                      : h.div
                          .class('plain-backdrop ledger-plain')
                          .attr('aria-hidden', 'true')
                          .children(),
                    h.p.children(
                      'Captured room: ' + editor.base.room.title,
                      ...(editor.base.room.style === 'plain' ? [' · Plain board'] : []),
                    ),
                  ),
                h.div.class('ledger-form').children(
                  h.label.attr('for', 'ledger-entry-title').children('Entry title'),
                  h.input
                    .id('ledger-entry-title')
                    .attr('type', 'text')
                    .attr('maxlength', String(72))
                    .value(editor.title)
                    .disabled(busy || !!model.partyDraft)
                    .on('input', ({ value: title }) =>
                      toParent(LedgerMessage.ChangedEntryTitle({ title })),
                    ),
                  h.label.attr('for', 'ledger-entry-notes').children('Session notes · DM only'),
                  h.textarea
                    .id('ledger-entry-notes')
                    .attr('rows', String(4))
                    .attr('maxlength', String(1500))
                    .value(editor.notes)
                    .attr('placeholder', 'What happened in this room?')
                    .disabled(busy || !!model.partyDraft)
                    .on('input', ({ value: notes }) =>
                      toParent(LedgerMessage.ChangedEntryNotes({ notes })),
                    ),
                  ...(editor.conflict
                    ? [
                        h.div
                          .class('ledger-conflict')
                          .children(
                            h.h3.children('Saved in the other tab'),
                            h.strong.children(editor.conflict.title),
                            h.p.children(editor.conflict.notes || 'This version has no notes.'),
                            h.div
                              .class('ledger-actions')
                              .children(
                                button(
                                  'Use saved version',
                                  LedgerMessage.ClickedUseSavedEntry(),
                                  busy,
                                ),
                                button(
                                  'Keep my edits',
                                  LedgerMessage.ClickedKeepEntryEdits(),
                                  busy,
                                ),
                              ),
                          ),
                      ]
                    : [
                        h.div
                          .class('ledger-actions')
                          .children(
                            button(
                              'Save entry',
                              LedgerMessage.ClickedSaveEntry(),
                              busy || !!model.partyDraft || !canSave(editor),
                              'primary',
                            ),
                            ...(dirty
                              ? [
                                  button(
                                    'Discard edits',
                                    LedgerMessage.ClickedUseSavedEntry(),
                                    busy,
                                  ),
                                ]
                              : []),
                          ),
                      ]),
                ),
              ),
            partyEditorView(
              h,
              editor.base,
              model.partyDraft,
              busy,
              dirty,
              authoringUrl,
              toParent,
              button,
            ),
          ]
        : model.phase === 'idle' && !model.feedback?.error
          ? [h.p.children('Save the room on the board to start your session notes.')]
          : []),
    );
}

function partyEditorView<Parent>(
  h: Html.H<Parent>,
  entry: LedgerEntry,
  draft: PartyDraft | null,
  busy: boolean,
  privateEditsPending: boolean,
  authoringUrl: string,
  toParent: (message: typeof LedgerMessage.Type) => Parent,
  button: (
    label: string,
    message: typeof LedgerMessage.Type,
    disabled: boolean,
    style?: string,
  ) => View.Input<Parent>,
) {
  if (!draft)
    return h.section
      .class('party-editor')
      .attr('aria-label', 'Party publication')
      .children(
        h.h3
          .ref(partyPublicationHeading)
          .id('party-publication-heading')
          .attr('tabindex', String(-1))
          .children('Party entry'),
        h.p.children(
          entry.published
            ? 'The party can read the published version.'
            : 'Only you can see this entry.',
        ),
        button(
          entry.published ? 'Edit party entry' : 'Prepare party entry',
          LedgerMessage.ClickedEditPartyEntry(),
          busy || privateEditsPending,
        ),
      );

  if (draft.stage === 'previewing')
    return h.section
      .class('party-editor')
      .attr('aria-label', 'Party preview')
      .children(
        h.h3
          .ref(partyPreviewHeading)
          .id('party-preview-heading')
          .attr('tabindex', String(-1))
          .children('Party preview'),
        partyEntryCard(
          h,
          partyEntryFor(entry, {
            title: draft.title,
            recap: draft.recap,
            version: draft.expectedVersion,
          }),
          authoringUrl + 'ledger-art/' + entry.id,
        ),
        h.div
          .class('ledger-actions')
          .children(
            button('Publish to party', LedgerMessage.ClickedPublishPartyEntry(), busy, 'primary'),
            button('Back to party draft', LedgerMessage.ClickedBackToPartyDraft(), busy),
          ),
      );

  return h.section
    .class('party-editor')
    .attr('aria-label', 'Party draft')
    .children(
      h.h3.children('Party draft'),
      h.p.children('The party will see this title, recap, and captured room.'),
      ...(entry.published
        ? [
            h.details
              .class('party-current')
              .children(
                h.summary.children('Currently published'),
                partyEntryCard(
                  h,
                  partyEntryFor(entry, entry.published),
                  authoringUrl + 'ledger-art/' + entry.id,
                ),
              ),
          ]
        : []),
      h.label.attr('for', 'party-entry-title').children('Party title'),
      h.input
        .ref(partyTitleInput)
        .id('party-entry-title')
        .attr('type', 'text')
        .attr('maxlength', String(72))
        .value(draft.title)
        .on('input', ({ value: title }) => toParent(LedgerMessage.ChangedPartyTitle({ title }))),
      h.label.attr('for', 'party-entry-recap').children('Party recap'),
      h.textarea
        .id('party-entry-recap')
        .attr('rows', String(3))
        .attr('maxlength', String(1500))
        .value(draft.recap)
        .attr('placeholder', 'What should the party remember?')
        .on('input', ({ value: recap }) => toParent(LedgerMessage.ChangedPartyRecap({ recap }))),
      h.div
        .class('ledger-actions')
        .children(
          button(
            'Preview party entry',
            LedgerMessage.ClickedPreviewPartyEntry(),
            !draft.title.trim(),
            'primary',
          ),
          button('Cancel party draft', LedgerMessage.ClickedCancelPartyDraft(), false),
        ),
    );
}
