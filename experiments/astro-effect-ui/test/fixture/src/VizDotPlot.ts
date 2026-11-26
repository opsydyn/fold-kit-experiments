import { Html } from '@effect/ui/html';
import { compileChecked, decodePlot } from '@opsydyn/foldkit-viz/effect/plot';
import { Schema } from 'effect';

/** The fixture exercises the wire boundary and the circle renderer. */
export const VizDotPlot = Html.component({
  name: 'VizDotPlot',
  props: Schema.Struct({ spec: Schema.Unknown }),
  model: Schema.Null,
  message: Schema.Never,
}).make({
  init: () => null,
  update: ($) => $.model,
  view: (h) => {
    const decoded = decodePlot(h.props.spec);
    if (decoded._tag === 'Failure') return h.p(decoded.failure.message);
    const compiled = compileChecked(decoded.success);
    if (compiled._tag === 'Failure') return h.p(compiled.failure.message);

    const geometry = compiled.success;
    const dots = geometry.facets
      .flatMap((facet) => facet.marks.flatMap((mark) => mark.graphics))
      .filter((graphic) => graphic.kind === 'circle');
    return h
      .el('svg')
      .attr('role', 'img')
      .attr('aria-label', geometry.title)
      .attr('aria-description', geometry.description)
      .attr('viewBox', `0 0 ${geometry.width} ${geometry.height}`)
      .children(
        ...dots.map((dot) =>
          h
            .el('circle')
            .attr('cx', String(dot.cx))
            .attr('cy', String(dot.cy))
            .attr('r', String(dot.r))
            .attr('fill', dot.fill)
            .children(),
        ),
      );
  },
});
