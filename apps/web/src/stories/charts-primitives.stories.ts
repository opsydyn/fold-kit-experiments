import type { Meta, StoryObj } from '@storybook/html';
import { Schema } from 'effect';
import type { Html } from 'foldkit/html';
import { makeElement } from 'foldkit/runtime';
import * as AreaChart from '../ui/area-chart';
import * as BarChart from '../ui/bar-chart';
import * as LineChart from '../ui/line-chart';
import * as ScatterChart from '../ui/scatter-chart';
import { mountFoldkitProgram } from './mount';

export default {
  title: 'Charts/Primitives',
  parameters: {
    docs: {
      description: {
        component:
          'Live controls for foldkit-viz chart primitives — tweak colors, spacing, and curves directly in the Storybook Controls panel.',
      },
    },
  },
} satisfies Meta;

// ── Sample datasets ────────────────────────────────────────────────────────────

const SAMPLE_BARS: ReadonlyArray<BarChart.Bar> = [
  { label: 'Jan', value: 4200 },
  { label: 'Feb', value: 3800 },
  { label: 'Mar', value: 5100 },
  { label: 'Apr', value: 4700 },
  { label: 'May', value: 6300 },
  { label: 'Jun', value: 5800 },
  { label: 'Jul', value: 6900 },
  { label: 'Aug', value: 7200 },
];

const SAMPLE_LINE: ReadonlyArray<LineChart.Point> = [
  { label: 'W1', value: 1200 },
  { label: 'W2', value: 1450 },
  { label: 'W3', value: 1380 },
  { label: 'W4', value: 1620 },
  { label: 'W5', value: 1750 },
  { label: 'W6', value: 1690 },
  { label: 'W7', value: 1900 },
  { label: 'W8', value: 2100 },
];

const SAMPLE_AREA: ReadonlyArray<AreaChart.Point> = [
  { label: 'Jan', value: 3200 },
  { label: 'Feb', value: 3800 },
  { label: 'Mar', value: 4500 },
  { label: 'Apr', value: 4200 },
  { label: 'May', value: 5100 },
  { label: 'Jun', value: 5600 },
  { label: 'Jul', value: 6200 },
  { label: 'Aug', value: 5900 },
];

const SAMPLE_SCATTER: ReadonlyArray<ScatterChart.Point> = [
  { label: 'Alice', x: 2, y: 52 },
  { label: 'Bob', x: 5, y: 68 },
  { label: 'Carol', x: 8, y: 85 },
  { label: 'Dave', x: 1, y: 46 },
  { label: 'Eve', x: 12, y: 105 },
  { label: 'Frank', x: 4, y: 62 },
  { label: 'Grace', x: 7, y: 80 },
  { label: 'Hank', x: 3, y: 57 },
  { label: 'Iris', x: 10, y: 96 },
  { label: 'Jack', x: 6, y: 74 },
  { label: 'Kim', x: 15, y: 122 },
  { label: 'Leo', x: 9, y: 90 },
  { label: 'Mia', x: 11, y: 99 },
  { label: 'Nick', x: 14, y: 116 },
  { label: 'Olivia', x: 13, y: 110 },
];

// ── Mount helper ───────────────────────────────────────────────────────────────

// Generate unique DOM IDs. Each call produces a short collision-resistant id.
const nextId = () => `fk-story-${Math.random().toString(36).slice(2, 9)}`;

// Schema.Any is a no-op codec: chart models don't round-trip through JSON in
// Storybook (no HMR model preservation), so encoding is never invoked.
const STORY_MODEL_SCHEMA = Schema.Any as Schema.Codec<never, never, never, never>;

