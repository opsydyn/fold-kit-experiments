# Service latency

A week of p95 latency per service, from `data/latency.json.ts`, which runs at build time.

```plot
{
  "width": 720,
  "height": 300,
  "data": "latency.json",
  "marks": [{ "mark": "line", "x": "time", "y": "p95", "stroke": "service" }]
}
```

How the week's hours spread, per service:

```plot
{
  "width": 720,
  "height": 260,
  "data": "latency.json",
  "marks": [{ "mark": "box", "x": "service", "y": "p95" }]
}
```
