import { Match as M, Schema as S } from 'effect'
import { Command, Runtime } from 'foldkit'
import { type Document, html } from 'foldkit/html'
import { m } from 'foldkit/message'

// MODEL

export const Model = S.Struct({ count: S.Number })
export type Model = typeof Model.Type

// MESSAGE

const ClickedDecrement = m('ClickedDecrement')
const ClickedIncrement = m('ClickedIncrement')
const ClickedReset = m('ClickedReset')

export const Message = S.Union([ClickedDecrement, ClickedIncrement, ClickedReset])
export type Message = typeof Message.Type

// UPDATE

export const update = (
  model: Model,
  message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] =>
  M.value(message).pipe(
    M.withReturnType<readonly [Model, ReadonlyArray<Command.Command<Message>>]>(),
    M.tagsExhaustive({
      ClickedDecrement: () => [{ count: model.count - 1 }, []],
      ClickedIncrement: () => [{ count: model.count + 1 }, []],
      ClickedReset: () => [{ count: 0 }, []],
    }),
  )

// INIT

export const init: Runtime.ProgramInit<Model, Message> = () => [{ count: 0 }, []]

// VIEW

const { div, button, Class, OnClick } = html<Message>()

const buttonStyle =
  'cursor-pointer rounded bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-700'

export const view = (model: Model): Document => ({
  title: `Counter: ${model.count}`,
  body: div(
    [Class('flex min-h-screen flex-col items-center justify-center gap-8 bg-white p-6')],
    [
      div([Class('text-7xl font-bold tabular-nums text-neutral-900')], [model.count.toString()]),
      div(
        [Class('flex gap-3')],
        [
          button([OnClick(ClickedDecrement()), Class(buttonStyle)], ['−']),
          button([OnClick(ClickedReset()), Class(buttonStyle)], ['Reset']),
          button([OnClick(ClickedIncrement()), Class(buttonStyle)], ['+']),
        ],
      ),
    ],
  ),
})
