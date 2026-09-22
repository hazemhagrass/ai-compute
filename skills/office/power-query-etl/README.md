# Power Query ETL

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for building Power Query pipelines that survive next month's file: staged queries, folding preserved, columns referenced by name, locale pinned, errors counted instead of swallowed, and paths in parameters.

## What it does

Power Query rarely tells you it has gone wrong. It quietly stops pushing work to the server, hardcodes column names into forty steps, converts dates under whoever's regional settings, and turns failed rows into blanks. This skill names each mechanism and gives the exact fix:

- **Pipeline shape**: staging / transform / load as separate queries, with everything but the output set to Connection Only.
- **Query folding**: what `View Native Query` actually tells you, which steps fold, which break folding permanently, and why filter-first is a correctness decision rather than a style one.
- **The auto-generated `Changed Type` step**: why it breaks on a renamed column and hides a new one, and the single end-of-query typing step that replaces it.
- **Locale**: the third argument to `Table.TransformColumnTypes`, and why a query without it is not portable between machines.
- **Errors**: `Table.RemoveRowsWithErrors` plus a companion reject query, instead of `try ... otherwise null` blanking the rows that needed attention.
- **Unpivot**: `Table.UnpivotOtherColumns` so next year's extra month column is not silently dropped.
- **Joins**: choosing the join kind deliberately, the anti-join orphan report, and the row-count check that catches fan-out.
- **Parameters**: paths, servers, and cutoff dates that someone else can change without opening the editor.
- **The formula firewall**: why the error is structural and why `Privacy Levels > Ignore` is the wrong fix.
- **Refresh discipline**: named steps, ordering, and measuring before optimizing.

## When to use this

Concrete triggers:

- A refresh takes minutes against a database that answers the same query in seconds.
- `View Native Query` is greyed out and nobody knows at which step folding died.
- The query breaks with `The column 'X' of the table wasn't found` after a source rename.
- Two colleagues refresh the same workbook and get different dates or different decimals.
- A merge changed the row count, up or down, and nobody predicted it.
- A join returns no matches between an id column that is text on one side and a number on the other.
- `Formula.Firewall: Query 'X' references other queries, so it may not directly access a data source`.
- A monthly file with month-name columns gained a column and the report lost one.
- The query contains someone's `C:\Users\...` path.
- The same manual clean-up has now been done twice.

Skip it when:

- The transformation is a one-off on a file nobody will see again.
- The logic needs tests, code review, and version control (write SQL or pandas).
- The source is already a clean typed view you can query directly.

## Quick start

One worked pipeline: a monthly folder of CSV exports joined to a customer dimension, loaded with a reject sheet and an orphan report.

**Step 1: parameterize the source**

```
Home > Manage Parameters > New Parameter
  Name: SourceFolder   Type: Text   Current Value: \\server\share\exports
```

**Step 2: staging query, connection only**

```m
// stg_orders
let
    Files   = Folder.Files(SourceFolder),
    OnlyCsv = Table.SelectRows(Files, each [Extension] = ".csv" and not Text.StartsWith([Name], "~$")),
    Parsed  = Table.AddColumn(OnlyCsv, "tbl", each Table.PromoteHeaders(
                 Csv.Document([Content], [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
                 [PromoteAllScalars=true])),
    Tagged  = Table.SelectColumns(Parsed, {"Name", "tbl"}),
    Rows    = Table.ExpandTableColumn(Tagged, "tbl", {"order_id", "customer_id", "order_date", "amount"})
in
    Rows
```

```
Home > Close & Load To > Only Create Connection
```

Keeping `Name` means every row can be traced back to the file it came from.

**Step 3: filter and drop columns first, so the work folds**

```m
Kept     = Table.SelectColumns(Rows, {"Name", "order_id", "customer_id", "order_date", "amount"}, MissingField.UseNull),
Recent   = Table.SelectRows(Kept, each [order_date] >= "2026-01-01")
```

