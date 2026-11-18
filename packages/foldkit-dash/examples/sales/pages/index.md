# Weekly sales

A season of weekly orders and revenue for five regions, built by
[foldkit-dash](https://github.com/opsydyn/fold-kit-experiments/tree/main/packages/foldkit-dash)
from one CSV file. Also: [compare regions](compare.md) and [choose a period](period.md).

Over the season, the 26 weeks starting 4 May to 26 October 2026, South East took the most
orders (12,573), then London (11,057), North West (9,518), Wales (7,955) and Scotland
(6,367). Every region's orders fell into July or August and peaked between 21 September
and 19 October.

```input
{ "type": "select", "name": "region", "label": "Region", "options": ["South East", "London", "North West", "Wales", "Scotland"], "all": "All regions" }
```

Click a region's bar (or press Tab to reach the chart, the arrow keys to read it and
Enter to choose) to see its weeks below.

```plot
{
  "width": 720,
  "height": 300,
  "data": "weekly.csv",
  "select": "region",
  "x": { "label": "Region", "domain": ["South East", "London", "North West", "Wales", "Scotland"] },
  "y": { "label": "Orders over the season" },
  "marks": [{ "mark": "bar", "x": "region", "y": "orders", "z": "week_starting", "stack": "zero" }]
}
```

```plot
{
  "width": 720,
  "height": 300,
  "data": "weekly.csv",
  "where": { "region": { "input": "region" } },
  "x": { "label": "Week starting" },
  "y": { "label": "Orders" },
  "color": { "label": "Region", "domain": ["South East", "London", "North West", "Wales", "Scotland"] },
  "marks": [{ "mark": "line", "x": "week_starting", "y": "orders", "stroke": "region" }]
}
```
