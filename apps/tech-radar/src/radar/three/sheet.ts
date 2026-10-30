/**
 * The controls' sheet on a phone: three stops, like a maps app's. Peek shows the search, or
 * the pinned entry's name and actions; half shows the pinned entry's whole card; full shows
 * every control. A tap on the handle moves between peek and half, and a swipe moves a stop
 * up or down. Pure, so it is tested without a browser.
 */
import { Schema } from 'effect';

export const SheetStop = Schema.Literals(['peek', 'half', 'full']);
export type SheetStop = typeof SheetStop.Type;

const stops: ReadonlyArray<SheetStop> = SheetStop.literals;

/** How far a finger moves, in pixels, before a press on the handle is a swipe. */
export const swipeDistance = 32;

/** The stop above or below, staying at the top and the bottom. */
const step = (stop: SheetStop, by: number): SheetStop =>
  stops[Math.max(0, Math.min(stops.length - 1, stops.indexOf(stop) + by))] ?? stop;

/** Where a tap on the handle takes the sheet: peek and half swap, full comes down to half. */
const tapped = (stop: SheetStop): SheetStop => (stop === 'half' ? 'peek' : 'half');

/**
 * Where the sheet goes when a press on its handle ends `travel` pixels from where it began:
 * negative is up the screen, so a swipe up raises the sheet a stop.
 */
export const sheetAfter = (stop: SheetStop, travel: number): SheetStop =>
  Math.abs(travel) < swipeDistance ? tapped(stop) : step(stop, travel < 0 ? 1 : -1);
