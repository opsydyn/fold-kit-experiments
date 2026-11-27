import { Option } from 'effect';

import * as PlotPanel from '../../ui/plot-panel/core';
import { containsValue } from '../../ui/shared/inspection';
import type { Model } from './model';

/** The histogram bar whose range holds a salary, by its position in x order. */
export function binHolding(histogram: PlotPanel.Model, salary: number): Option.Option<number> {
  const index = PlotPanel.targetsOf(histogram).findIndex(({ domain, includeEnd }) =>
    containsValue(salary, domain[0], domain[1], includeEnd),
  );
  return index < 0 ? Option.none() : Option.some(index);
}

function highlightHistogram(model: Model, message: PlotPanel.Message): PlotPanel.Model {
  // The sibling's visual selection must not feed an inspection back to its source.
  return PlotPanel.update(model.histogram, message).model;
}

export function updateScatter(model: Model, message: PlotPanel.Message): Model {
  const { model: scatter, outMessage } = PlotPanel.update(model.scatter, message);
  const next = { ...model, scatter };
  if (outMessage?._tag === 'InspectedPoint') {
    const select = Option.match(binHolding(next.histogram, outMessage.y), {
      onNone: () => PlotPanel.Message.BlurredTarget(),
      onSome: (index) => PlotPanel.Message.HoveredTarget({ index }),
    });
    return {
      ...next,
      histogram: highlightHistogram(next, select),
      inspection: Option.some({ _tag: 'Point', key: outMessage.key }),
    };
  }
  if (outMessage?._tag === 'ClearedInspection')
    return {
      ...next,
      histogram: highlightHistogram(next, PlotPanel.Message.BlurredTarget()),
      inspection: Option.none(),
    };
  return next;
}

export function updateHistogram(model: Model, message: PlotPanel.Message): Model {
  const { model: histogram, outMessage } = PlotPanel.update(model.histogram, message);
  const next = { ...model, histogram };
  if (outMessage?._tag === 'InspectedRange') {
    const {
      domain: [lower, upper],
      includeEnd,
    } = outMessage;
    return { ...next, inspection: Option.some({ _tag: 'Range', lower, upper, includeEnd }) };
  }
  return outMessage?._tag === 'ClearedInspection' ? { ...next, inspection: Option.none() } : next;
}
