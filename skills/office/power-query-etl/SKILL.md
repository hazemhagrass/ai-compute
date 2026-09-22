---
name: power-query-etl
description: Use when a Power Query refresh is slow or breaks. Folding, staging, error rows, parameters that survive renames.
---

Build a Power Query pipeline that still works next month, on someone else's machine, against a file whose columns moved. Power Query fails in three ways that no error message announces: it stops folding and pulls a whole table over the wire, it hardcodes a column name into a step that then breaks on rename, and it converts types under the author's locale so the same query yields different dates elsewhere. Every rule below prevents one of those.

## The pipeline shape

Three layers, three separate queries, in this order:

1. **Staging** (`stg_*`): connect and nothing else. Connection Only, no load.
2. **Transform** (`t_*`): all reshaping, typing, joins. Connection Only unless it is the output.
3. **Load** (`fact_*`, `dim_*`): the query that lands on a sheet or in the model.

Set the layer in `Home > Close & Load To > Only Create Connection` for every query that is not an output. A staging query loaded to a sheet doubles refresh time and creates a second copy of the data nobody reads.

**Rule:** one source per staging query. A staging query that merges two sources cannot be reused or reasoned about when one source changes.

## 1. Query folding is the whole performance story

Against a database, OData, or a folder of files, Power Query tries to translate your steps into a single native query the source runs. Folding is the difference between a refresh that pushes `WHERE order_date >= '2026-01-01'` to SQL Server and one that downloads 40 million rows and filters them in memory on your laptop.

Check it, do not assume it:

```
Right-click the last step in Applied Steps > View Native Query
```

Greyed out means folding already broke at or before that step. Walk back up the step list until the option lights up again: the first step where it is greyed out is your culprit.

Steps that fold: `Table.SelectRows` (filter), `Table.SelectColumns` (remove columns), `Table.RenameColumns`, `Table.Group`, `Table.Sort`, `Table.NestedJoin` against the same source, `Table.Distinct`, most `Table.TransformColumnTypes`.

Steps that break folding permanently:

- `Table.Buffer` and `List.Buffer`, by definition, because buffering materializes the table in memory.
- `Table.AddIndexColumn`.
- Any custom M function invoked per row.
- `Table.AddColumn` with a native-untranslatable expression (most `Text.*` combinations, `try ... otherwise`).
- Merging two queries from different sources.
- Anything after `Table.FromRecords`, `Excel.CurrentWorkbook`, or a hand-typed table.

**Rule:** put every folding step before the first non-folding step. Reordering `Table.SelectRows` above an added custom column is not a style preference; it decides whether the filter runs on the server or on your machine.

**Rule:** filter rows and remove columns as the first two transform steps, always, because they shrink every later step's input and both fold.

**Rule:** never use `Table.Buffer` against a foldable source to "speed things up". It does the opposite: it forces a full download.

`Table.Buffer` is correct in exactly one case: a non-foldable source (a workbook table, a CSV) that a later step scans repeatedly, such as a lookup inside `Table.AddColumn`.

When the UI cannot generate a folding query, hand it one. A native query passed as the first step folds everything the source can do, and later M steps fold on top of it only if the connector supports it:

```m
Source = Sql.Database("srv", "sales", [Query = "select order_id, order_date, amount from orders where order_date >= '2026-01-01'"])
```

Connectors differ: SQL Server, Oracle, PostgreSQL, Synapse, and OData fold well; Excel, CSV, JSON, XML, SharePoint files, and `Excel.CurrentWorkbook` never fold, because there is no engine on the other side to push work to. Against a non-folding source, the only optimizations left are reading less data and doing fewer passes.

## 2. The auto-generated "Changed Type" step is a time bomb

The UI appends `Table.TransformColumnTypes` with every column name hardcoded after almost every action. Two failures follow: a renamed source column throws `Expression.Error: The column 'X' of the table wasn't found`, and a new source column arrives untyped and silently becomes `any`.

```
Bad:  #"Changed Type" = Table.TransformColumnTypes(Source, {{"Amount", type number}, ... 40 more ...})
Good: one explicit typing step at the END of the query, listing only the columns you depend on
```

Delete the auto-typing steps that the UI inserted mid-query and keep one at the end. Typing early forces conversions the later steps throw away.

To survive both renames and new columns, select columns explicitly and tolerate absence:

```m
Kept = Table.SelectColumns(Source, {"order_id", "order_date", "amount"}, MissingField.UseNull)
```

