import { Message } from './message';
import { initialModel } from './model';
import type { Model } from './model';

const MAX_ZOOM = 8;

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(1, zoom));

/** Move the centre by a share of the visible span, keeping latitude on the map. */
const pan = (model: Model, east: number, north: number): Model => {
  const step = 60 / model.zoom;
  const [lng, lat] = model.center;
  const nextLng = ((((lng + east * step + 180) % 360) + 360) % 360) - 180;
  const nextLat = Math.min(70, Math.max(-60, lat + north * step * 0.6));
  return { ...model, center: [nextLng, nextLat] };
};

export const update = (model: Model, message: Message): Model =>
  Message.match(message, {
    ZoomedIn: () => ({ ...model, zoom: clampZoom(model.zoom * 2) }),
    ZoomedOut: () => ({ ...model, zoom: clampZoom(model.zoom / 2) }),
    PannedWest: () => pan(model, -1, 0),
    PannedEast: () => pan(model, 1, 0),
    PannedNorth: () => pan(model, 0, 1),
    PannedSouth: () => pan(model, 0, -1),
    ResetView: () => initialModel,
  });
