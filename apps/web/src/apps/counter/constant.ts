import { Hue, Milliseconds, Pixels, PixelsPerSec } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const SPAWN_X = Pixels(CANVAS_WIDTH / 2);
export const SPAWN_Y = Pixels(CANVAS_HEIGHT * 0.55);

export const MS_PER_SECOND = 1000;
export const TWO_PI = Math.PI * 2;
export const DELTA_SECONDS_CAP = 0.05;

export const BURST_COUNT = 10;
export const TRAIL_LENGTH = 24;

export const SPEED_MIN = PixelsPerSec(80);
export const SPEED_MAX = PixelsPerSec(220);
export const LIFESPAN_MIN_MS = Milliseconds(600);
export const LIFESPAN_MAX_MS = Milliseconds(1400);
export const SPREAD = Math.PI / 3;
export const HUE_JITTER = 20;
export const GRAVITY = 120;

export const INCREMENT_HUE = Hue(210);
export const DECREMENT_HUE = Hue(20);
export const RESET_HUE = Hue(280);
export const UP_ANGLE = -Math.PI / 2;
export const DOWN_ANGLE = Math.PI / 2;

export const SATURATION = 80;
export const GLOW_LIGHTNESS = 60;
export const CORE_LIGHTNESS = 78;
export const HEAD_LIGHTNESS = 90;
export const GLOW_ALPHA = 0.2;
export const CORE_ALPHA = 0.85;
export const HEAD_ALPHA = 0.9;
export const GLOW_WIDTH = 8;
export const CORE_WIDTH = 3;
export const HEAD_RADIUS = 3;
export const FADE_IN_MS = Milliseconds(100);
export const FADE_OUT_MS = Milliseconds(300);
export const ALPHA_EPSILON = 0.01;
