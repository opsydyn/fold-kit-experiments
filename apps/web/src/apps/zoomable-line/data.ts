import type { Row } from '@opsydyn/foldkit-viz/plot';

/** A year of daily closing prices on weekdays from 2 January 2025, seeded so they are stable. */
function generatePrices(): ReadonlyArray<Row> {
  let s = 0xdeadbeef;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const rows: Row[] = [];
  let price = 148;
  for (let day = 0; rows.length < 253; day += 1) {
    const date = new Date(Date.UTC(2025, 0, 2 + day));
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    price = Math.max(80, price + 0.05 + (next() - 0.48) * 4.2);
    const close = Math.round(price * 100) / 100;
    const iso = date.toISOString().slice(0, 10);
    rows.push({ date: iso, close, label: `${iso}: $${close.toFixed(2)}` });
  }
  return rows;
}

export const prices: ReadonlyArray<Row> = generatePrices();

const instant = (row: Row | undefined): number => Date.parse(String(row?.date ?? ''));

/** The whole year, in epoch milliseconds: the furthest a zoom or pan may reach. */
export const fullDomain: readonly [number, number] = [instant(prices[0]), instant(prices.at(-1))];
