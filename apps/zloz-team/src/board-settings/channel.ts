import { BoardTitle } from '@opsydyn/zloz-server/src/team-contract';
import { Dom } from 'foldkit';

// The shell and canvas are separate islands on the same board page.
const eventName = 'zloz:board-title' as const;
export const publishTitle = (title: BoardTitle) =>
  window.dispatchEvent(new CustomEvent(eventName, { detail: title }));
export const titleChanges = <M>(observed: (title: BoardTitle) => M) =>
  Dom.streamFromEvent({
    target: (): Dom.TypedEventTarget<{ [eventName]: CustomEvent<BoardTitle> }> => window,
    type: eventName,
    mapEvent: (event) => observed(event.detail),
  });
