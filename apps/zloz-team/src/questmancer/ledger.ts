import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';

import { clientPaths } from './client-paths';
import {
  LedgerRevision,
  partyEntryFor,
  roomIdentity,
  type Backdrop,
  type LedgerEntry,
} from './contracts';
import { partyEntryCard } from './party-ledger';

export const LedgerMessage = defineMessageUnion({
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

export function ledgerView<Parent>(
  h: HtmlBuilder<Parent>,
  model: LedgerModel,
  room: Backdrop,
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
    h.button(
      [h.Type('button'), h.Class(style), h.Disabled(disabled), h.OnClick(toParent(message))],
      [label],
    );

  return h.section(
    [
      h.Id('librarians-ledger'),
      h.Tabindex(-1),
      h.Class('sprite-panel ledger-panel'),
      h.AriaLabelledBy('ledger-heading'),
    ],
    [
      h.header(
        [h.Class('ledger-heading')],
        [
          h.div(
            [],
            [h.h2([h.Id('ledger-heading')], ['Librarian’s Ledger']), h.p([], ['DM workspace'])],
          ),
          h.div(
            [h.Class('ledger-actions')],
            [
              button(
                existing ? 'Open current room entry' : 'Save room to Ledger',
                LedgerMessage.ClickedCaptureRoom({ roomId, expectedBackdrop: room.revision }),
                blocked,
                'primary',
              ),
              button('Refresh Ledger', LedgerMessage.ClickedLedgerRefresh(), blocked),
            ],
          ),
        ],
      ),
      h.p(
        [h.Role('status'), h.Class('ledger-status')],
        [
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
        ],
      ),
      ...(model.feedback?.error ? [h.p([h.Role('alert')], [model.feedback.text])] : []),
      ...(model.entries.length > 0
        ? [
            h.ul(
              [h.Class('ledger-entries'), h.AriaLabel('Saved rooms')],
              model.entries.map((entry) =>
                h.li(
                  [h.Key(String(entry.id))],
                  [
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('ledger-entry'),
                        h.AriaPressed(String(editor?.base.id === entry.id)),
                        h.Disabled(blocked),
                        h.OnClick(toParent(LedgerMessage.ClickedLedgerEntry({ id: entry.id }))),
                      ],
                      [entry.title],
                    ),
                  ],
                ),
              ),
            ),
          ]
        : []),
      ...(editor
        ? [
            h.div(
              [h.Class('ledger-editor'), h.Key('entry-' + editor.base.id)],
              [
                h.div(
                  [h.Class('ledger-capture')],
                  [
                    editor.base.room.style !== 'plain'
                      ? h.img([
                          h.Src(
                            editor.base.room.style === 'original'
                              ? clientPaths().baseArt + 'aurora-gate.jpg'
                              : clientPaths().authoringUrl + 'ledger-art/' + editor.base.id,
                          ),
                          h.Alt('Captured backdrop for ' + editor.base.room.title),
                        ])
                      : h.div([h.Class('plain-backdrop ledger-plain'), h.AriaHidden(true)], []),
                    h.p(
                      [],
                      [
                        'Captured room: ' + editor.base.room.title,
                        ...(editor.base.room.style === 'plain' ? [' · Plain board'] : []),
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Class('ledger-form')],
                  [
                    h.label([h.For('ledger-entry-title')], ['Entry title']),
                    h.input([
                      h.Id('ledger-entry-title'),
                      h.Type('text'),
                      h.Maxlength(72),
                      h.Value(editor.title),
                      h.Disabled(busy || !!model.partyDraft),
                      h.OnInput((title) => toParent(LedgerMessage.ChangedEntryTitle({ title }))),
                    ]),
                    h.label([h.For('ledger-entry-notes')], ['Session notes · DM only']),
                    h.textarea([
                      h.Id('ledger-entry-notes'),
                      h.Rows(4),
                      h.Maxlength(1500),
                      h.Value(editor.notes),
                      h.Placeholder('What happened in this room?'),
                      h.Disabled(busy || !!model.partyDraft),
                      h.OnInput((notes) => toParent(LedgerMessage.ChangedEntryNotes({ notes }))),
                    ]),
                    ...(editor.conflict
                      ? [
                          h.div(
                            [h.Class('ledger-conflict')],
                            [
                              h.h3([], ['Saved in the other tab']),
                              h.strong([], [editor.conflict.title]),
                              h.p([], [editor.conflict.notes || 'This version has no notes.']),
                              h.div(
                                [h.Class('ledger-actions')],
                                [
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
                                ],
                              ),
                            ],
                          ),
                        ]
                      : [
                          h.div(
                            [h.Class('ledger-actions')],
                            [
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
                            ],
                          ),
                        ]),
                  ],
                ),
              ],
            ),
            partyEditorView(h, editor.base, model.partyDraft, busy, dirty, toParent, button),
          ]
        : model.phase === 'idle' && !model.feedback?.error
          ? [h.p([], ['Save the room on the board to start your session notes.'])]
          : []),
    ],
  );
}

function partyEditorView<Parent>(
  h: HtmlBuilder<Parent>,
  entry: LedgerEntry,
  draft: PartyDraft | null,
  busy: boolean,
  privateEditsPending: boolean,
  toParent: (message: typeof LedgerMessage.Type) => Parent,
  button: (
    label: string,
    message: typeof LedgerMessage.Type,
    disabled: boolean,
    style?: string,
  ) => ReturnType<HtmlBuilder<Parent>['button']>,
) {
  if (!draft)
    return h.section(
      [h.Class('party-editor'), h.AriaLabel('Party publication')],
      [
        h.h3([h.Id('party-publication-heading'), h.Tabindex(-1)], ['Party entry']),
        h.p(
          [],
          [
            entry.published
              ? 'The party can read the published version.'
              : 'Only you can see this entry.',
          ],
        ),
        button(
          entry.published ? 'Edit party entry' : 'Prepare party entry',
          LedgerMessage.ClickedEditPartyEntry(),
          busy || privateEditsPending,
        ),
      ],
    );

  if (draft.stage === 'previewing')
    return h.section(
      [h.Class('party-editor'), h.AriaLabel('Party preview')],
      [
        h.h3([h.Id('party-preview-heading'), h.Tabindex(-1)], ['Party preview']),
        partyEntryCard(
          h,
          partyEntryFor(entry, {
            title: draft.title,
            recap: draft.recap,
            version: draft.expectedVersion,
          }),
          clientPaths().authoringUrl + 'ledger-art/' + entry.id,
        ),
        h.div(
          [h.Class('ledger-actions')],
          [
            button('Publish to party', LedgerMessage.ClickedPublishPartyEntry(), busy, 'primary'),
            button('Back to party draft', LedgerMessage.ClickedBackToPartyDraft(), busy),
          ],
        ),
      ],
    );

  return h.section(
    [h.Class('party-editor'), h.AriaLabel('Party draft')],
    [
      h.h3([], ['Party draft']),
      h.p([], ['The party will see this title, recap, and captured room.']),
      ...(entry.published
        ? [
            h.details(
              [h.Class('party-current')],
              [
                h.summary([], ['Currently published']),
                partyEntryCard(
                  h,
                  partyEntryFor(entry, entry.published),
                  clientPaths().authoringUrl + 'ledger-art/' + entry.id,
                ),
              ],
            ),
          ]
        : []),
      h.label([h.For('party-entry-title')], ['Party title']),
      h.input([
        h.Id('party-entry-title'),
        h.Type('text'),
        h.Maxlength(72),
        h.Value(draft.title),
        h.OnInput((title) => toParent(LedgerMessage.ChangedPartyTitle({ title }))),
      ]),
      h.label([h.For('party-entry-recap')], ['Party recap']),
      h.textarea([
        h.Id('party-entry-recap'),
        h.Rows(3),
        h.Maxlength(1500),
        h.Value(draft.recap),
        h.Placeholder('What should the party remember?'),
        h.OnInput((recap) => toParent(LedgerMessage.ChangedPartyRecap({ recap }))),
      ]),
      h.div(
        [h.Class('ledger-actions')],
        [
          button(
            'Preview party entry',
            LedgerMessage.ClickedPreviewPartyEntry(),
            !draft.title.trim(),
            'primary',
          ),
          button('Cancel party draft', LedgerMessage.ClickedCancelPartyDraft(), false),
        ],
      ),
    ],
  );
}
