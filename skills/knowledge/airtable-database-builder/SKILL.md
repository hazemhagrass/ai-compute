---
name: airtable-database-builder
description: "Use when designing an Airtable base. Model one table per entity, join with linked records, keep views as saved queries, and name the point where the base should become Postgres."
---

# Airtable Database Builder

Airtable is a relational store wearing a spreadsheet costume. The costume is the problem: it
invites spreadsheet habits that produce a base nobody can query a year later. This skill covers
the Airtable-specific craft and the ceiling. For normalization theory, keys, indexes, and
migration mechanics on a real database, use `skills/engineering/database-design`; do not
re-derive that thinking here, borrow it.

Airtable's published limits, tiers, and pricing change. Never hardcode a row cap, an automation
run count, or a per-second API figure into a design document as fact. Write "check current
limits" and check them when the decision depends on the number.

## One table per entity, linked records as the join

Every noun the business talks about separately gets its own table: Clients, Projects, Invoices,
People. A linked record field is the join, and it is bidirectional by construction: linking
Projects to Clients creates the reverse field on Clients automatically.

- Give every table a human-meaningful primary field (project name, invoice number), because the
  primary field is what every linked record chip displays everywhere else in the base. A primary
  field of `Notes` or a formula that returns blank makes every link unreadable.
- Do not build your own `Client ID` text column and match on it by hand. That is a foreign key
  with no referential integrity, and Airtable already gives you the real thing.
- Model many-to-many directly with a linked record field allowing multiple records. Only add a
  junction table when the relationship itself carries data (a Role, a rate, a start date on a
  Person-to-Project link), because that data has nowhere else to live.
- Keep junction tables named for the relationship (`Assignments`, `Line Items`), not
  `Projects_People`, because humans read this schema in the UI all day.

## The spreadsheet import is the original sin

A CSV import produces one wide table where repeated text is the norm. That base works for a
month and then rots.

Symptoms that a text column should be a linked record:

