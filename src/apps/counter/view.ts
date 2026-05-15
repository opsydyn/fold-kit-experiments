import type { Document } from 'foldkit/html'
import { html } from 'foldkit/html'

import type { Model } from './model'
import { ClickedDecrement, ClickedIncrement, ClickedReset } from './message'
import type { Message } from './message'
import * as styles from './counter.css'

const { div, button, Class, OnClick } = html<Message>()

export const view = (model: Model): Document => ({
  title: `Counter: ${model.count}`,
  body: div(
    [Class(styles.container)],
    [
      div([Class(styles.count)], [model.count.toString()]),
      div(
        [Class(styles.controls)],
        [
          button([OnClick(ClickedDecrement()), Class(styles.button)], ['−']),
          button([OnClick(ClickedReset()), Class(styles.button)], ['Reset']),
          button([OnClick(ClickedIncrement()), Class(styles.button)], ['+']),
        ],
      ),
    ],
  ),
})
