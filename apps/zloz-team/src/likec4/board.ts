import { Command } from '@effect/ui';

import { readFile } from './effects';
import { initialState, Message, ReadFileArgs, transition, type Props, type State } from './state';
export { Message, Model, reviewedBoardGraph, type Props } from './state';
export { importView as view } from './view';
const Read = Command.make('ReadLikeC4File', { args: ReadFileArgs }, readFile);
export const init = (props: Props) => ({ model: initialState(props) });
export function update(model: State, message: Message) {
  const result = transition(model, message);
  const work = result.work;
  return {
    model: result.model,
    commands: work?._tag === 'ReadFile' ? [Read.make({ file: work.file, epoch: work.epoch })] : [],
  };
}
