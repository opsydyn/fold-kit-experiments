import { Schema } from 'effect';
import { m } from 'foldkit/message';

export const UpdatedDraft = m('UpdatedDraft', { value: Schema.String });
export const ClickedSave = m('ClickedSave', {});
export const CompletedSaveUsername = m('CompletedSaveUsername', {});

export const Message = Schema.Union([UpdatedDraft, ClickedSave, CompletedSaveUsername]);
export type Message = typeof Message.Type;
