/**
 * `client:interaction`: hydrate a pre-rendered FoldKit island on the reader's
 * first sign of intent rather than at load or on sight, and replay what they
 * did before it booted.
 *
 * FoldKit's `embed` renders fresh: it replaces the pre-rendered markup instead
 * of adopting it. A click that triggers the download would otherwise be lost,
 * and anything typed or focused before the swap would vanish with the old DOM.
 * So the directive records clicks, edited form values and focus inside the
 * island while the application loads, and replays them onto the matching
 * elements of the first client render. The match is by position: server and
 * client run the same pure `init` and `view` over the same props, so the two
 * trees have the same shape.
 *
 * Astro bundles this module on its own into an inline script, so it imports
 * nothing.
 */

/** Options for `client:interaction`. */
export type InteractionOptions = Readonly<{
  /**
   * Also hydrate when a mouse pointer moves over the island. Hover usually
   * comes well before a click, so the application is often ready by then, at
   * the cost of loading for readers who only pass over it.
   */
  hover?: boolean;
}>;

export type TreeNode = {
  readonly tagName: string;
  readonly parentElement: TreeNode | null;
  readonly children: ArrayLike<TreeNode>;
};

/** Where an element sits under a root: the child index at each level. */
export type Position = Readonly<{ path: ReadonlyArray<number>; tagName: string }>;

export const positionOf = (root: TreeNode, target: TreeNode): Position | undefined => {
  const path: Array<number> = [];
  let node = target;
  while (node !== root) {
    const parent = node.parentElement;
    if (parent === null) return undefined;
    path.unshift(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return { path, tagName: target.tagName };
};

/** The element at `position` under `root`, if it is still the same kind of element. */
export const resolvePosition = (root: TreeNode, position: Position): TreeNode | undefined => {
  let node: TreeNode | undefined = root;
  for (const index of position.path) {
    node = node.children[index];
    if (node === undefined) return undefined;
  }
  return node.tagName === position.tagName ? node : undefined;
};

type Field = TreeNode &
  EventTarget & {
    value: string;
    readonly disabled?: boolean;
  };

type Focusable = TreeNode & {
  readonly focus: (options?: FocusOptions) => void;
  readonly setSelectionRange?: (start: number, end: number) => void;
  readonly disabled?: boolean;
};

type Clickable = TreeNode & { readonly click: () => void; readonly disabled?: boolean };

/** One thing the reader did before the application booted. */
export type Step =
  | Readonly<{ kind: 'click'; position: Position }>
  | Readonly<{ kind: 'value'; position: Position; value: string }>;

/** What the reader did inside the island before the application booted, in order. */
export type Recording = Readonly<{
  steps: ReadonlyArray<Step>;
  focus:
    | Readonly<{ position: Position; selection?: readonly [number, number] | undefined }>
    | undefined;
}>;

const samePosition = (a: Position, b: Position): boolean =>
  a.tagName === b.tagName &&
  a.path.length === b.path.length &&
  a.path.every((index, level) => index === b.path[level]);

/**
 * Adds a step, folding a run of edits to one field into its latest value: the
 * application needs where the reader got to, not every keystroke.
 */
export const appendStep = (steps: ReadonlyArray<Step>, step: Step): ReadonlyArray<Step> => {
  const last = steps.at(-1);
  return step.kind === 'value' &&
    last?.kind === 'value' &&
    samePosition(last.position, step.position)
    ? [...steps.slice(0, -1), step]
    : [...steps, step];
};

const dispatch = (target: EventTarget, type: string): void => {
  target.dispatchEvent(new Event(type, { bubbles: true }));
};

const replayStep = (root: TreeNode, step: Step): void => {
  // SAFETY: The position matched an element of the same tag as the recorded one.
  const target = resolvePosition(root, step.position) as (Field & Clickable) | undefined;
  if (target === undefined || target.disabled === true) return;
  if (step.kind === 'click') return target.click();
  if (target.value === step.value) return;
  target.value = step.value;
  dispatch(target, 'input');
  dispatch(target, 'change');
};

/**
 * Replays a recording onto the freshly rendered application under `root`, in
 * the order the reader acted, then restores focus. A value reaches the
 * application as `input` and `change` events, as typing would.
 *
 * Steps whose element no longer matches, or is disabled, are skipped: a
 * control the application has not enabled must not receive input the reader
 * could not have given it. The pre-rendered markup never reacted to the
 * reader, so a field the application would have changed between two edits
 * holds the reader's text as typed into the static field.
 */
export const replay = (root: TreeNode, recording: Recording): void => {
  for (const step of recording.steps) replayStep(root, step);
  if (recording.focus === undefined) return;
  // SAFETY: The position matched an element of the same tag as the focused one.
  const target = resolvePosition(root, recording.focus.position) as Focusable | undefined;
  if (target === undefined || target.disabled === true) return;
  target.focus({ preventScroll: true });
  const selection = recording.focus.selection;
  if (selection !== undefined) target.setSelectionRange?.(selection[0], selection[1]);
};

const triggers = ['pointerdown', 'focusin', 'keydown'] as const;
const recorded = ['click', 'focusin', 'focusout', 'input', 'change', 'submit'] as const;

/** Fields whose state a click changes, so replaying the click carries it. */
const checkable = new Set(['checkbox', 'radio']);

/** The control a click on `target` will be forwarded to, when it is inside a label for another element. */
const labelledControl = (target: Element): HTMLElement | null => {
  const control = target.closest('label')?.control ?? null;
  return control === null || control === target || control.contains(target) ? null : control;
};

/** The caret or selection of a text field, if it has one. */
const selectionOf = (element: Element): readonly [number, number] | undefined => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement))
    return undefined;
  // Fields such as number and email report no text selection.
  const { selectionStart, selectionEnd } = element;
  return selectionStart === null || selectionEnd === null
    ? undefined
    : [selectionStart, selectionEnd];
};