`MissingField.UseNull` turns a hard failure into a null column you can detect and report. `MissingField.Ignore` drops it silently, which is worse than failing.

**Rule:** never let the UI's `Changed Type` steps accumulate. Consolidate to one typing step and read it before every release.

**Rule:** type every column you use. An `any` column compares and joins unpredictably and produces no error when it does.

## 3. Locale belongs in the query, not on the machine

`Table.TransformColumnTypes` takes a third argument, the culture. Without it, the conversion uses the workbook's locale, so the same query yields March on one machine and April on another, with no warning either time.

```m
Bad:  Table.TransformColumnTypes(Src, {{"order_date", type date}})
Good: Table.TransformColumnTypes(Src, {{"order_date", type date}}, "en-GB")
```

The UI writes this for you under `Transform > Data Type > Using Locale`. Use it for every date, datetime, and decimal column that arrives as text, because decimal separators are locale-dependent too: `1.234` is one thousand two hundred thirty-four in `de-DE`.

**Rule:** pin the culture on every text-to-date and text-to-number conversion. A query without an explicit culture is not portable.

**Rule:** output dates as `date` or `datetime` types, never as text formatted for display, because the next consumer re-parses them under its own rules.

## 4. Errors must be counted, not swallowed

`try ... otherwise null` in a transform converts a failed row into a blank that looks like missing source data. The row count stays the same and nobody notices.

```m
Bad:  Table.AddColumn(Src, "amt", each try Number.From([amount]) otherwise null)
Good: two queries from the same staging step, one clean and one reject
```

Split explicitly:

```m
// t_orders_clean
let
    Src   = stg_orders,
    Typed = Table.TransformColumnTypes(Src, {{"amount", type number}, {"order_date", type date}}, "en-GB"),
    Clean = Table.RemoveRowsWithErrors(Typed)
in
    Clean

// t_orders_rejects  -- load this to its own sheet
let
    Src    = stg_orders,
    Typed  = Table.TransformColumnTypes(Src, {{"amount", type number}, {"order_date", type date}}, "en-GB"),
    Errs   = Table.SelectRowsWithErrors(Typed),
    Why    = Table.AddColumn(Errs, "error", each try Number.From([amount]) otherwise "amount not numeric", type text)
in
    Why
```

A refresh with an empty reject table is one you can trust. A refresh with 40 rejects is one you have to explain, and you can only explain it if the rows still exist.

**Rule:** every pipeline that converts types ships a reject query. No reject query means failures are invisible.

**Rule:** use `try ... otherwise` only where the fallback is a real business default, and name the step so the default is visible in Applied Steps.

## 5. Unpivot by exclusion, not by selection

Selecting the twelve month columns and unpivoting writes all twelve names into the step, so next year's file with thirteen columns loads eleven of them.

```
Bad:  select Jan..Dec > Unpivot Columns
Good: select the key columns > right-click > Unpivot Other Columns
```

```m
Long = Table.UnpivotOtherColumns(Src, {"region", "product"}, "month", "amount")
```

`Table.UnpivotOtherColumns` names only the columns that stay, which is the short and stable list.

**Rule:** unpivot other columns whenever the columns to unpivot could grow. That is any date-shaped header row.

**Rule:** promote headers with `Table.PromoteHeaders(Src, [PromoteAllScalars=true])` so a numeric header like `2026` does not stay a number and break later name lookups.

## 6. Joins: pick the kind, then check the count

