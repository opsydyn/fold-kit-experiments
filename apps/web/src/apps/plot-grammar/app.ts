import { Html } from '@effect/ui/html';
import { astroComponent } from '@opsydyn/astro-effect-ui/component';
import { plotChart } from '@opsydyn/foldkit-viz/effect-ui/plot';
import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { Schema } from 'effect';

import { displaySpec, examples } from './specs';

import * as styles from './plot-grammar.css';

/** Each chart renders to HTML without a client directive or island. */
const PlotGrammar = Html.component({
  name: 'PlotGrammar',
  model: Schema.Null,
  message: Schema.Never,
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) =>
    h.div.class(styles.page).children(
      ...examples.map((example) =>
        h.section
          .key(example.id)
          .class(styles.example)
          .attr('aria-label', example.title)
          .children(
            h.h2.class(styles.title).children(example.title),
            h.p.class(styles.note).children(example.note),
            plotChart(
              h,
              compilePlot({ ...example.spec, title: example.title, description: example.note }),
            ),
            h.details
              .class(styles.spec)
              .children(h.summary('Spec'), h.pre(h.code(displaySpec(example.spec)))),
          ),
      ),
    ),
});

export default astroComponent(PlotGrammar);