- The same value is typed into many rows (`Acme Corp` in 340 rows).
- Someone renamed a client and now 40 rows say `Acme Corp.` and 300 say `Acme Corp`.
- You want a fact about that value (the client's billing email) and there is nowhere to put it
  except repeating it in every row.
- You want to count or total per value and the grouping is polluted by typos.

The fix, in order:

1. Deduplicate the text column first (group by it, fix casing and trailing spaces), because
   conversion creates one new record per distinct string, typos included.
2. Create the target table, or let the field-type conversion create the records.
3. Convert the text field to a linked record field pointing at that table.
4. Move the attributes that belonged to the entity (billing email, region, account owner) out of
   the wide table and into the new one.
5. Re-point views, formulas, and automations that referenced the old text field. Conversion does
   not fix them for you.

Do the conversion on a duplicated base first. Field type conversion is lossy in one direction
and there is no transaction to roll back.

## Field types that carry weight

**Single select vs linked record.** Single select is a closed list of labels with no other
attributes. Switch to a linked record the moment any of these is true:

- The option needs a second fact attached to it (an owner, a colour-independent code, a price).
- The list is edited by people who are not base editors, or changes often.
- You want to see, from the option's side, everything that points at it.
- The option count passes a few dozen and the dropdown becomes unusable.

Status, Priority, Stage: single select. Client, Product, Vendor, Owner: linked record. A single
select that is really an entity is the second most common Airtable design failure.

**Formula.** Computed from fields in the same record only. Good for derived values (`Total =
Quantity * Rate`), status flags, and display strings. It cannot reach another record on its own;
that is what lookup and rollup are for. Formula output is read-only, so anything a human must
override needs a separate editable field.

**Lookup vs rollup.** Both reach across a linked record field, and confusing them is the most
common Airtable question.

- **Lookup** pulls the raw values from the linked records and shows them as a list. Invoice ->
  Client -> `Billing Email` returns the email. If the link holds three records, a lookup returns
  three values.
- **Rollup** pulls the same values and applies an aggregation function: `SUM(values)`,
  `COUNT(values)`, `MAX(values)`, `ARRAYJOIN(values)`. Use it for totals, counts, latest date.

Rule of thumb: lookup when you want to *see* it, rollup when you want to *reduce* it. A lookup
across a to-many link that you then try to compute on will misbehave, because the formula is
handed an array, not a number.

Rollups compute on the fly. Deep chains (rollup of a rollup of a rollup) get slow and become the
thing that makes a large base feel broken.

## Denormalization: Airtable pushes you toward it

Airtable has no query-time join you write yourself. The only way to see a related value beside a
record is to materialize it as a lookup or rollup field. That is denormalization by design, and
it is fine, with conditions:

- A lookup or rollup is a *live* projection, not a copy. It updates when the source updates.
  Prefer it over any hand-copied value.
- A hand-typed duplicate of a linked record's value is drift waiting to happen. If you truly need
  a frozen snapshot (the price at time of sale), say so explicitly: give the field a name that
  says frozen (`Price At Sale`), and record what writes it.
- Resist wide tables of 60 lookup fields. Every one is recomputed and every one loads with the
  view. If a table needs that many borrowed fields, the base wants another table.

## Views are saved queries, never copies

A view is a filter, sort, grouping, and field visibility over the one underlying table. Data
lives once.

- One view per audience or per question: `My Open Tasks`, `Invoices Awaiting Payment`,
  `Q3 Pipeline By Owner`. Name views by what they answer.
- Grouping replaces the habit of making a tab per client. Group by the linked record field and
  the per-client section appears, with rollup summaries per group.
- Never duplicate a table to make a filtered copy. Two tables mean two truths, and nothing keeps
  them in sync.
- Personal views prevent the Monday-morning problem of someone re-sorting a shared view for
  everyone. Use collaborative views for shared process, personal views for individual working
  state.
- Lock a view that an interface, automation, or share link depends on, because a casual filter
  change silently changes what that consumer sees.

## Interfaces for humans, grid for builders

The grid is the schema editor. It exposes every field, every record, and every way to break
things. For anyone who is not maintaining the base, build an interface:

- Interfaces give a filtered, role-appropriate, read-or-write surface with the destructive
  operations absent.
- A form is the correct write path for outside contributors: it accepts exactly the fields you
  choose and cannot see the rest of the table.
- Keep the interface's data source a locked view, so interface and grid agree on what is in scope.

## Automations and how they fail

Automations are trigger-action scripts inside the base. They fail in ways you will not notice
unless you look for them.

- **Silent failure.** A failed run does not stop the base or alert anyone by default. Check the
  run history regularly, and for anything that matters, have the automation write a timestamp
  field on success so an empty timestamp becomes a visible symptom.
- **Run limits.** Automation runs are metered per plan and the allowance changes; check current
  limits. A per-record-change trigger on a busy table burns an allowance far faster than a
  scheduled batch run doing the same work.
- **Self-triggering loops.** An automation triggered by "record updated" that itself updates a
  field in that record re-triggers itself. Prevent it structurally: trigger on "when record
  enters view" with a view condition that the action makes false, or trigger on a specific field
  change and write to a different field.
- **Ordering.** Two automations on the same trigger have no guaranteed order and no transaction.
  Do not split one logical update across two automations.
- **Timing.** Automations are asynchronous. A human can look at the record before the automation
  has run. Design the UI so an unprocessed state is legible, not just absent.

Test every automation on a duplicated base with the real data shapes, including the empty field,
the multi-link, and the record that was deleted mid-run.

## Permissions and what a share link really exposes

- Permissions exist at workspace, base, table, and field level depending on plan; workspace-level
  access cascades down, which is how people end up with edit rights they were never granted
  deliberately.
- A shared view link is public to anyone holding the URL. It is not authenticated. Treat the URL
  as the secret, and assume it will be forwarded.
- A read-only share still exposes the data in the fields visible in that view, including lookups
  that pull from tables the recipient cannot otherwise see. Hiding a field in the view is the
  only thing keeping it private; hidden-in-grid is not the same as hidden-in-share.
- Attachment URLs served by Airtable are accessible to whoever holds them; do not put anything
  confidential in attachments on a shared base without checking the current behaviour of those
  URLs.
- Before sharing, open the share link in a private window and read what is actually there.

## API basics and rate limits

- The REST API is per base, authenticated with a personal access token or OAuth, scoped to the
  bases and permissions you grant. Do not use a token with workspace-wide scope for a single
  integration.
- Reads are paginated with an offset token; always follow pagination rather than assuming one
  page is the whole table.
- Writes are batched (a small number of records per request). Build your client around batching
  from the start.
- There is a per-base request rate limit and exceeding it returns 429 with a cooldown. Check
  current limits, implement exponential backoff, and never build a workflow that requires
  sustained high-rate writes.
- Field names in the API are strings that change when a human renames a field. Use field IDs for
  anything durable, because a rename silently breaks a name-based integration.
- There is no transaction. A multi-table write that fails halfway leaves the base inconsistent,
  and you must write the compensating logic yourself.

## When Airtable is the wrong tool

Say this plainly to stakeholders rather than engineering around it:

- **Row counts in the hundreds of thousands or more.** Per-table record caps are plan-dependent
  and change; check current limits. Well before the hard cap, views with rollups become slow.
- **Real transactional integrity.** No transactions, no atomic multi-record writes, no
  constraints beyond field type. If a half-applied update corrupts money, inventory, or legal
  state, Airtable is not the store of record.
- **SQL joins across large tables.** Anything that in SQL is a three-table join with aggregation
  over large data has no efficient Airtable equivalent. Rollups over rollups are not a query
  planner.
- **Concurrent high-rate writes**, audit requirements needing an immutable log, or row-level
  security that must be enforced rather than presented.
- **Complex validation.** Airtable cannot enforce "end date after start date" or "only one active
  subscription per account" in the data layer.

When two or more of those are true, the answer is Postgres, and saying so early is cheaper than
saying it after the base is load-bearing. Airtable remains excellent for a collaborative
operational base under those thresholds, with humans as the main writers.

## The migration path out

Plan it before you need it.

1. Export every table to CSV, plus a full schema listing of field types and link fields.
2. Design the relational schema properly using `skills/engineering/database-design`: real keys,
   NOT NULL, foreign keys, check constraints.
3. Import the entity tables, keeping the Airtable record ID as an `airtable_id` column so links
   can be resolved.
4. Rebuild linked records as foreign keys or junction rows by joining on `airtable_id`, then keep
   that column for traceability rather than dropping it immediately.
5. Reimplement formulas as generated columns or view logic, and rollups as aggregate queries.
6. Reimplement automations as application code or scheduled jobs, with the error handling the
   automations never had.
7. Run both in parallel and reconcile counts and totals per table before the cutover.
8. Rebuild the human surface last. The interface, not the data, is what people will miss.

## See also

- `skills/engineering/database-design`: keys, constraints, indexing, migrations. The schema
  thinking this skill assumes and the target shape when you migrate out.
- `skills/data/sql-for-analysts`: what the joins and aggregations look like once the data is
  somewhere that can do them.
- `skills/engineering/api-integration`: retries, backoff, and idempotency for the Airtable API
  client you will end up writing.
- `skills/office/pivot-tables`: when the question is a one-off summary and does not need a base
  at all.
- `skills/data/python-pandas-analysis`: cleaning the CSV before import so the linked-record
  conversion does not mint duplicates.