Then check it actually folded:

```
Right-click the last Applied Step > View Native Query
```

Greyed out? Walk up the steps until it lights up. The first greyed step is the one that broke the fold.

**Step 4: type once, with the culture pinned**

```m
Typed = Table.TransformColumnTypes(Recent,
    {{"order_id", type text}, {"customer_id", type text},
     {"order_date", type date}, {"amount", type number}}, "en-GB")
```

`"en-GB"` is what makes `03/04/2026` mean 3 April on every machine that refreshes this file.

**Step 5: split clean rows from rejects**

```m
// t_orders
Clean = Table.RemoveRowsWithErrors(Typed)

// t_orders_rejects  -- load to its own sheet
Errs  = Table.SelectRowsWithErrors(Typed)
```

Load the reject query to a visible sheet. An empty reject sheet is the evidence that the refresh was clean.

**Step 6: normalize keys before joining**

```m
Keyed = Table.TransformColumns(Clean, {{"customer_id", each Text.Upper(Text.Trim(_)), type text}})
```

`"1001 "` and `"1001"` never match and never error. Do this on both sides.

**Step 7: join, and build the orphan report next to it**

```m
// t_orders_enriched
Joined   = Table.NestedJoin(Keyed, {"customer_id"}, stg_customers, {"customer_id"}, "cust", JoinKind.LeftOuter),
Expanded = Table.ExpandTableColumn(Joined, "cust", {"customer_name", "region"}, {"customer_name", "region"})

// t_orders_orphans  -- load to its own sheet
Orphans = Table.NestedJoin(Keyed, {"customer_id"}, stg_customers, {"customer_id"}, "cust", JoinKind.LeftAnti)
```

**Step 8: check the row count across the join**

```
Table.RowCount(Keyed)  must equal  Table.RowCount(Expanded)
```

A larger number means the customer table is not unique on `customer_id` and the join fanned out, duplicating revenue. That is the failure nobody catches by looking at the output.

**Step 9: load only the outputs**

```
t_orders_enriched  > Close & Load To > Table / Data Model
t_orders_rejects   > Close & Load To > Table
t_orders_orphans   > Close & Load To > Table
stg_*              > Only Create Connection
```

Next month is one Refresh, and the two small sheets tell you whether to trust it.

## Key concepts

- **Query folding.** Power Query's translation of your steps into a native query the source executes. Folding means the server filters; no folding means your machine downloads everything and filters locally. `View Native Query` is the only way to know which you have.
- **Fold-breaking step.** Any step with no native equivalent: `Table.Buffer`, `Table.AddIndexColumn`, custom functions, cross-source merges. Everything after it runs locally, so its position in the list determines how much data crosses the wire.
- **Staging / transform / load.** Three query layers. Staging touches the source and nothing else; transform references queries only; load is the one query that materializes. The split is also the formula-firewall fix.
- **Connection Only.** A query that computes but does not land on a sheet. Every non-output query should be one, or the workbook holds several redundant copies of the data.
- **`MissingField.UseNull`.** Makes `Table.SelectColumns` tolerate an absent column by producing nulls instead of failing. `MissingField.Ignore` drops it silently, which loses the signal entirely.
- **Culture argument.** The third parameter of `Table.TransformColumnTypes`. Without it, text-to-date and text-to-number conversion uses the local machine's settings, so the same query gives different answers in different places.
- **Error row vs null.** A conversion failure produces an error value, which `Table.SelectRowsWithErrors` can still find. `try ... otherwise null` destroys that evidence and makes the row look like missing source data.
- **`JoinKind.LeftAnti`.** A join that returns only the unmatched left rows. It is not an edge case; it is the report that proves a left join did not quietly lose reference data.
- **Formula firewall.** A privacy mechanism that refuses to let one query both open a data source and reference another query. The fix is to split the query, not to disable privacy levels.

## Common pitfalls

**Filtering after adding custom columns**

