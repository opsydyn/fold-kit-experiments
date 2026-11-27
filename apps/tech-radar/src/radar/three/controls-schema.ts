import { Schema } from 'effect';

import { categoryIds } from './data';

export const CategoryFilter = Schema.Literals([...categoryIds, 'all']);
export type CategoryFilter = typeof CategoryFilter.Type;

/**
 * How the reader points: with a mouse or pen that can hover, or a finger that cannot. A
 * finger's "hover" is its press, under the finger and gone as it lifts, so on touch a tap
 * is how you read.
 */
export const PointerInput = Schema.Literals(['hover', 'touch']);
export type PointerInput = typeof PointerInput.Type;

/** The sidebar's icon-only buttons: a tooltip names each on hover or keyboard focus. */
export const IconControl = Schema.Literals(['turn-left', 'turn-right', 'zoom-out', 'zoom-in']);
export type IconControl = typeof IconControl.Type;
