import { plotChart } from '@opsydyn/foldkit-viz/foldkit/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { Schema } from 'effect';
import type { Document, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import type { Return } from 'foldkit/update';

import type { AppInitProps } from '../types';
import { displaySpec, examples } from './specs';

import * as styles from './plot-grammar.css';

/** A static page: nothing changes after render, so the Model is empty. */
export const Model = Schema.Struct({});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({});
export type Message = typeof Message.Type;

export const init = (_props: AppInitProps): Return<Model, Message> => ({ model: {} });
export const update = (model: Model): Return<Model, Message> => ({ model });

export const view = (_model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Plot grammar — foldkit-viz',
  body: h.div(
    [h.Class(styles.page)],
    examples.map((example) =>
      h.section(
        [h.Key(example.id), h.Class(styles.example), h.AriaLabel(example.title)],
        [
          h.h2([h.Class(styles.title)], [example.title]),
          h.p([h.Class(styles.note)], [example.note]),
          plotChart(
            h,
            compilePlot({ ...example.spec, title: example.title, description: example.note }),
          ),
          h.details(
            [h.Class(styles.spec)],
            [h.summary([], ['Spec']), h.pre([], [h.code([], [displaySpec(example.spec)])])],
          ),
        ],
      ),
    ),
  ),
});
