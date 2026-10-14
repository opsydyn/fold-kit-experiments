/**
 * The scene view: one call from a Foldkit `view` renders a scene and maps its events to
 * the app's typed Messages. The scene is plain data derived from the Model.
 *
 * @module
 */
import type { SceneDescription, SceneSchema } from '@opsydyn/effect-three';
import { Array as Arr, Option } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { type SceneError, sceneElement, type SceneLifecycle } from './element.ts';
import type { SceneMount } from './mount.ts';

/** Detail of click, pointer-down and pointer-up events. */
export type ButtonDetail = typeof SceneSchema.ButtonDetail.Type;

/** Detail of pointer-enter and pointer-leave events. */
export type KeyDetail = typeof SceneSchema.KeyDetail.Type;

export type ViewConfig<Message> = {
  /** The scene to show. Derive it from the Model; unchanged scenes cost nothing. */
  readonly scene: SceneDescription;
  /** The Mount from `makeSceneMount`, created once at the entry point. */
  readonly mount: SceneMount;
  /** Maps the mount outcome (started or failed) into the app's Messages. */
  readonly onLifecycle: (message: SceneLifecycle) => Message;
  readonly onClick?: (detail: ButtonDetail) => Message;
  readonly onPointerDown?: (detail: ButtonDetail) => Message;
  readonly onPointerUp?: (detail: ButtonDetail) => Message;
  readonly onPointerEnter?: (detail: KeyDetail) => Message;
  readonly onPointerLeave?: (detail: KeyDetail) => Message;
  /** A scene update was rejected; the scene keeps its last good state. */
  readonly onError?: (detail: { readonly error: SceneError }) => Message;
  readonly className?: string;
};

const given = Option.fromNullishOr;

/** Renders a scene element. Only the event handlers you pass are bound. */
export const view = <Message>(
  config: ViewConfig<NoInfer<Message>>,
  h: HtmlBuilder<Message>,
): Html => {
  const element = sceneElement.withMessage(h);
  const optional = Arr.getSomes([
    Option.map(given(config.onClick), element.OnSceneClick),
    Option.map(given(config.onPointerDown), element.OnScenePointerDown),
    Option.map(given(config.onPointerUp), element.OnScenePointerUp),
    Option.map(given(config.onPointerEnter), element.OnScenePointerEnter),
    Option.map(given(config.onPointerLeave), element.OnScenePointerLeave),
    Option.map(given(config.onError), element.OnSceneError),
    Option.map(given(config.className), h.Class),
  ]);
  const lifecycle = Mount.mapMessage(config.mount(), config.onLifecycle);
  return element([element.Scene(config.scene), h.OnMount(lifecycle), ...optional], []);
};
