/**
 * TEA chart test harness — run a chart's state machine without a DOM.
 *
 * Usage:
 *   const result = runChart(BarChart.init({ bars }), BarChart.update, [
 *     BarChart.HoveredBar({ index: 0 }),
 *     BarChart.BlurredBar({}),
 *   ]);
 *   expect(result.model.activeIndex).toEqual(Option.none());
 */

export type ChartHarnessResult<Model> = {
  readonly model: Model;
  /** All intermediate models, one per message dispatched */
  readonly history: ReadonlyArray<Model>;
};

type UpdateRecord<Model> = Readonly<{
  readonly model: Model;
  readonly commands?: ReadonlyArray<unknown>;
}>;

/**
 * Run the TEA update loop for a chart.
 * @param initial - Result of `init()`
 * @param update  - The chart's `update` function
 * @param messages - Messages to dispatch in order
 */
export function runChart<Model, Message>(
  initial: UpdateRecord<Model>,
  update: (model: Model, msg: Message) => UpdateRecord<Model>,
  messages: ReadonlyArray<Message>,
): ChartHarnessResult<Model> {
  let model = initial.model;
  const history: Model[] = [];
  for (const msg of messages) {
    model = update(model, msg).model;
    history.push(model);
  }
  return { model, history };
}

/**
 * Assert that a numeric scale produces output within the expected range.
 */
export function assertScaleRange(
  scale: (v: number) => number,
  inputs: ReadonlyArray<number>,
  range: readonly [number, number],
  tolerance = 0.001,
): void {
  const [lo, hi] = range;
  for (const v of inputs) {
    const out = scale(v);
    if (out < lo - tolerance || out > hi + tolerance) {
      throw new Error(`Scale output ${out} is outside range [${lo}, ${hi}] for input ${v}`);
    }
  }
}

/**
 * Assert that a scale is monotonically increasing over a sorted input array.
 */
export function assertMonotone(scale: (v: number) => number, inputs: ReadonlyArray<number>): void {
  for (let i = 1; i < inputs.length; i++) {
    const prev = scale(inputs[i - 1] as number);
    const curr = scale(inputs[i] as number);
    if (curr < prev - 0.001) {
      throw new Error(
        `Scale is not monotone: scale(${inputs[i - 1]}) = ${prev} > scale(${inputs[i]}) = ${curr}`,
      );
    }
  }
}

/**
 * Assert two numbers are approximately equal.
 */
export function assertApprox(a: number, b: number, tolerance = 0.001): void {
  if (Math.abs(a - b) > tolerance) {
    throw new Error(`Expected ${a} ≈ ${b} (tolerance ${tolerance})`);
  }
}
