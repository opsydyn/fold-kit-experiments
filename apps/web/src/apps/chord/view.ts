import type { Document } from 'foldkit/html';
import * as ChordChart from '../../ui/chord-chart';
import type { Message } from './message';
import { GotChordMessage } from './message';
import type { Model } from './model';

const toParentMessage = (msg: ChordChart.Message): Message => GotChordMessage({ inner: msg });

export const view = (model: Model): Document => ({
  title: 'Chord — foldkit-viz',
  body: ChordChart.view({
    model: model.chord,
    toParentMessage,
    ariaLabel: 'Tech sector cross-investment chord diagram',
  }),
});