`Table.NestedJoin` (the UI's Merge) returns a table column you expand. `Table.Join` returns a flat result but requires no duplicate key names and folds differently.

The join kind is the decision, and `JoinKind.LeftOuter` being the default is not a reason to keep it:

- `JoinKind.Inner`: drops unmatched rows on both sides. Fine for a mandatory lookup, a silent data loss otherwise.
- `JoinKind.LeftOuter`: keeps all left rows, nulls for unmatched. The default.
- `JoinKind.LeftAnti`: returns only left rows with no match. This is your orphan report.

Always build the anti-join alongside the real join:

```m
Orphans = Table.NestedJoin(Orders, {"customer_id"}, Customers, {"customer_id"}, "m", JoinKind.LeftAnti)
```

A left join whose orphan count is non-zero means either bad reference data or a key type mismatch (`"1001"` text against `1001` number never matches and never errors).

**Rule:** compare the row count before and after every join. A left join that increases the row count means the right side is not unique on the key, so the join fanned out.

**Rule:** normalize key types and trim key text in staging, before any join, because `"ACME "` and `"ACME"` join to nothing.

**Rule:** expand only the columns you need and rename them at the expand step, because the default `Table.ExpandTableColumn` prefix makes every downstream reference verbose and fragile.

## 7. Parameters, not hardcoded paths

A query with `C:\Users\you\Downloads\orders.xlsx` inside it breaks the moment anyone else refreshes it.

```
Home > Manage Parameters > New Parameter
  Name: SourceFolder   Type: Text   Current Value: \\server\share\exports
```

```m
Source = Folder.Files(SourceFolder)
```

**Rule:** every file path, server name, database name, and cutoff date is a parameter. Parameters are editable without opening the query editor, which is the point.

**Rule:** for a folder of identical files, use `Folder.Files` plus the generated sample-file function rather than one query per file, and filter `[Extension] = ".csv"` immediately so hidden `~$` lock files never enter the pipeline.

The combine-files pattern, with the filter before the expensive step:

```m
let
    Files    = Folder.Files(SourceFolder),
    OnlyCsv  = Table.SelectRows(Files, each [Extension] = ".csv" and not Text.StartsWith([Name], "~$")),
    Parsed   = Table.AddColumn(OnlyCsv, "data", each Csv.Document([Content], [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv])),
    Headed   = Table.AddColumn(Parsed, "tbl", each Table.PromoteHeaders([data], [PromoteAllScalars=true])),
    Tagged   = Table.SelectColumns(Headed, {"Name", "tbl"}),
    Combined = Table.ExpandTableColumn(Tagged, "tbl", {"order_id", "order_date", "amount"}),
    Typed    = Table.TransformColumnTypes(Combined, {{"order_date", type date}, {"amount", type number}}, "en-GB")
in
    Typed
```

Keeping `Name` gives every row its source file, which is the only way to trace a bad number back to the export it came from. Set `Encoding=65001` explicitly, because an unspecified encoding is guessed per file and mangles accented names in some of them.

## 8. The formula firewall

`Formula.Firewall: Query 'X' references other queries, so it may not directly access a data source` does not mean your query is wrong. It means a single query mixed a data source reference with a reference to another query.

The fix is structural, not a setting:

```
Bad:  one query that calls Sql.Database(ServerParam, DbParam) and also joins stg_lookup
Good: stg_sql (source only) and t_join (references stg_sql and stg_lookup, no source calls)
```

Setting `Privacy Levels > Ignore` hides the error and permits data from a private source to be sent to a public one. Use the split instead.

**Rule:** a query either touches a data source or references other queries. Never both.

## 9. Refresh discipline

- Name every step. `#"Removed Columns1"` tells a reviewer nothing; `RemovedPIIColumns` does. Rename in the Applied Steps pane.
- Keep `Table.Distinct` and `Table.Group` after the filters, never before, because they scan everything you did not remove.
- Disable `Data > Query Options > Background Data` if refresh previews are competing with a long load.
- Turn off `Fast Data Load` only when the UI must stay responsive; it is slower.
- For a workbook that reads its own table with `Excel.CurrentWorkbook`, expect no folding at all and keep the source small.

**Rule:** measure refresh time before optimizing. A 3-second query that is not folding costs nothing; a 90-second one is a folding bug until proven otherwise.

## Anti-patterns

- Clicking through the UI and never reading the generated M in Advanced Editor.
- Leaving every auto-inserted `Changed Type` step in place.
- `Table.Buffer` as a first response to slowness.
- Loading staging queries to sheets "to check them".
- Referencing a column by position (`Table.ColumnNames(Src){3}`) instead of by name.
- `try ... otherwise null` with no reject query.
- Merging queries from two different sources inside a query that also opens a source.
- Hardcoded paths, server names, and date cutoffs.
- Filtering after adding custom columns, which breaks the fold and then filters locally.
- Building a pipeline in Power Query when the source is a database you can just write SQL against.

## When to use this skill

Use it when a refresh takes minutes against a database that answers the same question in seconds, when a query breaks after a source column was renamed, when dates or decimals differ between two people refreshing the same file, when a join silently changed the row count, when `Formula.Firewall` appears, or when the same manual cleaning has now happened twice. Skip it when the transformation is a one-off on a file nobody will see again, when the volume and logic belong in SQL or pandas with tests and version control, or when the source is already a clean typed view you can query directly.
