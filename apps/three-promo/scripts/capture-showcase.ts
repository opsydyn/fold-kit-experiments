/**
 * Captures the landing-page and examples-page showcase images from the running dev server.
 *
 *   bun run dev            # in another terminal (port 4323)
 *   bun scripts/capture-showcase.ts [base-url]
 *   ONLY=marbles,room bun scripts/capture-showcase.ts   # just these examples
 */
import { chromium, type Page } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4323';
const outDir = new URL('../public/images/showcase/', import.meta.url).pathname;

type Shot = { readonly id: string; readonly prepare: (page: Page) => Promise<void> };

async function clickButton(page: Page, name: string, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await page.getByRole('button', { name }).click();
}

async function placeBlocks(page: Page): Promise<void> {
  const stage = page.locator('.e3-stage');
  const box = await stage.boundingBox();
  if (box === null) throw new Error('stage not visible');
  const at = (x: number, y: number) => ({ position: { x: box.width * x, y: box.height * y } });
  const paints = ['lavender', 'mint', 'gold', 'coral', 'periwinkle'];
  const pieces = ['block', 'drum', 'block', 'block', 'ball', 'drum', 'ball'];
  const spots: ReadonlyArray<readonly [number, number]> = [
    [0.38, 0.62],
    [0.38, 0.62],
    [0.6, 0.66],
    [0.6, 0.66],
    [0.6, 0.66],
    [0.47, 0.75],
    [0.3, 0.5],
  ];
  for (const [i, [x, y]] of spots.entries()) {
    await page.getByRole('button', { name: paints[i % paints.length] ?? 'blue' }).click();
    await page.getByRole('button', { name: pieces[i] ?? 'block', exact: true }).click();
    await stage.click(at(x, y));
  }
}

const shots: ReadonlyArray<Shot> = [
  { id: 'playground', prepare: (page) => clickButton(page, 'Add cube', 2) },
  { id: 'sculpture', prepare: placeBlocks },
  { id: 'bars', prepare: async () => undefined },
  { id: 'arrange', prepare: async () => undefined },
  // The comet a third of the way round, its trail behind it.
  { id: 'curves', prepare: (page) => page.waitForTimeout(3000) },
  { id: 'studio', prepare: async () => undefined },
  { id: 'city', prepare: async () => undefined },
  { id: 'workshop', prepare: async () => undefined },
  // Rapier loads, then the toys fall and settle.
  { id: 'toybox', prepare: (page) => page.waitForTimeout(5000) },
  { id: 'shared', prepare: async () => undefined },
  // Rapier loads, then the first pour runs through the machine into the bins.
  { id: 'marbles', prepare: (page) => page.waitForTimeout(9000) },
  // The fonts load and every plaque's panel is sized from its measured layout.
  { id: 'gallery', prepare: (page) => page.waitForTimeout(3000) },
  // A roll, caught as the ball reaches the pins.
  {
    id: 'bowling',
    prepare: async (page) => {
      await page.waitForTimeout(2500);
      await clickButton(page, 'Roll');
      await page.waitForTimeout(450);
    },
  },
  { id: 'room', prepare: (page) => page.waitForTimeout(1500) },
];

const only = process.env.ONLY?.split(',');
const chosen = only === undefined ? shots : shots.filter((shot) => only.includes(shot.id));

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
for (const theme of ['light', 'dark'] as const) {
  const context = await browser.newContext({
    viewport: { width: 960, height: 900 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript((value) => localStorage.setItem('effect-three-theme', value), theme);
  for (const shot of chosen) {
    const page = await context.newPage();
    await page.goto(`${base}/examples/${shot.id}/`);
    await page.locator('.e3-stage canvas').waitFor();
    await page.waitForTimeout(800);
    await shot.prepare(page);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1200);
    await page.locator('.e3-stage').screenshot({ path: `${outDir}${shot.id}-${theme}.png` });
    await page.close();
  }
  await context.close();
}
await browser.close();
console.log('captured', chosen.length * 2, 'images into', outDir);
