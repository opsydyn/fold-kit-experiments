import { defineMessageUnion } from 'foldkit/message';

import { DatasetId } from './data';
import { DatasetQuery } from './query';

export const Message = defineMessageUnion({
  ClickedDataset: { dataset: DatasetId },
  ClickedRefresh: {},
  ClickedFailedRefresh: {},
  ClickedResponseRace: {},
  GotDatasetMessage: { message: DatasetQuery.Message },
});
export type Message = typeof Message.Type;
