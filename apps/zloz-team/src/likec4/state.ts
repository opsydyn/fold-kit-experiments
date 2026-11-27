import { UiSchema } from '@effect/ui';
import { parseGraph } from '@opsydyn/foldkit-zloz';
import { Schema } from 'effect';

import { infrastructureViewId, reviewInfrastructure } from './infrastructure-review';
import { listLikeC4Views } from './project.mjs';
import { creationBody, requestLimit, reviewLikeC4 } from './review';

export const Props = Schema.Struct({
  teamId: Schema.String,
  creationId: Schema.String,
  format: Schema.optional(Schema.Literal('alchemy')),
  insideBoard: Schema.optional(Schema.Literal(true)),
});
export type Props = typeof Props.Type;

export interface State extends Props {
  readonly source: string;
  readonly views: readonly string[];
  readonly selected: string;
  readonly review: ReturnType<typeof reviewLikeC4> | ReturnType<typeof reviewInfrastructure> | null;
  readonly focused: string | null;
  readonly name: string;
  readonly accepted: boolean;
  readonly epoch: number;
  readonly fileKey: number;
  readonly reading: boolean;
  readonly notice: string;
  readonly submission: 'idle' | 'sending' | 'retry';
}

const StateSchema = Schema.Struct({
  ...Props.fields,
  source: Schema.String,
  views: Schema.Array(Schema.String),
  selected: Schema.String,
  review: Schema.NullOr(Schema.Unknown),
  focused: Schema.NullOr(Schema.String),
  name: Schema.String,
  accepted: Schema.Boolean,
  epoch: Schema.Number,
  fileKey: Schema.Number,
  reading: Schema.Boolean,
  notice: Schema.String,
  submission: Schema.Literals(['idle', 'sending', 'retry']),
});
export const Model =
  // SAFETY: The server snapshots a null review. Only the review functions construct non-null reviews.
  StateSchema as Schema.Codec<State>;
export const Message = UiSchema.TaggedEnum({
  SelectedFile: { file: Schema.Unknown },
  SettledRead: { epoch: Schema.Number, text: Schema.NullOr(Schema.String) },
  SelectedView: { id: Schema.String },
  ChangedSnapshotText: { text: Schema.String },
  ClickedReviewSnapshot: {},
  FocusedFinding: { resource: Schema.NullOr(Schema.String) },
  ChangedName: { value: Schema.String },
  ChangedAcknowledgement: {},
  CancelledPreview: {},
  ClickedApply: {},
  SettledApply: { notice: Schema.String, retry: Schema.Boolean },
});
export type Message = typeof Message.Type;

const empty = {
  source: '',
  views: [],
  selected: '',
  review: null,
  focused: null,
  accepted: false,
  reading: false,
  notice: '',
} as const;

export const initialState = (props: Props): State => ({
  ...props,
  ...empty,
  name: '',
  epoch: 0,
  fileKey: 0,
  submission: 'idle',
});

export const ReadFileArgs = { file: Schema.Unknown, epoch: Schema.Number };
type Work =
  | { readonly _tag: 'ReadFile'; readonly file: unknown; readonly epoch: number }
  | {
      readonly _tag: 'CreateDiagram';
      readonly teamId: string;
      readonly creationId: string;
      readonly body: string;
    };
type Transition = Readonly<{ model: State; work?: Work }>;

export function acceptedGraphText(model: State) {
  if (model.review?.status !== 'ready' || !model.review.graphText) return;
  if (model.review.diagnostics.some((item) => item.severity === 'loss') && !model.accepted) return;
  return model.review.graphText;
}

export function reviewedBoardGraph(model: State) {
  const text = acceptedGraphText(model);
  return model.insideBoard && text ? parseGraph(text) : null;
}

export function candidate(model: State) {
  const text = acceptedGraphText(model);
  if (!text || !model.name.trim() || model.name.trim().length > 120) return;
  const body = creationBody(model.creationId, model.name, text);
  return new TextEncoder().encode(body).byteLength <= requestLimit ? body : null;
}

export function transition(model: State, message: Message): Transition {
  const editable = model.submission === 'idle';
  return Message.match(message, {
    SelectedFile: ({ file }): Transition => {
      if (!editable) return { model };
      const epoch = model.epoch + 1;
      return {
        model: { ...model, ...empty, epoch, reading: true },
        work: { _tag: 'ReadFile', file, epoch },
      };
    },
    SettledRead: ({ epoch, text }) => {
      if (epoch !== model.epoch || !editable) return { model };
      if (model.format === 'alchemy')
        return {
          model: {
            ...model,
            reading: false,
            source: text ?? '',
            selected: infrastructureViewId,
            review: text === null ? null : reviewInfrastructure(text),
            notice: text === null ? 'Choose a UTF-8 infrastructure snapshot up to 1 MiB.' : '',
          },
        };
      const views = text === null ? [] : listLikeC4Views(text);
      return {
        model: {
          ...model,
          reading: false,
          source: text ?? '',
          views,
          notice: views.length
            ? ''
            : 'Choose a UTF-8 LikeC4 JSON export (up to 1 MiB) containing a laid-out static view.',
        },
      };
    },
    ChangedSnapshotText: ({ text }) => ({
      model:
        editable && !model.reading
          ? {
              ...model,
              source: text,
              selected: '',
              review: null,
              focused: null,
              accepted: false,
              notice: '',
            }
          : model,
    }),
    ClickedReviewSnapshot: () => ({
      model:
        editable && !model.reading
          ? {
              ...model,
              selected: infrastructureViewId,
              review: reviewInfrastructure(model.source),
              focused: null,
              accepted: false,
            }
          : model,
    }),
    FocusedFinding: ({ resource }) => ({
      model:
        model.format === 'alchemy' && model.review?.status === 'ready'
          ? { ...model, focused: resource, review: reviewInfrastructure(model.source, resource) }
          : model,
    }),
    SelectedView: ({ id }) => ({
      model: editable
        ? {
            ...model,
            selected: id,
            accepted: false,
            notice: '',
            review: model.views.includes(id) ? reviewLikeC4(model.source, id) : null,
          }
        : model,
    }),
    ChangedName: ({ value }) => ({ model: editable ? { ...model, name: value } : model }),
    ChangedAcknowledgement: () => ({
      model: editable ? { ...model, accepted: !model.accepted } : model,
    }),
    CancelledPreview: () => ({
      model: editable
        ? { ...model, ...empty, epoch: model.epoch + 1, fileKey: model.fileKey + 1 }
        : model,
    }),
    ClickedApply: (): Transition => {
      const body = candidate(model);
      if (model.insideBoard || !body || model.submission === 'sending') return { model };
      return {
        model: { ...model, submission: 'sending', notice: 'Creating diagram…' },
        work: { _tag: 'CreateDiagram', teamId: model.teamId, creationId: model.creationId, body },
      };
    },
    SettledApply: ({ notice, retry }): Transition => ({
      model: { ...model, submission: retry ? 'retry' : 'idle', notice },
    }),
  });
}