```
Bad:  Source > Add Custom Column > Filter Rows
Good: Source > Filter Rows > Remove Columns > Add Custom Column
```

Reason: the custom column breaks folding, so the filter then runs locally over the whole downloaded table.

**`Table.Buffer` to make it faster**

```
Bad:  Buffered = Table.Buffer(Source)   on a SQL source
Good: remove the buffer, keep folding, check View Native Query
```

Reason: buffering materializes the table in memory, which is the definition of not folding.

**Accumulated auto-typing steps**

```
Bad:  six #"Changed Type" steps, each listing forty column names
Good: one Table.TransformColumnTypes at the end, listing the columns you use
```

Reason: each one hardcodes every column name, so any rename upstream breaks the query at the first of them.

**Type conversion without a culture**

```
Bad:  Table.TransformColumnTypes(Src, {{"d", type date}})
Good: Table.TransformColumnTypes(Src, {{"d", type date}}, "en-GB")
```

Reason: the conversion silently follows the refreshing machine's locale, so `03/04/2026` changes meaning between colleagues.

**Swallowing errors**

```
Bad:  each try Number.From([amount]) otherwise null
Good: Table.RemoveRowsWithErrors plus a Table.SelectRowsWithErrors reject query
```

Reason: the null is indistinguishable from genuinely missing data, and the row count does not move.

**Unpivoting selected columns**

```
Bad:  select Jan..Dec > Unpivot Columns
Good: select the keys > Unpivot Other Columns
```

Reason: the step hardcodes twelve names, so a thirteenth column next year is dropped without a message.

**Joining unnormalized keys**

```
Bad:  merge on customer_id as it arrives
Good: Text.Upper(Text.Trim(_)) and a matching type on both sides, in staging
```

Reason: `"1001 "` against `1001` matches nothing and raises nothing; the result is an empty lookup that looks like missing reference data.

**Ignoring the row count across a join**

```
Bad:  expand the merge and move on
Good: compare Table.RowCount before and after, and build a LeftAnti orphan query
```

Reason: a non-unique right key fans out rows and multiplies the totals downstream.

**Hardcoded paths**

```
Bad:  Folder.Files("C:\Users\you\Downloads\exports")
Good: Home > Manage Parameters > SourceFolder, then Folder.Files(SourceFolder)
```

Reason: the query breaks for every other person and every other machine.

**Disabling privacy to clear the firewall**

```
Bad:  Query Options > Privacy > Ignore Privacy Levels
Good: split into stg_source (source only) and t_transform (query references only)
```

Reason: ignoring privacy levels permits data from a private source to be sent to a public one, which is the thing the error was preventing.

**Loading staging queries to sheets**

```
Bad:  every query > Close & Load > Table
Good: Close & Load To > Only Create Connection for everything but the outputs
```

Reason: each loaded query is a second full copy of the data, refreshed every time.

**Unnamed steps**

```
Bad:  #"Removed Columns1", #"Filtered Rows2", #"Changed Type3"
Good: RemovedPIIColumns, KeptCurrentYear, TypedForLoad
```

Reason: Applied Steps is the only documentation the query has; default names document nothing.

## See also

- `SKILL.md` in this directory: the full rule set with paired examples, the folding step list, and the anti-pattern list.
- `skills/office/excel-data-cleaning`: the cleaning rules (hidden characters, date ambiguity, composite keys) that belong in the staging layer.
- `skills/office/pivot-tables`: consuming the loaded output, including the Data Model and relationships instead of lookups.
- `skills/data/sql-for-analysts` and `skills/engineering/sql-optimization`: when the transformation should be a query against the source instead.
- `skills/data/python-pandas-analysis`: when the pipeline needs tests, diffs, and version control.
- Microsoft docs: "Power Query query folding", `Table.TransformColumnTypes`, `Table.SelectColumns`, `Table.UnpivotOtherColumns`, `Table.NestedJoin`, `Table.SelectRowsWithErrors`, and "Power Query privacy levels".
