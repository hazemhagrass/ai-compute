# Python Pandas Analysis

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

A skill for doing real data analysis in pandas without shipping wrong numbers: correct assignment, honest dtypes, validated merges, vectorized transforms, and shape assertions that catch silent row loss.

## What it does

Pandas rarely fails loudly. It fails by giving you a plausible number that is wrong. This skill names the specific mechanisms that produce those numbers and gives the fix for each:

- **Chained assignment and `SettingWithCopyWarning`**: why `df[mask]["col"] = x` does nothing, and why `.loc[rows, cols]` is the only safe form.
- **Dtype drift**: `object` columns hiding string arithmetic, `int64` upcasting to float on the first NaN, and float money accumulating cents of error.
- **Merge validation**: `validate=` to assert cardinality and `indicator=` to find unmatched keys, plus the dtype-mismatch join that matches zero rows.
- **Performance**: why `.apply(axis=1)` costs 100x to 1000x the vectorized equivalent, and the concrete replacements (`np.where`, `np.select`, `.map`, the `.str` accessor).
- **groupby**: when `transform` beats `agg` plus a merge, and the `dropna` / `observed` defaults that quietly drop rows or explode them.
- **Memory**: `category` dtype, numeric downcasting, `usecols`, and chunked `read_csv` for files larger than RAM.
- **Datetimes**: UTC on load, explicit `format=`, and why `.dt.date` is a trap.
- **Messy input**: the `read_csv` and `read_excel` argument sets that survive BOMs, thousands separators, footer totals, and leading-zero identifiers.
- **Chaining and reshaping**: `.pipe` / `.assign` pipelines, `melt`, and `pivot_table` vs `pivot`.
- **Verification**: shape, key uniqueness, null, and sum-preservation assertions as code, not as a glance at `head()`.

## When to use this

Concrete triggers:

- A report's totals changed after a refactor and nobody can say which step moved them.
- A `merge` returned more rows than the left frame had, or fewer.
- You see `SettingWithCopyWarning` and have been ignoring it.
- A column that should be numeric shows up as `object` in `df.dtypes`.
- `.sum()` on a money column returns something like `19.999999999999996`.
- A transform takes minutes on a frame that comfortably fits in memory.
- A `groupby` result has fewer rows than you expected (missing keys were dropped).
- A CSV round trip destroyed leading zeros in zip codes or SKUs.
- The output feeds a dashboard, an invoice, or anything someone else will trust.

Skip it when:

- The analysis is a throwaway exploration nobody acts on.
- The work is pure filter-and-aggregate over a table already in a database (do it in SQL).
- The data will not fit in memory even chunked (use Polars, DuckDB, or Dask).

## Quick start

One worked example: orders and customers arrive as messy CSVs, and the goal is revenue per region with a per-order share of customer spend. Every step is a real pandas call.

**Step 0: turn on copy-on-write so chained assignment cannot bite**

```python
import numpy as np
import pandas as pd

# No-op (and deprecated) on pandas 3.x, where CoW is always on. Keep it only
# while pandas 2.x is still in your support range.
if pd.__version__ < "3":
    pd.options.mode.copy_on_write = True
```

**Step 1: load with explicit dtypes, not inference**

```python
orders = pd.read_csv(
    "orders.csv",
    usecols=["order_id", "customer_id", "sku", "qty", "price", "ts"],
    dtype={"order_id": "string", "customer_id": "string", "sku": "string", "qty": "Int64"},
    na_values=["", "NA", "N/A", "null", "-"],
    thousands=",",
    encoding="utf-8-sig",
)
customers = pd.read_csv(
    "customers.csv",
    usecols=["customer_id", "region", "signup_ts"],
    dtype={"customer_id": "string", "region": "category"},
)
```

**Step 2: assert what you believe before transforming**

```python
n_orders = len(orders)
assert orders["order_id"].is_unique, "order_id is not a key"
assert customers["customer_id"].is_unique, "customers table is not one row per customer"
assert orders["customer_id"].dtype == customers["customer_id"].dtype
```

