import { Match, pipe, Result } from 'effect';
import { isPending } from 'foldkit/asyncData';
import { modifyFields } from 'foldkit/struct';
import { combine } from 'foldkit/update';
import type { Return, Step } from 'foldkit/update';

import type { Request } from './data';
import { Message } from './message';
import type { Model } from './model';
import { DatasetQuery } from './query';

const dataset = DatasetQuery.lift<Model, Message>({
  parentField: 'datasets',
  toParentMessage: (message) => Message.GotDatasetMessage({ message }),
});

const request =
  (
    operation: typeof dataset.loadIfMissing,
    profile: Request['profile'],
    fail: boolean,
  ): Step<Model, Message> =>
  (model) =>
    pipe(
      operation(model, { dataset: model.selected, revision: model.nextRevision, profile, fail }),
      (result) => ({
        ...result,
        model: modifyFields(result.model, {
          nextRevision: (revision) => revision + (result.commands?.length ?? 0),
        }),
      }),
    );

export const loadSelected = request(dataset.loadIfMissing, 'normal', false);
const refreshSelected = request(dataset.revalidateOrLoad, 'normal', false);

const recordCompletion = (
  model: Model,
  message: typeof DatasetQuery.Message.Type,
  result: Return<Model, Message>,
): Return<Model, Message> => ({
  ...result,
  model: modifyFields(result.model, {
    trace: (trace) =>
      [
        ...trace,
        {
          dataset: message.args.dataset,
          revision: message.args.revision,
          outcome: pipe(
            Match.value(
              isPending(DatasetQuery.read(model.datasets, message.args)) &&
                !isPending(DatasetQuery.read(result.model.datasets, message.args)),
            ),
            Match.when(true, () =>
              Result.match(message.result, {
                onSuccess: () => 'accepted' as const,
                onFailure: () => 'failed' as const,
              }),
            ),
            Match.orElse(() => 'ignored' as const),
          ),
        },
      ].slice(-8),
  }),
});

export const update = (model: Model, message: Message): Return<Model, Message> =>
  Message.match(message, {
    ClickedDataset: ({ dataset: selected }) =>
      loadSelected(
        modifyFields(model, {
          selected: () => selected,
        }),
      ),
    ClickedRefresh: () => refreshSelected(model),
    ClickedFailedRefresh: () => request(dataset.revalidateOrLoad, 'normal', true)(model),
    ClickedResponseRace: () =>
      combine(model, [
        dataset.reset,
        request(dataset.loadIfMissing, 'slow', false),
        dataset.reset,
        request(dataset.loadIfMissing, 'fast', false),
      ]),
    GotDatasetMessage: ({ message }) =>
      recordCompletion(model, message, dataset.fold(model, message)),
  });
