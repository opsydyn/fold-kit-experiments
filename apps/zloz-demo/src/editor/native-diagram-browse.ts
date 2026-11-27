import { visuallyHidden } from '@opsydyn/foldkit-zloz/effect-ui';
import { Schema } from 'effect';

import { historyAllowsMessage } from './history';
import { Message } from './message';
import { SearchScope, type Model } from './model';
import { architectureNativePanel } from './native-panel';
import { searchDiagram } from './search';

type Example = Extract<Message, { _tag: 'SelectedExample' }>['example'];

const examples = [
  ['event-storming', 'Open event-storming example'],
  ['event-storming-workshop', 'Open workshop semantics example'],
  ['release', 'Open release workflow'],
  ['c4-context', 'Open C4 system context'],
  ['c4-containers', 'Open C4 container view'],
  ['c4-nested-containers', 'Open nested C4 container view'],
  ['ddd-orders', 'Open DDD Order aggregate'],
  ['context-map', 'Open DDD context map'],
  ['onion', 'Open Onion Architecture'],
  ['grouped-onion', 'Open grouped Onion Architecture'],
  ['large-workflow', 'Open large workflow (320 nodes)'],
  ['protected-orbits', 'Open protected Orbit workflow (320 nodes)'],
  ['port-snapping', 'Open port snapping demo'],
] as const satisfies readonly (readonly [Example, string])[];

type ExamplePicker = Readonly<{
  model: Pick<Model, 'minimalMode' | 'historyReview'>;
  showInstructions: boolean;
}>;

export const nativeExamplePicker = architectureNativePanel<ExamplePicker>(
  'ArchitectureExamplePicker',
  Schema.is(Message.cases.SelectedExample),
  (h, { model, showInstructions }, request) => {
    const instructions = showInstructions ? {} : visuallyHidden;
    return h.div.children(
      h.p
        .style(instructions)
        .children(
          'Open an example to replace the current diagram. Shift-drag the canvas background or Shift-click node titles to select several. Save keeps a copy in this browser.',
        ),
      model.minimalMode
        ? null
        : h.div
            .attr('role', 'group')
            .attr('aria-label', 'Examples')
            .style({ display: 'flex', gap: '8px', flexWrap: 'wrap' })
            .children(
              ...examples.map(([example, label]) => {
                const message = Message.SelectedExample({ example });
                return h.button
                  .key(example)
                  .attr('type', 'button')
                  .disabled(model.historyReview !== null && !historyAllowsMessage(message))
                  .on('click', request(message))
                  .style({ padding: '10px 16px', cursor: 'pointer' })
                  .children(label);
              }),
            ),
      h.p
        .style(instructions)
        .children('In Onion Architecture, arrows show source dependencies toward the domain.'),
    );
  },
);

type DiagramSearch = Pick<
  Model,
  'editor' | 'modelIdentity' | 'modelEpoch' | 'searchQuery' | 'searchScope'
>;

const isSearchScope = Schema.is(SearchScope);

const acceptsSearch = Schema.is(
  Schema.Union([
    Message.cases.ChangedDiagramSearch,
    Message.cases.SelectedSearchScope,
    Message.cases.SubmittedDiagramSearch,
    Message.cases.ObservedModelInput,
  ]),
);

export const nativeDiagramSearch = architectureNativePanel<DiagramSearch>(
  'ArchitectureDiagramSearch',
  acceptsSearch,
  (h, model, request) => {
    const { editor, searchScope, searchQuery } = model;
    const owner = { modelId: model.modelIdentity.id, epoch: model.modelEpoch };
    const item = searchScope === 'nodes' ? 'node' : 'connection';
    const matches = searchDiagram(editor, searchQuery, searchScope);
    const canReveal = editor.surface !== null && editor.gesture.type === 'idle';
    const count = matches.length;
    const summary =
      count === 0
        ? `No matching ${searchScope}`
        : count > 8
          ? `Showing 8 of ${count} matching ${searchScope}`
          : count === 1
            ? `1 matching ${item}`
            : `${count} matching ${searchScope}`;
    return h.form
      .attr('role', 'search')
      .attr('aria-label', `Diagram ${searchScope}`)
      .style({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
        margin: '12px 0',
      })
      .on('submit', ({ fields: { query, scope } }) =>
        query !== undefined && isSearchScope(scope)
          ? request(Message.SubmittedDiagramSearch({ ...owner, query, scope }))
          : undefined,
      )
      .children(
        h.label.children(
          `Find a ${item} `,
          h.input
            .attr('type', 'search')
            .attr('name', 'query')
            .attr('value', searchQuery)
            .attr('placeholder', 'Label or ID')
            .on('input', ({ value: query }) => request(Message.ChangedDiagramSearch({ query }))),
        ),
        h.select
          .attr('name', 'scope')
          .attr('aria-label', 'Search scope')
          .on('change', ({ value }) =>
            isSearchScope(value)
              ? request(Message.SelectedSearchScope({ scope: value }))
              : undefined,
          )
          .children(
            h.option
              .attr('value', 'nodes')
              .selected(searchScope === 'nodes')
              .children('Nodes'),
            h.option
              .attr('value', 'connections')
              .selected(searchScope === 'connections')
              .children('Connections'),
          ),
        h.button
          .attr('type', 'submit')
          .disabled(!canReveal || count === 0)
          .children('Reveal first match'),
        searchQuery.trim()
          ? h.p.attr('role', 'status').style({ margin: '0' }).children(summary)
          : null,
        ...matches.slice(0, 8).map(({ event, label }) =>
          h.button
            .key(event.id)
            .attr('type', 'button')
            .disabled(!canReveal)
            .on('click', request(Message.ObservedModelInput({ ...owner, message: event })))
            .children(label),
        ),
      );
  },
);
