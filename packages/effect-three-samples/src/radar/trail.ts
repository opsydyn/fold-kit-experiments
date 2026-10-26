/**
 * Where the camera is, as a trail: the radar, the cluster it stopped at, and the pinned
 * entry, each with the Message that flies back there. The breadcrumb over the stage draws
 * it; kept apart from the view so it is tested without a browser.
 */
import { Option } from 'effect';

import { categoryLabels } from './data';
import { Message } from './message';
import { type Model, positionOf } from './model';

/** One step of the trail: what it reads, and the Message that flies there. */
export type Stop = Readonly<{ label: string; message: Message }>;

export const trailOf = (model: Model): ReadonlyArray<Stop> => {
  const entry = Option.flatMap(model.selected, (id) => positionOf(model, id));
  return [
    { label: 'Radar', message: Message.ClickedUniverse() },
    ...Option.toArray(model.cluster).map((category) => ({
      label: categoryLabels[category],
      message: Message.ClickedCluster({ category }),
    })),
    ...Option.toArray(entry).map(({ entry: current }) => ({
      label: current.name,
      message: Message.ClickedFlyTo({ id: current.id }),
    })),
  ];
};
