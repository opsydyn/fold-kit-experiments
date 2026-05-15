import type { Runtime } from 'foldkit'

import { Model, init as initialModel } from './model'
import { Message } from './message'
import { update } from './update'
import { view } from './view'

export { Model, Message, update, view }

export const init: Runtime.ProgramInit<typeof Model.Type, typeof Message.Type> = () => [
  initialModel,
  [],
]
