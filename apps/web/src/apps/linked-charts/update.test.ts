import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Option } from 'effect';
import { describe, expect, it } from 'vitest';

import * as PlotPanel from '../../ui/plot-panel/core';
import { matchingKeys } from '../../ui/shared/inspection';
import { binHolding } from './fold';
import { Message } from './message';
import { init, Model, POINTS } from './model';
import { update } from './update';
import { view } from './view';

const LinkedFixture = Html.component({
  name: 'LinkedChartsFixture',
  props: Model,
  model: Model,
  message: Message,
}).make({
  init: ({ props }) => props,
  update: ($, message) => update($.model, message).model,
  view,
});
async function renderChart(model: typeof Model.Type): Promise<string> {
  const { html } = await Effect.runPromise(HtmlServer.renderToHtml(LinkedFixture, model));
  return html;
}

const initialModel = () => init().model;

/** A scatter target's index for a point id, since targets run in x order. */
const targetOf = (model: ReturnType<typeof initialModel>, id: string): number =>
  PlotPanel.targetsOf(model.scatter).findIndex((t) => t.key === id);

const hoverPoint = (model: ReturnType<typeof initialModel>, id: string) =>
  update(
    model,
    Message.ReceivedScatterMessage({
      message: PlotPanel.Message.HoveredTarget({ index: targetOf(model, id) }),
    }),
  ).model;

const hoverBin = (model: ReturnType<typeof initialModel>, index: number) =>
  update(
    model,
    Message.ReceivedHistogramMessage({ message: PlotPanel.Message.HoveredTarget({ index }) }),
  ).model;

const opacities = async (html: Promise<string>, selector: string) => {
  const node = document.createElement('div');
  node.innerHTML = await html;
  return [...node.querySelectorAll(selector)].map((el) => Number(el.getAttribute('opacity') ?? 1));
};

describe('linked charts update', () => {
  it('clears a linked inspection after filtering and recovers from an empty chart', () => {
    const selected = hoverPoint(initialModel(), 'salary-1');
    const filtered = update(selected, Message.ChangedMinimumExperience({ years: 10 })).model;
    expect(filtered.inspection).toEqual(Option.none());
    expect(PlotPanel.targetsOf(filtered.scatter).some((target) => target.key === 'salary-1')).toBe(
      false,
    );
    const empty = update(filtered, Message.ChangedMinimumExperience({ years: 25 })).model;
    expect(PlotPanel.targetsOf(empty.scatter)).toEqual([]);
    expect(PlotPanel.targetsOf(empty.histogram)).toEqual([]);
    const reset = update(empty, Message.ChangedMinimumExperience({ years: 0 })).model;
    expect(PlotPanel.targetsOf(reset.scatter).map((target) => target.key)).toContain('salary-1');
  });

  it('activates the histogram bin holding a hovered point', () => {
    const model = initialModel();
    const point = POINTS[0];
    const next = hoverPoint(model, point?.id ?? '');
    expect(next.scatter.active).toEqual(Option.some(targetOf(model, point?.id ?? '')));
    expect(next.histogram.active).toEqual(binHolding(model.histogram, point?.y ?? 0));
    expect(next.inspection).toEqual(Option.some({ _tag: 'Point', key: point?.id }));
  });

  it('clears both active targets when the scatter point is blurred', () => {
    const hovered = hoverPoint(initialModel(), 'salary-1');
    const next = update(
      hovered,
      Message.ReceivedScatterMessage({ message: PlotPanel.Message.BlurredTarget() }),
    ).model;
    expect(next.scatter.active).toEqual(Option.none());
    expect(next.histogram.active).toEqual(Option.none());
    expect(next.inspection).toEqual(Option.none());
  });

  it('highlights every point in a hovered bin, leaving the scatter model alone', async () => {
    const model = initialModel();
    const next = hoverBin(model, 1);
    expect(next.scatter).toBe(model.scatter);
    const [, bin] = PlotPanel.targetsOf(model.histogram);
    expect(next.inspection).toEqual(
      Option.some({
        _tag: 'Range',
        lower: bin?.domain[0],
        upper: bin?.domain[1],
        includeEnd: false,
      }),
    );
    const keys = matchingKeys(POINTS, Option.getOrThrow(next.inspection));
    expect(keys.length).toBeGreaterThan(0);
    const html = renderChart(next);
    const dots = await opacities(html, '.plot-mark.plot-dot circle');
    expect(dots.filter((o) => o === 1)).toHaveLength(keys.length);
    const node = document.createElement('div');
    node.innerHTML = await html;
    expect(node.textContent).toContain(`${keys.length} matching points`);
  });

  it('emphasises the bin holding a hovered point', async () => {
    const next = hoverPoint(initialModel(), 'salary-30');
    const bars = await opacities(renderChart(next), '.plot-mark.plot-rect rect');
    expect(bars.at(-1)).toBe(1);
    expect(bars.slice(0, -1).every((o) => o < 1)).toBe(true);
  });

  it('clears the range overlay without touching the scatter', () => {
    const model = initialModel();
    const hovered = hoverBin(model, 1);
    const next = update(
      hovered,
      Message.ReceivedHistogramMessage({ message: PlotPanel.Message.BlurredTarget() }),
    ).model;
    expect(next.histogram.active).toEqual(Option.none());
    expect(next.scatter).toBe(model.scatter);
    expect(next.inspection).toEqual(Option.none());
  });
});

