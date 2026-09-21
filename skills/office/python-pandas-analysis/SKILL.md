---
name: python-pandas-analysis
description: Use when analyzing data with pandas. Avoid the silent correctness traps (chained assignment, dtype drift, merge row loss) and write fast, verifiable transforms.
---

Do real analysis in pandas without shipping wrong numbers. The failure mode is almost never a traceback: it is a merge that silently doubled your rows, a money column stored as float, or a filter that assigned into a copy and did nothing. Every rule below exists because it produced a wrong answer in production.

## The working loop

1. **Load with explicit dtypes.** Never let the parser guess on ids, codes, or money.
2. **Assert the shape immediately.** Record row count and key uniqueness before touching anything.
3. **Transform with chained, copy-returning operations.** `.assign`, `.pipe`, `.loc`, never in-place mutation of a slice.
4. **Validate every merge.** `validate=` and `indicator=` are not optional.
5. **Re-assert shape and nulls at the end.** Compare against step 2.

## 1. SettingWithCopyWarning and chained assignment

A boolean filter returns a view-or-copy that pandas itself cannot predict. Assigning into it may modify the original, or may modify a temporary that is discarded. Both outcomes are bugs.

```python
import pandas as pd

df = pd.DataFrame({"name": ["a", "b", "c"], "score": [10, 20, 30]})

# Bad: chained assignment. Two __setitem__ calls on an intermediate object.
df[df["score"] > 15]["score"] = 0          # silently does nothing
subset = df[df["score"] > 15]
subset["score"] = 0                        # SettingWithCopyWarning, original unchanged

# Good: one .loc call, row selector and column selector together
df.loc[df["score"] > 15, "score"] = 0
# Good: if you genuinely want a separate frame, say so
subset = df[df["score"] > 15].copy()
subset["score"] = 0                        # safe, df untouched
```

**Rule:** any assignment that touches both rows and columns goes through a single `.loc[rows, cols]`. Any frame you intend to mutate independently gets an explicit `.copy()`.

Pandas 3.0 adopts copy-on-write, which makes chained assignment a reliable no-op rather than a coin flip. On 3.x it is always on and the option below is a deprecated no-op, so set it only while you still support pandas 2.x:

```python
if pd.__version__ < "3":
    pd.options.mode.copy_on_write = True
```

## 2. Dtype surprises

### Object columns are a smell

```python
# Bad: one stray " " in the file turns the whole column into object dtype
df = pd.read_csv("sales.csv")
df["qty"].sum()                            # string concatenation, not arithmetic
# Good: declare intent, coerce explicitly, then check
df = pd.read_csv("sales.csv", dtype={"sku": "string", "qty": "Int64"})
df["qty"] = pd.to_numeric(df["qty"], errors="coerce").astype("Int64")
assert df.dtypes["qty"] == "Int64", df.dtypes
```

### Integers with nulls

NumPy int64 cannot hold NaN, so any missing value silently upcasts the column to float64 and your ids become `1.0`, `2.0`, or worse, lose precision above 2**53.

```python
df["user_id"] = df["user_id"].astype("int64")   # Bad: raises, or upcasts via NaN
df["user_id"] = df["user_id"].astype("Int64")   # Good: capital I, holds pd.NA
```

### Money is not a float

```python
# Bad: binary floats do not represent cents exactly
(0.1 + 0.2) == 0.3                          # False
df["total"] = df["price"] * df["qty"]       # 19.999999999999996

# Good: integer minor units, or Decimal at a reporting boundary
df["price_cents"] = (df["price"] * 100).round().astype("Int64")
df["total_cents"] = df["price_cents"] * df["qty"]
df["total"] = (df["price"] * df["qty"]).round(2)   # or round once at the edge
```

**Rule:** never compare float money with `==`. Use integer cents, or `np.isclose`.

## 3. Merges lose and duplicate rows silently

A many-to-many join on a key you believed was unique will multiply your row count and quietly inflate every sum downstream.

```python
# Bad: no idea what happened
out = orders.merge(customers, on="customer_id", how="left")
# Good: declare the cardinality and let pandas fail loudly if it is wrong
out = orders.merge(customers, on="customer_id", how="left",
                   validate="many_to_one",   # raises MergeError on dup right keys
                   indicator=True)           # adds a _merge column

unmatched = out.loc[out["_merge"] == "left_only", "customer_id"]
assert unmatched.empty, f"{unmatched.nunique()} orders have no customer"
assert len(out) == len(orders), f"row count changed: {len(orders)} -> {len(out)}"
out = out.drop(columns="_merge")
```

