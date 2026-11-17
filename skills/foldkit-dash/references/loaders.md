# Loader recipes

A loader is any program that prints rows: JSON (`name.json.<ext>`) or CSV/TSV
(`name.csv.<ext>`, `name.tsv.<ext>`). It runs from the project folder, so a file beside
the project is `../file`. Summarise there, so the page carries totals, not raw rows.

Each recipe says whether it was run while writing it (with foldkit-dash 0.1.0, Bun
1.4.2, `@duckdb/node-api` 2.0.0-r.1, `nodejs-polars` 0.26.1). The ones not run are the
same queries in other languages: check them with `foldkit-dash check` before relying on
them.

## Parquet with DuckDB, in Bun (run)

`data/totals.json.ts`, with `@duckdb/node-api` installed in the project:

```ts
import { DuckDBInstance } from '@duckdb/node-api';

const db = await (await DuckDBInstance.create()).connect();
const result = await db.runAndReadAll(`
  SELECT region, round(sum(revenue_gbp), 2) AS revenue
  FROM '../sales.parquet'
  GROUP BY region
  ORDER BY revenue DESC
`);
console.log(JSON.stringify(result.getRowObjectsJson()));
```

`getRowObjectsJson` gives JSON-safe values (big integers and decimals as numbers or
strings, dates as ISO strings).

## Parquet with Polars, in Bun, as CSV (run)

`data/weekly.csv.ts`, with `nodejs-polars` installed:

```ts
import pl from 'nodejs-polars';

const weekly = pl
  .readParquet('../sales.parquet')
  .groupBy('week_starting')
  .agg(pl.col('orders').sum().alias('orders'))
  .sort('week_starting');
console.log(weekly.writeCSV().toString());
```

## Parquet with DuckDB, in Python (not run)

`data/totals.json.py`, with the `duckdb` package installed:

```py
import duckdb, json

rows = duckdb.sql("""
  SELECT region, round(sum(revenue_gbp), 2) AS revenue
  FROM '../sales.parquet' GROUP BY region ORDER BY revenue DESC
""").fetchall()
print(json.dumps([{"region": region, "revenue": float(revenue)} for region, revenue in rows]))
```

## Parquet with Polars, in Python (not run)

`data/weekly.csv.py`, with `polars` installed:

```py
import polars as pl, sys

(pl.read_parquet("../sales.parquet")
   .group_by("week_starting").agg(pl.col("orders").sum())
   .sort("week_starting")
   .write_csv(sys.stdout))
```

## A query with the DuckDB command line (not run)

`data/totals.csv.sh`, with `duckdb` on the PATH:

```sh
duckdb -csv -c "SELECT region, sum(revenue_gbp) AS revenue FROM '../sales.parquet' GROUP BY region"
```

## From a CSV file, with no loader

A `data/sales.csv` file is read as it is: a header row, then one row per record, each
value a number, `true`/`false`, `null` (when empty) or a string. A column of codes such
as `007` reads as the number 7: when that matters, write JSON from a loader instead.
