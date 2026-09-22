# Airtable Database Builder

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="airtable-database-builder robot" width="200">
</div>

A skill for designing an Airtable base that survives growth: one table per entity, linked records as joins, views as saved queries, honest automation and permission limits, and a clear statement of the point where the right answer is Postgres.

## What it does

Airtable looks like a spreadsheet and behaves like a relational database, and the gap between those two facts is where bases rot. This skill covers the Airtable-specific craft, and refuses to pretend the ceiling is not there:

- **Table per entity, linked record as the join.** Every noun gets a table. Linked records are bidirectional by construction, and they are the only foreign key you should use. Hand-rolled `Client ID` text columns are foreign keys with no integrity.
- **Why a spreadsheet import becomes a bad base.** Repeated text columns are entities that were never given a table, and the repetition shows up as typo-split groupings, values with no home, and renames that only half apply.
- **The single select to linked record moment.** Status and Priority stay single selects. Client, Vendor, Owner do not, and there is a specific set of signals that tells you the switch is due.
- **Lookup vs rollup.** Lookup shows the linked values; rollup reduces them with an aggregation. Getting this backwards produces formulas handed an array where they expected a number.
- **Denormalization Airtable pushes you toward.** There is no join you write at query time, so borrowed values must be materialized as fields. Live projections are fine; hand-copied duplicates drift.
- **Views as saved queries per audience.** Filter, sort, group, hide. Never a duplicated table to make a filtered copy.
- **Interfaces vs raw grid.** The grid is the schema editor. Everyone else gets an interface or a form.
- **Automation failure modes.** Silent failure, metered run allowances, and the self-triggering loop where an automation writes the field that triggers it.
- **Permissions and share links.** What a read-only share still exposes, including lookups from tables the recipient cannot open.
- **API basics.** Pagination, batched writes, rate limits and backoff, field IDs over field names, and the absence of transactions.
- **When Airtable is wrong.** Large row counts, transactional integrity, SQL joins across large tables, enforced validation. Plus the migration path out.

## When to use this

Use it when:

- You are designing a new base and want the schema decided before people start typing into it.
- A CSV or spreadsheet is about to become a base, or already did.
- The same client or product name is typed into hundreds of rows and grouping is full of near-duplicates.
- A single select dropdown has grown past a few dozen options, or someone wants to attach a fact to an option.
- You cannot decide whether a field should be a lookup or a rollup.
- Someone is about to duplicate a table to make a filtered version for a team.
- An automation "did not run" and nobody can say when it stopped.
- An automation is updating records in a loop.
- You are about to share a view externally and want to know what the recipient actually sees.
- You are writing an API client against a base.
- The base is slow, large, or now load-bearing for money or legal state, and someone needs an honest answer about whether it should still be Airtable.

Skip it when:

- You are designing tables in a real database: use `skills/engineering/database-design`.
- You need a one-off summary of a flat export: use `skills/office/pivot-tables`.
- The question is about querying data that already lives in SQL: use `skills/data/sql-for-analysts`.

## Quick start

Goal: turn a flat project-tracking spreadsheet into a base that still works at ten times the rows.

**Step 1: list the nouns**

Read the column headers and name the entities hiding in them. A sheet with `Project`, `Client`, `Client Email`, `Owner`, `Hours`, `Rate` contains four entities, not one: Projects, Clients, People, and Time Entries.

**Step 2: clean the text before you convert anything**

Group by the column you are about to convert and fix casing, trailing spaces, and `Inc` vs `Inc.` first. Conversion mints one record per distinct string, so every typo becomes a permanent duplicate client.

**Step 3: build the entity tables**

Create Clients, People, Projects, Time Entries. Give each a primary field that reads well as a chip: client name, person name, project name. Never leave the primary field as a note or a blank formula.

**Step 4: replace repeated text with linked records**

Convert the `Client` text field on Projects into a linked record pointing at Clients. Then move `Client Email` off Projects and onto the Clients table, where it belongs once instead of three hundred times.

**Step 5: borrow, do not copy**

On Projects, add a lookup of the client's billing email if people need to see it there. On Clients, add a rollup counting linked Projects and one summing their value. Both stay correct when the source changes; a pasted value does not.

**Step 6: turn tabs into views**

Delete any per-client or per-status duplicate tables. Recreate them as views on the one Projects table: filter by status, group by client, sort by due date. Lock the views that an interface or share link depends on.

**Step 7: give non-editors an interface**

Build a dashboard interface for stakeholders and a form for anyone submitting work. Point both at a locked view.

**Step 8: automate carefully**

Add one automation. Trigger it on "record enters view" with a view whose filter the action makes false, so it cannot retrigger itself. Have it stamp a `Processed At` field on success, so a blank stamp is a visible failure.

**Step 9: write down the ceiling**

Record the record count, the rollup depth, and the transactional requirements. Revisit when any grows. Check current plan limits at that time rather than trusting a remembered number.

## Key concepts

