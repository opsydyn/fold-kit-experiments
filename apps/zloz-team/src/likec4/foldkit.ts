import { Command } from 'foldkit';
import type { HtmlBuilder } from 'foldkit/html';
import type { Return } from 'foldkit/update';

import { readFile } from './effects';
import { creationBody, requestLimit } from './review';
import {
  acceptedGraphText,
  candidate,
  initialState,
  Message,
  ReadFileArgs,
  transition,
  type Props,
  type State,
} from './state';

export { Message, Model, reviewedBoardGraph, type Props } from './state';

const ReadLikeC4File = Command.define('ReadLikeC4File', {
  args: ReadFileArgs,
  messages: [Message.cases.SettledRead],
  execute: readFile,
});

export const init = (props: Props) => ({ model: initialState(props) });

export function update(model: State, message: Message): Return<State, Message> {
  const result = transition(model, message);
  return result.work?._tag === 'ReadFile'
    ? {
        model: result.model,
        commands: [ReadLikeC4File({ file: result.work.file, epoch: result.work.epoch })],
      }
    : { model: result.model };
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
                      ['Download ZLOZ v3'],
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
