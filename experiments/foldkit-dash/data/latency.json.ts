// A data loader: anything that prints JSON. Here, a seeded week of request latencies.
const services = ['api', 'auth', 'search'];
const hours = 7 * 24;

/** The Park–Miller generator's `count`th number after `seed`, in [0, 1). */
const noise = (count: number): number =>
  Array.from({ length: count }).reduce<number>((seed) => (seed * 16807) % 2147483647, 7) /
  2147483647;

const rows = Array.from({ length: hours }, (_, hour) =>
  services.map((service, i) => ({
    time: new Date(Date.UTC(2026, 10, 9) + hour * 3600_000).toISOString(),
    service,
    p95: Math.round(80 + i * 40 + 30 * Math.sin(hour / 4) + noise(hour * 3 + i + 1) * 25),
  })),
).flat();

console.log(JSON.stringify(rows));
