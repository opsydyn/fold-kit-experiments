import { BoardTitle } from '@opsydyn/zloz-server/src/team-contract';
import { Result, Schema, Stream } from 'effect';

// The shell and canvas are separate islands on the same board page.
const eventName = 'zloz:board-title';
const decodeTitle = Schema.decodeUnknownResult(BoardTitle);

export const publishTitle = (title: BoardTitle) =>
  window.dispatchEvent(new CustomEvent(eventName, { detail: title }));

export const titleChanges = <M>(observed: (title: BoardTitle) => M) =>
  Stream.suspend(() =>
    Stream.fromEventListener(window, eventName).pipe(
      Stream.filterMap((event) =>
        event instanceof CustomEvent
          ? Result.map(decodeTitle(event.detail), observed)
          : Result.fail(undefined),
      ),
    ),
  );
