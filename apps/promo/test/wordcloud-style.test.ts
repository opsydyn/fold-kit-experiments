import { afterAll, expect, test } from 'bun:test';

import { Window } from 'happy-dom';

const window = new Window();
afterAll(() => window.happyDOM.close());

test('shared axis styling does not override measured word sizes or caller paints', async () => {
  const stylesheet = window.document.createElement('style');
  stylesheet.textContent = await Bun.file(
    new URL('../src/styles/site.css', import.meta.url),
  ).text();
  window.document.head.append(stylesheet);
  window.document.body.innerHTML = `
      <div class="primitive-plot"><svg>
        <text class="cloud-word" font-size="54" fill="var(--word-blue)">Geometry</text>
        <text class="axis-label">Time</text>
      </svg></div>
      <svg><text class="cloud-word" font-size="54" fill="var(--word-blue)">Reference</text></svg>`;
  const [word, reference] = window.document.querySelectorAll('.cloud-word');
  const axis = window.document.querySelector('.axis-label');
  if (!word || !reference || !axis) throw new Error('Missing chart style fixture');
  const actual = window.getComputedStyle(word);
  const unoverridden = window.getComputedStyle(reference);
  expect(actual.fontSize).toBe(unoverridden.fontSize);
  expect(actual.fill).toBe(unoverridden.fill);
  expect(window.getComputedStyle(axis).fontSize).toBe('11px');
});
