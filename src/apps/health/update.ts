import { Match } from 'effect'
import type { Command } from 'foldkit'

import type { Message } from './message'
import type { Model } from './model'

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>]

export const update = (model: Model, message: Message): Return =>
  Match.value(message).pipe(
    Match.withReturnType<Return>(),
    Match.tagsExhaustive({
      FetchedHealth: ({ status, uptimeSeconds, startedAt, timestamp }) => [
        { loading: false, data: { status, uptimeSeconds, startedAt, timestamp }, elapsedMs: 0 },
        [],
      ],
      TickedFrame: ({ deltaTimeMs }) => [
        { ...model, elapsedMs: model.elapsedMs + deltaTimeMs },
        [],
      ],
    }),
  )
