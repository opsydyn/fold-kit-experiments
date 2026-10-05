import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

import { DatasetId } from './data';
import { DatasetQuery } from './query';
import { SourceName } from './source';

export const Message = defineMessageUnion({
  RecordedChartWidth: { width: Schema.Number },
  SelectedSource: { name: SourceName },
  ClickedDataset: { dataset: DatasetId },
  ClickedRefresh: {},
  ClickedFailedRefresh: {},
  ClickedResponseRace: {},
  GotDatasetMessage: { message: DatasetQuery.Message },
});
export type Message = typeof Message.Type;
