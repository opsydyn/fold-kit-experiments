import type { Command } from '@effect/ui';
import { Match, Result, Struct } from 'effect';

import { FetchDatasetSnapshot, FocusSourceLine, HighlightSource } from './command';
import type { Request } from './data';
import { validChartWidth } from './frame';
import { settleHighlighting, sourceMatches } from './highlighting-core';
import { Message } from './message';
import type { Model } from './model';
import { DatasetQuery, type Completion } from './query';
import { sourceContent, SourceName } from './source';
import type { SourceLine } from './source-line-core';

interface Transition {
  readonly model: Model;
  readonly commands?: ReadonlyArray<Command.Issued<Message, never, never, 'Effect'>>;
}

const request = (
  model: Model,
  profile: Request['profile'],
  fail: boolean,
  reset = false,
): Transition => {
  const args = {
    source: model.transport,
    fixturesUrl: model.fixturesUrl,
    dataset: model.selected,
    revision: model.nextRevision,
    profile,
    fail,
  };
  const entry = reset ? {} : DatasetQuery.read(model.datasets, args);
  return {
    model: Struct.assign(model, {
      nextRevision: model.nextRevision + 1,
      datasets: DatasetQuery.write(model.datasets, args, {
        snapshot: entry.snapshot,
        pending: args.revision,
      }),
    }),
    commands: [FetchDatasetSnapshot.make({ args, generation: args.revision })],
  };
};

export const loadSelected = (model: Model): Transition => {
  const { pending, snapshot } = DatasetQuery.read(model.datasets, {
    dataset: model.selected,
    source: model.transport,
  });
  if (pending !== undefined || snapshot !== undefined) return { model };
  return request(model, 'normal', false);
};

const settle = (model: Model, { args, generation, result }: Completion): Transition => {
  const previous = DatasetQuery.read(model.datasets, args);
  const accepted = previous.pending === generation;
  const next = Result.match(result, {
    onSuccess: (snapshot) => ({ snapshot }),
    onFailure: (error) => ({ snapshot: previous.snapshot, error }),
  });
  const outcome: Model['trace'][number]['outcome'] = !accepted
    ? 'ignored'
    : Result.isSuccess(result)
      ? 'accepted'
      : 'failed';
  const trace = [...model.trace, { dataset: args.dataset, revision: args.revision, outcome }].slice(
    -8,
  );
  const datasets = accepted ? DatasetQuery.write(model.datasets, args, next) : model.datasets;
  return { model: Struct.assign(model, { datasets, trace }) };
};

const navigate = (model: Model, location: SourceLine): Transition => {
  const name = SourceName.literals.find((name) => name === location.name);
  if (
    name === undefined ||
    (name !== 'snapshot.json' && !model.sources.some((source) => source.name === name))
  )
    return { model };
  const next = Struct.assign(model, { activeFile: name });
  if (
    !Number.isSafeInteger(location.line) ||
    location.line < 1 ||
    location.line > sourceContent(next).split('\n').length
  )
    return { model };
  return { model: next, commands: [FocusSourceLine.make(location)] };
};

const withHighlighting = (transition: Transition): Transition => {
  const { model } = transition;
  if (model.sources.length === 0) return transition;
  const source = sourceContent(model);
  const language = model.activeFile;
  if (
    sourceMatches(model.highlightedSource, source, language) ||
    sourceMatches(model.requestedSource, source, language)
  )
    return transition;
  const requestedSource = { source, language };
  return {
    model: Struct.assign(model, { requestedSource }),
    commands: [...(transition.commands ?? []), HighlightSource.make(requestedSource)],
  };
};

const race = (model: Model): Transition => {
  const slow = request(model, 'slow', false, true);
  const fast = request(slow.model, 'fast', false, true);
  return { model: fast.model, commands: [...(slow.commands ?? []), ...(fast.commands ?? [])] };
};

const resize = (model: Model, width: number): Transition =>
  Match.value(width).pipe(
    Match.when(
      (value) => validChartWidth(value) && value !== model.chartWidth,
      (chartWidth) => ({ model: Struct.assign(model, { chartWidth }) }),
    ),
    Match.orElse(() => ({ model })),
  );

export const update = (model: Model, message: Message): Transition =>
  withHighlighting(
    Message.match(message, {
      MountedExplorer: () => loadSelected(model),
      NavigatedSourceLine: (location) => navigate(model, location),
      CompletedSourceLineFocus: () => ({ model }),
      SettledHighlightedSource: ({ highlightedSource }) => ({
        model: settleHighlighting(model, highlightedSource, sourceContent(model), model.activeFile),
      }),
      RecordedChartWidth: ({ width }) => resize(model, width),
      SelectedSource: ({ name }) => ({ model: Struct.assign(model, { activeFile: name }) }),
      ClickedDataset: ({ dataset: selected }) => loadSelected(Struct.assign(model, { selected })),
      ClickedRefresh: () => request(model, 'normal', false),
      ClickedFailedRefresh: () => request(model, 'normal', true),
      ClickedResponseRace: () => race(model),
      GotDatasetMessage: ({ message }) => settle(model, message),
    }),
  );
