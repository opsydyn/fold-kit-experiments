import { Match as M } from 'effect'
import type { Command } from 'foldkit'

import type { Model } from './model'
import type { Message } from './message'

type Return = readonly [Model, ReadonlyArray<Command.Command<Message>>]

export const update = (model: Model, message: Message): Return =>
  M.value(message).pipe(
    M.withReturnType<Return>(),
    M.tagsExhaustive({
      ClickedDecrement: () => [{ count: model.count - 1 }, []],
      ClickedIncrement: () => [{ count: model.count + 1 }, []],
      ClickedReset: () => [{ count: 0 }, []],
    }),
  )
