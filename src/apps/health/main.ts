import type { Runtime } from 'foldkit'

import { FetchHealth } from './command'
import { Message } from './message'
import { Model, init as initialModel } from './model'
import { update } from './update'
import { view } from './view'

export { Model, Message, update, view }
export { subscriptions } from './subscription'

export const init: Runtime.ProgramInit<typeof Model.Type, typeof Message.Type> = () => [
  initialModel,
  [FetchHealth()],
]