**Step 3: clean in one chain, money as integer cents**

```python
clean = (
    orders
    .assign(
        ts=lambda d: pd.to_datetime(d["ts"], format="%Y-%m-%d %H:%M:%S", utc=True),
        price_cents=lambda d: (pd.to_numeric(d["price"], errors="coerce") * 100)
                              .round()
                              .astype("Int64"),
    )
    .assign(total_cents=lambda d: d["price_cents"] * d["qty"])
    .dropna(subset=["total_cents"])
    .drop(columns=["price"])
    .reset_index(drop=True)
)
```

**Step 4: fix a bad row with `.loc`, never a chained assignment**

```python
# Returns were logged with a positive total. Flip them in place, correctly.
clean.loc[clean["sku"].str.startswith("RET-", na=False), "total_cents"] *= -1
```

**Step 5: merge with the cardinality declared and unmatched keys surfaced**

```python
joined = clean.merge(customers, on="customer_id", how="left",
                     validate="many_to_one", indicator=True)

orphans = joined.loc[joined["_merge"] == "left_only", "customer_id"].nunique()
assert orphans == 0, f"{orphans} customer_ids missing from customers.csv"
assert len(joined) == len(clean), f"row count moved: {len(clean)} -> {len(joined)}"
joined = joined.drop(columns="_merge")
```

**Step 6: `transform` for the per-row share, `agg` for the summary**

```python
joined["customer_cents"] = joined.groupby("customer_id")["total_cents"].transform("sum")
joined["share_of_customer"] = joined["total_cents"] / joined["customer_cents"]

by_region = (
    joined
    .groupby("region", as_index=False, dropna=False, observed=True)
    .agg(orders=("order_id", "nunique"),
         customers=("customer_id", "nunique"),
         revenue_cents=("total_cents", "sum"))
    .assign(revenue=lambda d: d["revenue_cents"] / 100)
    .sort_values("revenue", ascending=False)
)
```

**Step 7: prove nothing leaked before reporting**

```python
assert by_region["orders"].sum() == len(clean), "orders lost between clean and summary"
assert by_region["revenue_cents"].sum() == joined["total_cents"].sum()
print(f"dropped {n_orders - len(clean)} of {n_orders} rows for unparseable price")

print(by_region.to_string(index=False))
```

If step 7 raises, the bug is real and you found it before the reader did.

## Key concepts

- **View vs copy.** Slicing may return either, and pandas cannot tell you which. Assigning into the result is therefore undefined behavior. `.loc[rows, cols]` for in-place edits, `.copy()` for an independent frame.
- **Copy-on-write.** `pd.options.mode.copy_on_write = True` makes every slice behave like a copy and turns chained assignment into a reliable no-op instead of a coin flip. On pandas 3.0 and later it is always on and the option is a deprecated no-op, so set it only while you still support pandas 2.x.
- **Nullable dtypes.** `Int64`, `Float64`, `boolean`, and `string` (capitalized) hold `pd.NA` without upcasting. NumPy's `int64` cannot, so one missing value silently converts the whole column to float.
- **Vectorization.** Pandas and NumPy operations run in compiled code over whole arrays. `.apply(axis=1)` runs a Python function per row, so the cost is the interpreter, not the arithmetic.
- **`transform` vs `agg`.** `agg` collapses to one row per group. `transform` returns the input shape with the group result broadcast to every row, which removes the need for a merge-back.
- **Merge cardinality.** `validate="many_to_one"` asserts the right side is unique on the key. Without it, a duplicated right-side key multiplies rows and inflates every downstream sum.
- **`category` dtype.** Stores an integer code plus a small dictionary. Big win for low-cardinality strings (status, region, country), a net loss for high-cardinality ones (ids, emails).
- **Money.** Binary floats cannot represent cents exactly. Store integer minor units and divide only at the presentation edge, or compare with `np.isclose`, never `==`.
- **Naive vs aware datetimes.** Comparing them raises. Parse to UTC on load (`utc=True`), convert to a local zone only for display.