/**
 * The application root that replaced `oldRoot`. FoldKit renders its root in
 * place of the mount element; should it ever render inside the mount instead,
 * the mount is still in its slot and the root is its first child.
 */
export const currentRoot = <Node extends TreeNode>(
  slot: Readonly<{ parent: Node; index: number; mount: Node }>,
): Node | undefined => {
  // SAFETY: Children of a node are nodes of the same kind.
  const occupant = slot.parent.children[slot.index] as Node | undefined;
  // SAFETY: Children of a node are nodes of the same kind.
  return occupant === slot.mount ? (slot.mount.children[0] as Node | undefined) : occupant;
};

/** Resolves once `oldRoot` has left the document, which is when the client render replaced it. */
const replacement = (el: HTMLElement, oldRoot: Element): Promise<void> =>
  new Promise((resolve) => {
    if (!oldRoot.isConnected) return resolve();
    const observer = new MutationObserver(() => {
      if (oldRoot.isConnected) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(el, { childList: true, subtree: true });
  });

type DirectiveLoad = () => Promise<() => Promise<void>>;

const interactionDirective = (
  load: DirectiveLoad,
  options: { readonly value: unknown },
  el: HTMLElement,
): void => {
  // `client:interaction={{ hover: true }}` arrives as that object; a bare attribute as a string.
  const { value } = options;
  const hover = value instanceof Object && 'hover' in value && value.hover === true;
  // Positions are taken from the pre-rendered application root, which the
  // client render replaces with a root of the same shape.
  const mount = el.querySelector('[data-foldkit-island]');
  const oldRoot = mount?.firstElementChild ?? null;
  const parent = mount?.parentElement ?? null;
  if (mount === null || oldRoot === null || parent === null) {
    // Nothing was pre-rendered, so there is nothing to interact with: the
    // server warns about this. Hydrate at once rather than never.
    void load().then((hydrate) => hydrate());
    return;
  }
  const slot = { parent, index: Array.prototype.indexOf.call(parent.children, mount), mount };
  let steps: ReadonlyArray<Step> = [];
  let focused: Readonly<{ element: Element; position: Position }> | undefined;
  let started = false;

  // Before boot the tree is static, so a position read now still holds at the swap.
  const record = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const position = positionOf(oldRoot, target);
    if (position === undefined) return;
    switch (event.type) {
      case 'click':
        // A link works without JavaScript; replaying it would follow it twice.
        if (target.closest('a[href]') !== null) return;
        // A label forwards its click to its control, and that click is recorded.
        if (labelledControl(target) !== null) return;
        steps = appendStep(steps, { kind: 'click', position });
        return;
      case 'focusin':
        focused = { element: target, position };
        return;
      case 'focusout':
        // Moving focus elsewhere clears it; the swap removing the element does not.
        setTimeout(() => {
          if (focused?.element === target && target.isConnected) focused = undefined;
        });
        return;
      case 'submit':
        // The click on its submitter is recorded and replayed instead.
        event.preventDefault();
        return;
      default:
        if (
          (target instanceof HTMLInputElement && !checkable.has(target.type)) ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement
        )
          steps = appendStep(steps, { kind: 'value', position, value: target.value });
    }
  };

  const stopRecording = (): void => {
    for (const type of recorded) el.removeEventListener(type, record, true);
  };

  const replayRecording = (): void => {
    const recording: Recording = {
      steps,
      focus:
        focused === undefined || focused.element.isConnected
          ? undefined
          : { position: focused.position, selection: selectionOf(focused.element) },
    };
    const root = currentRoot(slot);
    if (root !== undefined) replay(root, recording);
  };

  const hydrateAndReplay = (): Promise<void> => {
    const swapped = replacement(el, oldRoot);
    return load()
      .then((hydrate) => hydrate())
      .then(() => swapped)
      .finally(stopRecording)
      .then(replayRecording);
  };

  const start = (event: Event): void => {
    // SAFETY: Only pointer events reach this check.
    if (event.type === 'pointerover' && (event as PointerEvent).pointerType !== 'mouse') return;
    if (started) return;
    started = true;
    for (const type of [...triggers, 'pointerover']) el.removeEventListener(type, start, true);
    void hydrateAndReplay();
  };

  for (const type of recorded) el.addEventListener(type, record, true);
  for (const type of triggers) el.addEventListener(type, start, true);
  if (hover) el.addEventListener('pointerover', start, true);
};

export default interactionDirective;