it('links keyboard inspection through semantic point events', () => {
  const model = initialModel();
  const result = update(
    model,
    Message.ReceivedScatterMessage({
      message: PlotPanel.Message.PressedKeyNav({ command: { _tag: 'Step', by: 1 } }),
    }),
  );
  expect(result.model.scatter.active).toEqual(Option.some(0));
  expect(result.model.histogram.active).toEqual(Option.some(0));
});

it('includes the final salary endpoint when linking a scatter inspection', () => {
  const model = initialModel();
  const next = hoverPoint(model, 'salary-30');
  expect(next.histogram.active).toEqual(
    Option.some(PlotPanel.targetsOf(model.histogram).length - 1),
  );
});

it('emits data-domain inspection facts from the chart panels', () => {
  const model = initialModel();
  expect(
    PlotPanel.update(model.scatter, PlotPanel.Message.HoveredTarget({ index: 0 })).outMessage,
  ).toEqual({ _tag: 'InspectedPoint', key: 'salary-1', x: 1, y: 55000 });
  const [bin] = PlotPanel.targetsOf(model.histogram);
  expect(
    PlotPanel.update(model.histogram, PlotPanel.Message.HoveredTarget({ index: 0 })).outMessage,
  ).toEqual({ _tag: 'InspectedRange', domain: bin?.domain, includeEnd: false });
});

describe('linked updates under any input sequence', () => {
  // Seeded, so a failure replays: 200 sequences of 25 scatter and histogram inputs.
  const random = (seed: number) => () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  it('keeps the histogram on the bin holding the inspected point, or on none', () => {
    const commands = [
      { _tag: 'Step', by: 1 },
      { _tag: 'Step', by: -1 },
      { _tag: 'Jump', to: 'first' },
      { _tag: 'Jump', to: 'last' },
      { _tag: 'Clear' },
    ] as const;
    for (let run = 0; run < 200; run += 1) {
      const next = random(run + 1);
      let model = initialModel();
      const points = PlotPanel.targetsOf(model.scatter).length;
      for (let step = 0; step < 25; step += 1) {
        const pick = next();
        const message =
          pick < 0.4
            ? PlotPanel.Message.HoveredTarget({ index: Math.floor(next() * points) })
            : pick < 0.55
              ? PlotPanel.Message.BlurredTarget()
              : PlotPanel.Message.PressedKeyNav({
                  command: commands[Math.floor(next() * commands.length)] ?? commands[0],
                });
        model = update(model, Message.ReceivedScatterMessage({ message })).model;
        const inspection = Option.getOrUndefined(model.inspection);
        if (inspection?._tag === 'Point') {
          const point = POINTS.find((p) => p.id === inspection.key);
          expect(model.histogram.active).toEqual(binHolding(model.histogram, point?.y ?? NaN));
        } else expect(model.histogram.active).toEqual(Option.none());
      }
    }
  });
});
