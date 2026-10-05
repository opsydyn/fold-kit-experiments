import { defineMessageUnion } from 'foldkit/message';

import { DatasetId } from './data';
import { DatasetQuery } from './query';
import { SourceName } from './source';

export const Message = defineMessageUnion({
  SelectedSource: { name: SourceName },
  ClickedDataset: { dataset: DatasetId },
  ClickedRefresh: {},
  ClickedFailedRefresh: {},
  ClickedResponseRace: {},
  GotDatasetMessage: { message: DatasetQuery.Message },
});
export type Message = typeof Message.Type;
