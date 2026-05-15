import { Schema as S } from 'effect'

export const Model = S.Struct({ count: S.Number })
export type Model = typeof Model.Type

export const init: Model = { count: 0 }
