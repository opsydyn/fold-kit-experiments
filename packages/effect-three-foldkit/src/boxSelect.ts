/**
 * Box selection as an Effect UI submodel (roadmap, "Beyond parity" 5), after Drei's `Select`
 * over three.js's `SelectionBox`: a shift-drag that begins on nothing draws a box, and
 * its release selects what the box holds, through the core's pure `boxSelect`. The parent
 * owns what is selected; the submodel owns only the box:
 *
 * - `Dragged` (each scene `Drag` gesture the box `claims`, made with `dragOf`) starts the box
 *   where the press was and moves its far corner by the gesture's deltas;
 * - `Ended` (the scene's `GestureEnd`, with the camera and what can be selected) reports
 *   `Selected { keys }`, which replaces the selection as Drei's box does, and clears the
 *   box;
 * - `Cancelled` clears the box and selects nothing.
 *
 * `rectangle(model)` places the box on the canvas in CSS pixels, for an HTML outline, and
 * `inside(model, camera, selectable)` says what the box holds so far, for highlighting
 * while it is drawn (Drei selects as the box moves).
 *
 * @module
 */

import { UiSchema } from '@effect/ui';
import { BoxSelect as Controller } from '@opsydyn/effect-three/browser';

export const { Box, Model, init, drawing, claims, inside, rectangle } = Controller;
export type Model = Controller.Model;
export type DragGesture = Controller.DragGesture;
export type Rectangle = Controller.Rectangle;

export const Message = UiSchema.TaggedEnum(Controller.MessageFields);
export type Message = typeof Message.Type;
export const OutMessage = UiSchema.TaggedEnum(Controller.OutMessageFields);
export type OutMessage = typeof OutMessage.Type;

export const update = Controller.update;

/** Turns the scene's drag gesture into the box selection's message. */
export const dragOf = (gesture: DragGesture): Message => Controller.dragOf(gesture);
