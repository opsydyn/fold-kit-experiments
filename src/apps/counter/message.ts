import { Schema as S } from 'effect'
import { m } from 'foldkit/message'

export const ClickedDecrement = m('ClickedDecrement')
export const ClickedIncrement = m('ClickedIncrement')
export const ClickedReset = m('ClickedReset')

export const Message = S.Union([ClickedDecrement, ClickedIncrement, ClickedReset])
export type Message = typeof Message.Type
