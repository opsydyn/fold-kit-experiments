# Choose a period

[Back to the overview](index.md)

In [July and August](period.md?weeks=2026-07-01..2026-08-31) South East took 4,172
orders and Scotland 1,928; in [September and October](period.md?weeks=2026-09-01..2026-10-31)
South East took 4,223 and Scotland 2,297. The order of the regions is the same in both.

Drag across the chart to choose a period of weeks, or type the dates. A click on the
chart chooses the whole season again.

```input
{ "type": "between", "name": "weeks", "label": "Weeks", "options": { "data": "weekly.csv", "field": "week_starting" } }
```

```plot
{
  "width": 720,
  "height": 300,
  "data": "weekly.csv",
  "brush": "weeks",
  "x": { "label": "Week starting" },
  "y": { "label": "Orders" },
  "color": { "label": "Region", "domain": ["South East", "London", "North West", "Wales", "Scotland"] },
  "marks": [{ "mark": "line", "x": "week_starting", "y": "orders", "stroke": "region" }]
}
```

```plot
{
  "width": 720,
  "height": 300,
  "data": "weekly.csv",
  "where": { "week_starting": { "input": "weeks" } },
  "x": { "label": "Region", "domain": ["South East", "London", "North West", "Wales", "Scotland"] },
  "y": { "label": "Orders in the period" },
  "marks": [{ "mark": "bar", "x": "region", "y": "orders", "z": "week_starting", "stack": "zero" }]
}
```
