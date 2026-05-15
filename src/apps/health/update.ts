import { Match as M } from 'effect'
import type { Command } from 'foldkit'

import type { Message } from './message'
import type { Model } from './model'

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>]

export const update = (model: Model, message: Message): Return =>
  M.value(message).pipe(
    M.withReturnType<Return>(),
    M.tagsExhaustive({
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
