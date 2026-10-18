/** Plain helpers for the labels page, kept apart from the Effect code that mounts it. */

/** Collects the detail of every `type` event `element` dispatches. */
export const collectDetails = (element: Element, type: string): ReadonlyArray<unknown> => {
  const details: Array<unknown> = [];
  element.addEventListener(type, (event) => {
    if (event instanceof CustomEvent) details.push(event.detail);
  });
  return details;
};