## Common pitfalls

**Chained assignment**

```python
# Bad: assigns into a temporary that is thrown away
df[df["score"] > 80]["band"] = "high"

# Good: one .loc with both selectors
df.loc[df["score"] > 80, "band"] = "high"
```

Reason: the first form calls `__setitem__` on an intermediate object, not on `df`.

**Integers that become floats**

```python
df["user_id"] = df["user_id"].astype("int64")   # Bad: one NaN yields 1.0, 2.0, 3.0
df["user_id"] = df["user_id"].astype("Int64")   # Good: nullable integer holds pd.NA
```

Reason: NumPy int64 has no NA representation, so pandas upcasts to float64.

**Unvalidated merge**

```python
# Bad: a duplicated customer_id silently doubles the orders
out = orders.merge(customers, on="customer_id", how="left")

# Good: fail loudly on the wrong cardinality
out = orders.merge(customers, on="customer_id", how="left", validate="many_to_one")
```

Reason: row duplication inflates every sum downstream and produces no warning.

**Row-wise apply**

```python
# Bad: 1M Python calls
df["band"] = df.apply(lambda r: "high" if r["score"] > 80 else "low", axis=1)

# Good: one vectorized call
df["band"] = np.where(df["score"] > 80, "high", "low")
```

Reason: `.apply(axis=1)` pays interpreter overhead per row, typically 100x to 1000x slower.

**Float money comparison**

```python
# Bad
if df["total"].sum() == 100.00: ...

# Good
if np.isclose(df["total"].sum(), 100.00, atol=0.005): ...
```

Reason: `0.1 + 0.2 != 0.3` in binary floating point, and the error accumulates over a sum.

**Dropped group keys**

```python
# Bad: rows with a missing region vanish from the totals
df.groupby("region")["amount"].sum()

# Good: keep them and decide explicitly
df.groupby("region", dropna=False)["amount"].sum()
```

Reason: `groupby` drops NaN keys by default, so the parts stop adding up to the whole.

**Category groupby explosion**

```python
# Bad: emits a row for every unused category combination
df.groupby(["region", "status"])["amount"].sum()

# Good
df.groupby(["region", "status"], observed=True)["amount"].sum()
```

Reason: with `category` dtype, the default produces the full cartesian product of levels.

**Leading zeros destroyed on load**

```python
df = pd.read_csv("addresses.csv")                                          # Bad: "02134" -> 2134
df = pd.read_csv("addresses.csv", dtype={"zip": "string", "sku": "string"})  # Good
```

Reason: the parser infers numeric and the original text is gone by the time you notice.

**Ambiguous datetime parsing**

```python
# Bad: 03/04/2026 parses as March or April depending on the file
df["ts"] = pd.to_datetime(df["ts"])

# Good
df["ts"] = pd.to_datetime(df["ts"], format="%d/%m/%Y", utc=True, errors="raise")
```

Reason: inference is per-call and can flip between runs when the data changes.

**Growing a frame in a loop**

```python
# Bad: quadratic, reallocates on every iteration
for chunk in chunks:
    df = pd.concat([df, chunk])

# Good: one concat
df = pd.concat(list(chunks), ignore_index=True)
```

Reason: each `concat` copies the entire accumulated frame.

**Verifying by eyeball**

```python
df.head()                                                          # Bad
print(df.shape, df["order_id"].is_unique, df.isna().sum().to_dict())  # Good
```

Reason: `head()` cannot show row loss, duplication, or nulls further down the frame.

## See also

- `SKILL.md` in this directory: the full rule set with paired examples for each of the eleven areas.
- pandas docs: "Copy-on-Write", "Returning a view versus a copy", and "Nullable integer data type".
- pandas docs: `DataFrame.merge` (the `validate` and `indicator` parameters) and `DataFrame.groupby` (`dropna`, `observed`).
- `skills/engineering/sql-optimization`: when the aggregation belongs in the database instead of in memory.
- Polars and DuckDB: the next step when the frame stops fitting in RAM or the pipeline needs a query planner.