- **Linked record.** Airtable's foreign key. Bidirectional automatically, referentially real, and the only correct way to relate two tables.
- **Primary field.** The first field of a table, shown as the label on every link chip elsewhere in the base. Choose it for readability, not for data.
- **Junction table.** A table representing a relationship that carries its own data (role, rate, dates). Only needed when the link itself has attributes; a plain many-to-many does not need one.
- **Lookup.** A field that displays values from linked records without aggregating. Returns a list when the link holds several records.
- **Rollup.** A field that aggregates values from linked records with a function such as SUM, COUNT, MAX, or ARRAYJOIN. Use it to reduce; use a lookup to display.
- **Formula.** Computed from fields in the same record only, read-only, and unable to reach another record on its own.
- **View.** A saved filter, sort, grouping, and field-visibility configuration over one table. Data lives once regardless of how many views exist.
- **Locked view.** A view whose configuration cannot be casually changed, which is what makes it safe for an interface, automation, or share link to depend on.
- **Interface.** A built surface over base data for people who should not see or edit the schema. The correct default for non-builders.
- **Share link.** An unauthenticated public URL for a view. The URL is the only access control.
- **Self-trigger loop.** An automation whose action satisfies its own trigger condition, re-firing until it hits a limit. Prevented by structure, not by hoping.
- **Field ID.** The stable identifier for a field, unchanged by renames. Field names are not stable and should not anchor an integration.

## Common pitfalls

**Client name as a text column**

Bad: `Client` is a text field typed fresh on every project.
Good: `Client` is a linked record to a Clients table.

Reason: text has no identity, so renames only half apply and attributes have nowhere to live.

**Single select used as an entity**

Bad: a `Vendor` single select with ninety options and a contact email pasted in a second column.
Good: a Vendors table with a contact email field, linked from the record.

Reason: a select option cannot carry attributes and cannot tell you what points at it.

**Duplicating a table to make a filtered copy**

Bad: `Projects` and `Projects - Acme`.
Good: a filtered view on `Projects`, grouped by client.

Reason: two tables are two truths, and nothing keeps them in sync.

**Rollup where a lookup was meant, or the reverse**

Bad: a rollup with `ARRAYJOIN` used to show a single linked email, or a lookup fed into `SUM`.
Good: lookup to display the value, rollup to reduce many values to one.

Reason: a lookup across a to-many link yields an array, and arithmetic on an array misbehaves.

**Pasting a value instead of linking**

Bad: copying the client's current rate into each project row.
Good: a lookup, or if a frozen value is genuinely needed, a field named `Rate At Signing` with a documented writer.

Reason: an undocumented copy drifts and nobody can tell which value is true.

**Automation that writes its own trigger field**

Bad: trigger on "record updated", action updates a field in that record.
Good: trigger on "enters view" with a condition the action clears, or write to a different field than the one watched.

Reason: the action satisfies the trigger and the automation runs against itself until a limit stops it.

**Assuming an automation succeeded**

Bad: no visibility into runs; the first sign of failure is a customer complaint.
Good: a `Processed At` stamp written on success, plus a view of records missing it.

Reason: failed runs are silent by default and do not halt anything.

**Sharing a view without checking what it exposes**

Bad: sharing a view that contains a lookup from a table the recipient should not see.
Good: hide every field the recipient does not need, then open the link in a private window and read it.

Reason: a read-only share still exposes every visible field, including borrowed ones.

**Integrating against field names**

Bad: an API client keyed on `"Client Email"`.
Good: an API client keyed on field IDs.

Reason: a rename in the UI silently breaks every name-based call.

**Ignoring rate limits until 429**

Bad: a sync loop firing one request per record with no backoff.
Good: batched writes, followed pagination, and exponential backoff on 429.

Reason: the per-base rate limit returns errors with a cooldown, and limits change, so check current limits.

**Treating Airtable as a store of record for money or legal state**

Bad: invoicing or inventory whose correctness depends on atomic multi-record updates.
Good: Postgres, with constraints that make the bad state unrepresentable.

Reason: Airtable has no transactions and no constraints beyond field type, so a half-applied update simply stays half-applied.

**Scaling past the point of honesty**

Bad: nesting rollups and splitting tables to keep a very large base responsive.
Good: naming the threshold early and planning the migration before the base is load-bearing.

Reason: every workaround increases the cost of the migration that is coming anyway.

## See also

- `SKILL.md` in this directory: the full rule set, including the step-by-step migration path out of Airtable.
- `skills/engineering/database-design`: keys, constraints, indexing, and migrations. The schema thinking this skill assumes, and the target shape when you leave Airtable.
- `skills/data/sql-for-analysts`: the joins and aggregations that become possible once the data lives somewhere that can do them.
- `skills/engineering/api-integration`: retries, backoff, and idempotency for the API client you will write against a base.
- `skills/office/pivot-tables`: when the question is a one-off summary and needs no base at all.
- `skills/data/python-pandas-analysis`: cleaning an export before import so linked-record conversion does not mint duplicate entities.
