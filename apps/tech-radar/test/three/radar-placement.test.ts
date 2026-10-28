import { describe, expect, test } from 'bun:test';

import type { Vec3 } from '@opsydyn/effect-three';

import {
  type Candidate,
  frameOf,
  labelBudget,
  type Obstacle,
  place,
  textSize,
  viewOf,
} from '../../src/radar/three/placement';

const view = viewOf([0, 0, 10], [0, 0, 0]);
const name = (key: string, centre: Vec3, width = 1, height = 0.2): Candidate => ({
  key,
  kind: 'name',
  centres: [centre],
  width,
  height,
});

describe('label placement', () => {
  test('an overlapping label gives way to the one placed before it', () => {
    const kept = place(view, [name('near', [0, 0, 0]), name('clash', [0.3, 0.05, 0])]);
    expect([...kept.keys()]).toEqual(['near']);
  });

  test('labels apart on screen both show, even when one is far behind the other', () => {
    const kept = place(view, [name('left', [-2, 0, 0]), name('right', [2, 0, 0])]);
    expect([...kept.keys()]).toEqual(['left', 'right']);
    // Far behind but on the same line of sight: it still overlaps on screen.
    expect([
      ...place(view, [name('front', [0, 0, 5]), name('behind', [0, 0, -20])]).keys(),
    ]).toEqual(['front']);
  });

  test('each kind stops at its budget', () => {
    const row = Array.from({ length: 12 }, (_, i) => name(`n${i}`, [-11 + i * 2, 0, 0], 0.5));
    expect(place(view, row).size).toBe(labelBudget.name);
  });

  test('a label that clashes where it prefers takes its next position', () => {
    const second: Candidate = {
      ...name('moves', [0.3, 0, 0]),
      centres: [
        [0.3, 0, 0],
        [0, -2, 0],
      ],
    };
    expect([...place(view, [name('first', [0, 0, 0]), second])]).toEqual([
      ['first', 0],
      ['moves', 1],
    ]);
  });

  test('a blip in front of a label blocks it; one behind it does not', () => {
    const blip = (z: number): Obstacle => ({ centre: [0, 0, z], width: 0.3, height: 0.3 });
    expect(place(view, [name('label', [0, 0, 0])], [blip(2)]).size).toBe(0);
    expect(place(view, [name('label', [0, 0, 0])], [blip(-2)]).size).toBe(1);
    expect(place(view, [{ ...name('focus', [0, 0, 0]), kind: 'focus' }], [blip(2)]).size).toBe(1);
  });

  test('a label that would leave the frame is cut, not drawn half off the stage', () => {
    const frame = frameOf(40, 1);
    expect(frame.y).toBeCloseTo(Math.tan((20 * Math.PI) / 180), 12);
    expect(place(view, [name('inside', [0, 0, 0])], [], frame).size).toBe(1);
    // Ten units away, a label 1 unit wide centred 3.5 across runs past the 0.36 edge.
    expect(place(view, [name('edge', [3.5, 0, 0])], [], frame).size).toBe(0);
    // On a wider stage the same label fits.
    expect(place(view, [name('edge', [3.5, 0, 0])], [], frameOf(40, 1.6)).size).toBe(1);
  });

  test('a label exempt from one obstacle is still blocked by another that grants none', () => {
    const label = name('own', [0, 0, 0]);
    const zone = (exempt: ReadonlyArray<string>): Obstacle => ({
      centre: [0, 0, 1],
      width: 0.4,
      height: 0.4,
      solid: true,
      exempt,
    });
    expect(place(view, [label], [zone(['own'])]).size).toBe(1);
    expect(place(view, [label], [zone([]), zone(['own'])]).size).toBe(0);
  });

  test('a label behind the camera is never placed', () => {
    expect(place(view, [name('behind', [0, 0, 12])]).size).toBe(0);
  });

  test('wrapped text grows taller rather than wider', () => {
    const line = textSize('x'.repeat(10), 0.1);
    const wrapped = textSize('x'.repeat(100), 0.1, 1.4);
    expect(wrapped.width).toBe(1.4);
    expect(wrapped.height).toBeGreaterThan(line.height * 3);
  });
});
