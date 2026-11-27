import { Html } from '@effect/ui/html';

import { loadBundledSnapshot } from './data';
import { Message } from './message';
import { initModel, State } from './model';
import { update } from './update';
import { view } from './view';

const data = loadBundledSnapshot();
const { data: _data, ...initial } = initModel(data);

export const EarthquakeGlobe = Html.component({
  name: 'EarthquakeGlobe',
  model: State,
  message: Message,
}).make({
  init: () => initial,
  update: ($, message) => {
    const current = { ...$.model, data };
    const result = update(current, message).model;
    if (result === current) return $.model;
    const { data: _data, ...next } = result;
    return next;
  },
  view: (h, model) => view({ ...model, data }, h),
});
