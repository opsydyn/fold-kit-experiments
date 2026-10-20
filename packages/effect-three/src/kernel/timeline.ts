/**
 * A timeline of physics steps, as data (ADR-014): inputs stamped with the step they apply
 * at, and how far a world on `physics({ until })` may go. Peers (or a replay) that give
 * the same inputs at the same steps to the same world get the same world, however their
 * frames fell, because every change lands while the world waits at its step.
 *
 * The Model keeps a `Timeline`, `schedule`s inputs as they are agreed (a lockstep turn's,
 * a recording's), moves the `frontier` as far as is known, `reach`es each step the world
 * reports (`PhysicsReached`), and applies what `due` hands back. Its scene's physics is
 * `physics({ until: Timeline.until(timeline) })`: the next step with inputs, or the
 * frontier. Use it as a namespace: `Timeline.make()`.
 *
 * @module
 */

/** An input, and the step it applies at. */
export type Scheduled<I> = { readonly step: number; readonly input: I };

export type Timeline<I> = {
  /** Every input, in the order they apply: by step, then as scheduled. */
  readonly inputs: ReadonlyArray<Scheduled<I>>;
  /** How many of `inputs` have been handed out by `due`. */
  readonly applied: number;
  /** The step the world last said it reached; `null` before it says any. */
  readonly reached: number | null;
  /** How far the world may go before more inputs could arrive. */
  readonly frontier: number;
};

/** An empty timeline, the world allowed as far as `frontier`. */
export const make = <I>(frontier = 0): Timeline<I> => ({
  inputs: [],
  applied: 0,
  reached: null,
  frontier,
});

/**
 * `input` at `step`, after any already there. The step must be one the world has not
 * passed: not before `until`. A lockstep session stamps a turn's inputs with that turn's
 * step, which is the frontier until the turn applies.
 */
export const schedule = <I>(timeline: Timeline<I>, step: number, input: I): Timeline<I> => {
  const at = timeline.inputs.findIndex((scheduled) => scheduled.step > step);
  const index = at < 0 ? timeline.inputs.length : at;
  return {
    ...timeline,
    inputs: [...timeline.inputs.slice(0, index), { step, input }, ...timeline.inputs.slice(index)],
  };
};

/** The world may now go as far as `frontier` (a timeline's frontier never goes back). */
export const extend = <I>(timeline: Timeline<I>, frontier: number): Timeline<I> =>
  frontier <= timeline.frontier ? timeline : { ...timeline, frontier };

/** The world said it reached `step`. */
export const reach = <I>(timeline: Timeline<I>, step: number): Timeline<I> =>
  timeline.reached === step ? timeline : { ...timeline, reached: step };

/**
 * The inputs for the step the world is at, to apply now, and the timeline without them.
 * Applied while the world waits there, they land at that step.
 */
export const due = <I>(
  timeline: Timeline<I>,
): { readonly timeline: Timeline<I>; readonly inputs: ReadonlyArray<I> } => {
  const { reached } = timeline;
  if (reached === null) return { timeline, inputs: [] };
  let applied = timeline.applied;
  while ((timeline.inputs[applied]?.step ?? Infinity) <= reached) applied += 1;
  if (applied === timeline.applied) return { timeline, inputs: [] };
  return {
    timeline: { ...timeline, applied },
    inputs: timeline.inputs.slice(timeline.applied, applied).map((scheduled) => scheduled.input),
  };
};

/**
 * Where the world should stop next: at the next step with inputs not yet applied, or at
 * the frontier. Give it as `physics({ until })`.
 */
export const until = <I>(timeline: Timeline<I>): number =>
  Math.min(timeline.inputs[timeline.applied]?.step ?? Infinity, timeline.frontier);

/**
 * The same inputs from the start, for a new world (a newcomer to a session, a replay):
 * nothing applied or reached yet, the frontier where it was.
 */
export const restart = <I>(timeline: Timeline<I>): Timeline<I> => ({
  ...timeline,
  applied: 0,
  reached: null,
});