`validate=` accepts `"one_to_one"`, `"one_to_many"`, `"many_to_one"`, `"many_to_many"`. Pick one every time.

**Also check dtype alignment on the key.** Merging an `int64` key against an `object` key of stringified ints matches zero rows and raises nothing useful:

```python
assert orders["customer_id"].dtype == customers["customer_id"].dtype
```

## 4. Stop using .apply

`.apply(axis=1)` runs a Python function per row. On 1M rows that is 1M interpreter round trips, typically 100x to 1000x slower than the vectorized equivalent.

```python
import numpy as np

# Bad: row-wise apply
df["band"] = df.apply(lambda r: "high" if r["score"] > 80 else "low", axis=1)
# Good: vectorized where
df["band"] = np.where(df["score"] > 80, "high", "low")
# Good: multi-branch, still vectorized
df["band"] = np.select([df["score"] > 80, df["score"] > 50], ["high", "mid"], default="low")
```

Other replacements:

```python
# Bad: apply for a lookup / Good: Series.map is C-level
df["region"] = df["country"].apply(lambda c: REGIONS.get(c, "other"))
df["region"] = df["country"].map(REGIONS).fillna("other")

# Bad: apply for string work / Good: the .str accessor
df["domain"] = df["email"].apply(lambda e: e.split("@")[1])
df["domain"] = df["email"].str.split("@").str[1]

# Bad: apply for arithmetic / Good: plain vectorized subtraction
df["margin"] = df.apply(lambda r: r["rev"] - r["cost"], axis=1)
df["margin"] = df["rev"] - df["cost"]
```

`.apply` is acceptable only when the operation is genuinely non-vectorizable (calling an external API, parsing irregular free text) and the frame is small.

## 5. groupby: transform vs agg vs filter

```python
# agg: one row per group
per_customer = df.groupby("customer_id", as_index=False).agg(
    orders=("order_id", "nunique"), revenue=("total", "sum"), first_seen=("created_at", "min"))

# transform: same shape as the input, broadcast back to every row
df["customer_revenue"] = df.groupby("customer_id")["total"].transform("sum")
df["pct_of_customer"] = df["total"] / df["customer_revenue"]

# Bad: merging an agg back just to broadcast (extra merge, extra risk)
totals = df.groupby("customer_id")["total"].sum().rename("customer_revenue")
df = df.merge(totals, on="customer_id")

# filter: keep whole groups by a group-level predicate
big = df.groupby("customer_id").filter(lambda g: g["total"].sum() > 1000)
```

**Rules:**
- `dropna=False` on `groupby` if missing keys are meaningful, because the default silently drops those rows.
- `observed=True` when grouping on `category` dtype, or you get the full cartesian product of unused categories.
- `as_index=False` (or `.reset_index()`) so you get a plain frame, not a surprise index.

## 6. Memory

```python
# Low-cardinality strings: category dtype, often 10x to 50x smaller
df["status"] = df["status"].astype("category")

# Downcast numerics once you know the ranges
df["qty"] = pd.to_numeric(df["qty"], downcast="integer")
df["ratio"] = pd.to_numeric(df["ratio"], downcast="float")

# Load only what you need; chunk and reduce for files bigger than RAM
df = pd.read_csv("big.csv", usecols=["id", "ts", "amount"], dtype={"id": "Int64"})
totals = []
for chunk in pd.read_csv("huge.csv", chunksize=500_000, usecols=["region", "amount"]):
    totals.append(chunk.groupby("region")["amount"].sum())
result = pd.concat(totals).groupby(level=0).sum()

print(df.memory_usage(deep=True).sum() / 1e6, "MB")   # deep=True or object cols lie
```

**Rule:** do not `astype("category")` a high-cardinality column (ids, emails). The category mapping costs more than the raw strings.

## 7. Datetimes and timezones

```python
# Bad: infers per row, silently mixes D/M/Y and M/D/Y
df["ts"] = pd.to_datetime(df["ts"])
# Good: state the format, fail loudly on anything else
df["ts"] = pd.to_datetime(df["ts"], format="%Y-%m-%d %H:%M:%S", errors="raise")

# Comparing naive and aware datetimes raises. Normalize everything to UTC on load.
df["ts"] = pd.to_datetime(df["ts"], utc=True)
df["ts_local"] = df["ts"].dt.tz_convert("Africa/Cairo")

df["day"] = df["ts"].dt.date        # Bad: object dtype, slow, loses .dt
df["day"] = df["ts"].dt.floor("D")  # Good: stays datetime64

# Resampling needs a DatetimeIndex or an explicit key
daily = df.resample("D", on="ts")["amount"].sum()
```

