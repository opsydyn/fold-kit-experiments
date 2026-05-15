import { Match } from 'effect'
import type { Command } from 'foldkit'

import type { Message } from './message'
import { _elapsedMs } from './model'
import type { Model } from './model'

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>]

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      FetchedHealth: ({ status, uptimeSeconds, startedAt, timestamp }) => [
        {
          _tag: 'Loaded',
          data: { status, uptimeSeconds, startedAt, timestamp },
          elapsedMs: 0,
          sinceLabel: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(new Date(startedAt)),
        },
        [],
      ],
      FetchFailed: ({ error }) => [
        { _tag: 'Failed', error },
        [],
      ],
      TickedFrame: ({ deltaTimeMs }) => {
        if (model._tag !== 'Loaded') return [model, []]
        return [_elapsedMs.modify(ms => ms + deltaTimeMs)(model), []]
      },
    }),
  )
