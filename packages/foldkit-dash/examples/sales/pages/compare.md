# Compare regions

[Back to the overview](index.md)

Scotland's orders fell from 255 in the week of 8 June to 202 in the week of 3 August,
then climbed to 312 in the week of 19 October:
[Scotland and Wales](compare.md?regions=Wales&regions=Scotland&focus=Scotland) side by side.

Tick the regions to compare. Click a line (or its legend entry) to choose the region
whose revenue is shown below.

```input
{ "type": "checkboxes", "name": "regions", "label": "Regions", "options": ["South East", "London", "North West", "Wales", "Scotland"] }
```

```input
{ "type": "select", "name": "focus", "label": "Revenue for", "options": ["South East", "London", "North West", "Wales", "Scotland"] }
```

```plot
{
  "width": 720,
  "height": 300,
  "data": "weekly.csv",
  "select": "focus",
  "where": { "region": { "input": "regions" } },
  "x": { "label": "Week starting" },
  "y": { "label": "Orders" },
  "color": { "label": "Region", "domain": ["South East", "London", "North West", "Wales", "Scotland"] },
  "marks": [{ "mark": "line", "x": "week_starting", "y": "orders", "stroke": "region" }]
}
```

```plot
{
  "width": 720,
  "height": 260,
  "data": "weekly.csv",
  "where": { "region": { "input": "focus" } },
  "x": { "label": "Week starting" },
  "y": { "label": "Revenue (£)" },
  "marks": [{ "mark": "area", "x": "week_starting", "y": "revenue_gbp" }]
}
```
