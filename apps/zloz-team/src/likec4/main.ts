import { parseGraph } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { Command } from 'foldkit';
import type { HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import { infrastructureViewId, reviewInfrastructure } from './infrastructure-review';
import { listLikeC4Views } from './project.mjs';
import { creationBody, requestLimit, reviewLikeC4 } from './review';

export interface Props {
  readonly teamId: string;
  readonly creationId: string;
  readonly format?: 'alchemy';
  readonly insideBoard?: true;
}

interface State extends Props {
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

// SAFETY: The runtime stores State constructed by init and update.
const Model = Schema.Unknown as Schema.Codec<State>;
export { Model };
export const Message = defineMessageUnion({
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
type Message = typeof Message.Type;

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

export const init = (props: Props) => ({
  model: { ...props, ...empty, name: '', epoch: 0, fileKey: 0, submission: 'idle' } satisfies State,
});

const ReadLikeC4File = Command.define('ReadLikeC4File', {
  args: { file: Schema.Unknown, epoch: Schema.Number },
  messages: [Message.SettledRead],
  execute: ({ file, epoch }) => {
    if (!(file instanceof File) || file.size > requestLimit)
      return Effect.succeed(Message.SettledRead({ epoch, text: null }));
    return Effect.tryPromise(async () =>
      new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()),
    ).pipe(
      Effect.orElseSucceed(() => null),
      Effect.map((text) => Message.SettledRead({ epoch, text })),
    );
  },
});

const CreateLikeC4Diagram = Command.define('CreateLikeC4Diagram', {
  args: { teamId: Schema.String, creationId: Schema.String, body: Schema.String },
  messages: [Message.SettledApply],
  execute: ({ teamId, creationId, body }) =>
    Effect.tryPromise(async (signal) => {
      const path = `/zloz/diagrams/${encodeURIComponent(teamId)}/${encodeURIComponent(creationId)}`;
      const response = await fetch('/api' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      });
      if (response.ok) {
        window.location.assign(
          `/app/${encodeURIComponent(teamId)}/diagrams/${encodeURIComponent(creationId)}`,
        );
        return Message.SettledApply({ retry: false, notice: 'Diagram created.' });
      }
      if (response.status === 401 || response.status === 403)
        return Message.SettledApply({
          retry: false,
          notice: 'Your current session or role cannot create diagrams.',
        });
      if (response.status === 409)
        return Message.SettledApply({
          retry: true,
          notice:
            'Creation conflicts with an existing request. Return to the team to check your diagrams.',
        });
      if (response.status === 400 || response.status === 413)
        return Message.SettledApply({
          retry: false,
          notice: 'Teams rejected the diagram or its request size.',
        });
      return Message.SettledApply({
        retry: true,
        notice: 'Creation is unconfirmed. Retry this exact diagram.',
      });
    }).pipe(
      Effect.orElseSucceed(() =>
        Message.SettledApply({
          retry: true,
          notice: 'Creation is unconfirmed. Retry this exact diagram.',
        }),
      ),
    ),
});

function acceptedGraphText(model: State) {
  if (model.review?.status !== 'ready' || !model.review.graphText) return;
  if (model.review.diagnostics.some((item) => item.severity === 'loss') && !model.accepted) return;
  return model.review.graphText;
}

export function reviewedBoardGraph(model: State) {
  const text = acceptedGraphText(model);
  return model.insideBoard && text ? parseGraph(text) : null;
}

function candidate(model: State) {
  const text = acceptedGraphText(model);
  if (!text || !model.name.trim() || model.name.trim().length > 120) return;
  const body = creationBody(model.creationId, model.name, text);
  return new TextEncoder().encode(body).byteLength <= requestLimit ? body : null;
}

export function update(model: State, message: Message): Return<State, Message> {
  const editable = model.submission === 'idle';
  return Message.match(message, {
    SelectedFile: ({ file }) => {
      if (!editable) return { model };
      const epoch = model.epoch + 1;
      return {
        model: { ...model, ...empty, epoch, reading: true },
        commands: [ReadLikeC4File({ file, epoch })],
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
    ClickedApply: (): Return<State, Message> => {
      const body = candidate(model);
      if (model.insideBoard || !body || model.submission === 'sending') return { model };
      return {
        model: { ...model, submission: 'sending', notice: 'Creating diagram…' },
        commands: [
          CreateLikeC4Diagram({ teamId: model.teamId, creationId: model.creationId, body }),
        ],
      };
    },
    SettledApply: ({ notice, retry }): Return<State, Message> => ({
      model: { ...model, submission: retry ? 'retry' : 'idle', notice },
    }),
  });
}

export function view(model: State, h: HtmlBuilder<Message>, blockedReason = '') {
  const disabled = model.submission !== 'idle';
  const review = model.review;
  const ready = review?.status === 'ready' ? review : null;
  const diagnostics = review?.diagnostics ?? [];
  const emptyImport = model.insideBoard && ready?.graph.nodes.length === 0;
  const nodeLabels = new Map(ready?.graph.nodes.map(({ id, label }) => [id, label]));
  const tooLarge =
    !model.insideBoard &&
    ready?.graphText &&
    model.name.trim() &&
    new TextEncoder().encode(creationBody(model.creationId, model.name, ready.graphText))
      .byteLength > requestLimit;

  const alchemy = model.format === 'alchemy';
  const title = alchemy ? 'Import Alchemy infrastructure' : 'Import a LikeC4 view';
  return {
    title,
    body: h.section(
      [
        h.AriaLabel(alchemy ? 'Alchemy infrastructure import' : 'LikeC4 import'),
        h.Style({ display: 'grid', gap: '1rem' }),
      ],
      [
        h.h2([], [title]),
        ...(blockedReason ? [h.p([h.Role('status')], [blockedReason])] : []),
        ...(emptyImport ? [h.p([h.Role('status')], ['This view has no nodes to import.'])] : []),
        h.label(
          [],
          [
            alchemy ? 'Alchemy infrastructure JSON file' : 'LikeC4 JSON file',
            h.input([
              h.Key(String(model.fileKey)),
              h.Type('file'),
              h.Accept('.json,application/json'),
              h.Disabled(disabled),
              h.OnFileChange(([file]) => Message.SelectedFile({ file })),
            ]),
          ],
        ),
        ...(alchemy
          ? [
              h.label(
                [],
                [
                  'Or paste Alchemy infrastructure JSON',
                  h.textarea([
                    h.Value(model.source),
                    h.Disabled(disabled || model.reading),
                    h.Maxlength(requestLimit),
                    h.OnInput((text) => Message.ChangedSnapshotText({ text })),
                  ]),
                ],
              ),
              h.button(
                [
                  h.Type('button'),
                  h.Disabled(disabled || model.reading || !model.source.trim()),
                  h.OnClick(Message.ClickedReviewSnapshot()),
                ],
                ['Review snapshot'],
              ),
            ]
          : []),
        h.p([h.AriaLive('polite')], [model.reading ? 'Reading file…' : model.notice]),
        ...(model.views.length
          ? [
              h.label(
                [],
                [
                  'Static view',
                  h.select(
                    [
                      h.Value(model.selected),
                      h.Disabled(disabled),
                      h.OnChange((id) => Message.SelectedView({ id })),
                    ],
                    [
                      h.option([h.Value('')], ['Choose a view']),
                      ...model.views.map((id) => h.option([h.Value(id), h.Key(id)], [id])),
                    ],
                  ),
                ],
              ),
            ]
          : []),
        ...(ready
          ? [
              h.h3([], ['Diagram preview']),
              ...('provenance' in ready
                ? [
                    h.p([], [`Source: ${ready.provenance}`]),
                    h.p(
                      [],
                      [
                        'Resources, bindings and dependencies from the captured plan. Action labels describe the plan at capture time.',
                      ],
                    ),
                  ]
                : []),
              ...(model.focused
                ? [
                    h.button(
                      [h.Type('button'), h.OnClick(Message.FocusedFinding({ resource: null }))],
                      ['Show whole stack'],
                    ),
                  ]
                : []),
              ...(ready.svg
                ? [
                    h.img([
                      h.Src('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ready.svg)),
                      h.Alt(
                        model.focused
                          ? 'Read-only preview focused on ' + model.focused
                          : 'Read-only preview of ' + model.selected,
                      ),
                      h.Style({ width: '100%', 'max-height': '26rem', 'object-fit': 'contain' }),
                    ]),
                  ]
                : []),
              h.details(
                [],
                [
                  h.summary(
                    [],
                    [
                      `Elements and relationships (${ready.graph.nodes.length} nodes, ${ready.graph.edges.length} edges)`,
                    ],
                  ),
                  h.ul(
                    [],
                    ready.graph.nodes.map((node) => h.li([h.Key(node.id)], [node.label])),
                  ),
                  h.ul(
                    [],
                    ready.graph.edges.map((edge) =>
                      h.li(
                        [h.Key(edge.id)],
                        [
                          `${nodeLabels.get(edge.source.node)} → ${nodeLabels.get(edge.target.node)}${edge.label ? ': ' + edge.label : ''}`,
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ]
          : []),
        ...(diagnostics.length
          ? [
              h.h3([], ['Import findings']),
              h.ul(
                [],
                diagnostics.map((item) =>
                  h.li(
                    [],
                    [
                      `${item.severity === 'info' ? 'Generated' : item.severity === 'loss' ? 'Loss' : 'Error'} · ${item.subject ? item.subject + ' · ' : ''}${item.message}`,
                      ...(alchemy && item.subject
                        ? [
                            h.button(
                              [
                                h.Type('button'),
                                h.AriaPressed(String(model.focused === item.subject)),
                                h.OnClick(Message.FocusedFinding({ resource: item.subject })),
                              ],
                              [`Show ${item.subject}`],
                            ),
                          ]
                        : []),
                    ],
                  ),
                ),
              ),
            ]
          : []),
        ...(ready?.blockers.length
          ? [
              h.p([h.Role('alert')], [ready.blockers.join(' ')]),
              ...('v3' in ready
                ? [
                    h.a(
                      [
                        h.Href(
                          'data:application/json;charset=utf-8,' + encodeURIComponent(ready.v3),
                        ),
                        h.Download('likec4-view.zloz-v3.json'),
                      ],
                      ['Download Zloz v3'],
                    ),
                  ]
                : []),
            ]
          : []),
        ...(ready?.graphText
          ? [
              ...(!model.insideBoard
                ? [
                    h.label(
                      [],
                      [
                        'Imported diagram name',
                        h.input([
                          h.Value(model.name),
                          h.Maxlength(120),
                          h.Disabled(disabled),
                          h.OnInput((value) => Message.ChangedName({ value })),
                        ]),
                      ],
                    ),
                  ]
                : []),
              ...(diagnostics.some(({ severity }) => severity === 'loss')
                ? [
                    h.label(
                      [],
                      [
                        h.input([
                          h.Type('checkbox'),
                          h.Checked(model.accepted),
                          h.Disabled(disabled),
                          h.OnClick(Message.ChangedAcknowledgement()),
                        ]),
                        ' I reviewed the import losses',
                      ],
                    ),
                  ]
                : []),
              ...(tooLarge
                ? [h.p([h.Role('alert')], ['This creation request exceeds 1 MiB.'])]
                : []),
            ]
          : []),
        ...(review
          ? [
              h.div(
                [],
                [
                  h.button(
                    [h.Type('button'), h.Disabled(disabled), h.OnClick(Message.CancelledPreview())],
                    ['Cancel preview'],
                  ),
                  h.button(
                    [
                      h.Type('button'),
                      h.Disabled(
                        model.insideBoard
                          ? Boolean(blockedReason) || emptyImport || !acceptedGraphText(model)
                          : !candidate(model) || model.submission === 'sending',
                      ),
                      h.OnClick(Message.ClickedApply()),
                    ],
                    [
                      model.insideBoard
                        ? 'Import into this board'
                        : model.submission === 'retry'
                          ? 'Retry creation'
                          : alchemy
                            ? 'Create team diagram'
                            : 'Apply',
                    ],
                  ),
                ],
              ),
            ]
          : []),
      ],
    ),
  };
}