function mountChart<Mod, Msg extends { _tag: string }>(
  init: () => readonly [Mod, readonly []],
  update: (model: Mod, msg: Msg) => readonly [Mod, readonly []],
  view: (model: Mod) => Html,
): HTMLElement {
  return mountFoldkitProgram(
    (container) =>
      makeElement<Mod, Msg>({
        Model: STORY_MODEL_SCHEMA as Schema.Codec<Mod, any, unknown, unknown>,
        init,
        update,
        view,
        container: Object.assign(container, { id: nextId() }),
        devTools: false,
      }),
    'display:inline-block;',
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────────

type BarArgs = {
  color: string;
  activeColor: string;
  paddingInner: number;
  paddingOuter: number;
  tickCount: number;
};

export const Bar: StoryObj<BarArgs> = {
  name: 'Bar chart',
  args: {
    color: '#6366f1',
    activeColor: '#4338ca',
    paddingInner: 0.25,
    paddingOuter: 0.15,
    tickCount: 5,
  },
  argTypes: {
    color: { control: 'color', description: 'Default bar fill' },
    activeColor: { control: 'color', description: 'Hovered / active bar fill' },
    paddingInner: {
      control: { type: 'range', min: 0, max: 0.7, step: 0.05 },
      description: 'Gap between bars (0 = no gap, 0.7 = mostly gap)',
    },
    paddingOuter: {
      control: { type: 'range', min: 0, max: 0.4, step: 0.05 },
      description: 'Padding at chart edges',
    },
    tickCount: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Y-axis tick count (approximate)',
    },
  },
  render: (args) => {
    const [model0, cmds0] = BarChart.init({
      bars: SAMPLE_BARS,
      config: {
        color: args.color,
        activeColor: args.activeColor,
        paddingInner: args.paddingInner,
        paddingOuter: args.paddingOuter,
        tickCount: args.tickCount,
      },
    });
    return mountChart<BarChart.Model, BarChart.Message>(
      () => [model0, cmds0],
      BarChart.update,
      (model) => BarChart.view({ model, toParentMessage: (m) => m }),
    );
  },
  parameters: {
    docs: {
      description: { story: 'Vertical bar chart — adjust fill colors and bar spacing.' },
    },
  },
};

// ── Line chart ─────────────────────────────────────────────────────────────────

type LineArgs = {
  color: string;
  activeColor: string;
  curve: 'linear' | 'catmullRom' | 'monotoneX';
  tickCount: number;
};

export const Line: StoryObj<LineArgs> = {
  name: 'Line chart',
  args: {
    color: '#6366f1',
    activeColor: '#4338ca',
    curve: 'catmullRom',
    tickCount: 5,
  },
  argTypes: {
    color: { control: 'color', description: 'Line and dot color' },
    activeColor: { control: 'color', description: 'Active dot color' },
    curve: {
      control: 'select',
      options: ['linear', 'catmullRom', 'monotoneX'],
      description: 'Interpolation curve',
    },
    tickCount: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Y-axis tick count',
    },
  },
  render: (args) => {
    const [model0, cmds0] = LineChart.init({
      points: SAMPLE_LINE,
      config: {
        color: args.color,
        activeColor: args.activeColor,
        curve: args.curve,
        tickCount: args.tickCount,
      },
    });
    return mountChart<LineChart.Model, LineChart.Message>(
      () => [model0, cmds0],
      LineChart.update,
      (model) => LineChart.view({ model, toParentMessage: (m) => m }),
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Line chart — switch between linear, CatmullRom and monotone-X curves.',
      },
    },
  },
};

// ── Area chart ─────────────────────────────────────────────────────────────────

type AreaArgs = {
  color: string;
  activeColor: string;
  curve: 'linear' | 'catmullRom' | 'monotoneX';
  tickCount: number;
};

export const Area: StoryObj<AreaArgs> = {
  name: 'Area chart',
  args: {
    color: '#10b981',
    activeColor: '#059669',
    curve: 'catmullRom',
    tickCount: 5,
  },
  argTypes: {
    color: { control: 'color', description: 'Line and area fill color' },
    activeColor: { control: 'color', description: 'Active crosshair / dot color' },
    curve: {
      control: 'select',
      options: ['linear', 'catmullRom', 'monotoneX'],
      description: 'Interpolation curve',
    },
    tickCount: {
      control: { type: 'number', min: 1, max: 10 },
      description: 'Y-axis tick count',
    },
  },
  render: (args) => {
    const [model0, cmds0] = AreaChart.init({
      points: SAMPLE_AREA,
      config: {
        color: args.color,
        activeColor: args.activeColor,
        curve: args.curve,
        tickCount: args.tickCount,
      },
    });
    return mountChart<AreaChart.Model, AreaChart.Message>(
      () => [model0, cmds0],
      AreaChart.update,
      (model) => AreaChart.view({ model, toParentMessage: (m) => m }),
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Area chart — hover shows crosshair + value; try different curve types.',
      },
    },
  },
};

// ── Scatter chart ──────────────────────────────────────────────────────────────

type ScatterArgs = {
  color: string;
  activeColor: string;
  radius: number;
  xLabel: string;
  yLabel: string;
};

export const Scatter: StoryObj<ScatterArgs> = {
  name: 'Scatter chart',
  args: {
    color: '#f97316',
    activeColor: '#ea580c',
    radius: 5,
    xLabel: 'Experience (yrs)',
    yLabel: 'Salary ($k)',
  },
  argTypes: {
    color: { control: 'color', description: 'Default point stroke' },
    activeColor: { control: 'color', description: 'Active point fill and stroke' },
    radius: {
      control: { type: 'range', min: 2, max: 14, step: 1 },
      description: 'Point radius (px)',
    },
    xLabel: { control: 'text', description: 'X-axis label' },
    yLabel: { control: 'text', description: 'Y-axis label' },
  },
  render: (args) => {
    const [model0, cmds0] = ScatterChart.init({
      points: SAMPLE_SCATTER,
      config: {
        color: args.color,
        activeColor: args.activeColor,
        radius: args.radius,
        xLabel: args.xLabel,
        yLabel: args.yLabel,
      },
    });
    return mountChart<ScatterChart.Model, ScatterChart.Message>(
      () => [model0, cmds0],
      ScatterChart.update,
      (model) => ScatterChart.view({ model, toParentMessage: (m) => m }),
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Scatter chart — nearest-point cursor tracking; adjust dot size and axis labels.',
      },
    },
  },
};