**Rule:** store UTC internally, convert to a local zone only for display. Never do date arithmetic across a DST boundary in local time.

## 8. Reading messy CSV and Excel

```python
df = pd.read_csv(
    "messy.csv",
    dtype={"zip": "string", "sku": "string"},   # keep leading zeros
    usecols=["zip", "sku", "amount", "ts"],
    na_values=["", "NA", "N/A", "null", "-", "#N/A"],
    thousands=",", skipinitialspace=True,
    encoding="utf-8-sig",                       # strips the Excel BOM
    on_bad_lines="warn",
)

# Excel: stray header rows and totals footers are the usual damage
xl = pd.read_excel("report.xlsx", sheet_name="Q3", header=2, skipfooter=3,
                   dtype={"account": "string"}, engine="openpyxl")
xl.columns = xl.columns.str.strip().str.lower().str.replace(r"\W+", "_", regex=True)
xl = xl.dropna(how="all").dropna(axis=1, how="all")
```

**Rule:** a zip code, phone number, SKU, or account number is a string, not a number. Parsing it as numeric destroys leading zeros irreversibly.

## 9. Method chaining with .pipe and .assign

Chaining avoids intermediate names, avoids mutating the caller's frame, and makes each step reviewable.

```python
def drop_test_accounts(df):
    return df.loc[~df["email"].str.endswith("@internal.test", na=False)]

clean = (
    raw
    .rename(columns=str.lower)
    .pipe(drop_test_accounts)
    .assign(
        ts=lambda d: pd.to_datetime(d["ts"], utc=True),
        amount=lambda d: pd.to_numeric(d["amount"], errors="coerce"),
        margin=lambda d: d["amount"] - d["cost"],   # sees amount from this same .assign
    )
    .dropna(subset=["amount"])
    .sort_values("ts")
    .reset_index(drop=True)
)
```

Inside `.assign`, always use `lambda d: ...` rather than referencing the outer frame, so each step reads the output of the previous step.

## 10. Reshaping

```python
long = df.melt(id_vars=["customer_id", "month"],          # wide to long
               value_vars=["web", "mobile", "store"],
               var_name="channel", value_name="revenue")
# Long to wide, with aggregation (pivot_table, not pivot, when keys repeat)
wide = long.pivot_table(index="customer_id", columns="channel", values="revenue",
                        aggfunc="sum", fill_value=0, observed=True)
wide.columns.name = None
wide = wide.reset_index()
```

`pivot` raises on duplicate index/column pairs. `pivot_table` aggregates them. If you do not know which you have, use `pivot` first: the exception is information.

## 11. Verify before you report

```python
before = len(orders)
assert orders["order_id"].is_unique, "order_id is not a key"
out = orders.merge(customers, on="customer_id", how="left", validate="many_to_one")

assert len(out) == before, f"row loss/duplication: {before} -> {len(out)}"
assert out["revenue"].notna().all(), out["revenue"].isna().sum()
assert abs(out["revenue"].sum() - orders["revenue"].sum()) < 0.01  # totals survive
```

Put these assertions in the script, not in a notebook cell you ran once. A silent 3% row loss is the single most common wrong-number bug in pandas work.

## Anti-patterns

- Iterating with `for i, row in df.iterrows()` (slow, and `row` is a copy, so assignment into it is lost).
- `df.append(...)` in a loop (quadratic; build a list and `pd.concat` once).
- `inplace=True` (does not save memory, breaks chaining, is being deprecated).
- Using `df[col][row] = x` instead of `df.loc[row, col] = x`.
- Checking `if df:` instead of `if df.empty:` (raises ValueError on ambiguity).
- `pd.concat` without `ignore_index=True` when the sources share an index.
- Trusting `df.head()` as verification. Look at `df.shape`, `df.dtypes`, and `df.isna().sum()`.

## When to use this skill

Use it when numbers changed after a refactor, a join returned more rows than it started with, a transform takes minutes on an in-memory frame, a numeric column shows up as `object`, or the output needs to be trusted by someone other than you.

Skip it when the dataset is a one-off nobody acts on, the workload belongs in SQL (filtering and aggregating a table that already lives in a database), or the data exceeds memory even chunked (reach for Polars, DuckDB, or Dask).
