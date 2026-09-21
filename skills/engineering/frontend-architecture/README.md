# Frontend Architecture

A rule set for React and Next.js App Router code that decides component boundaries, data loading, state placement, and failure handling at the moment you write the component.

## What it does

The skill encodes seven decisions that are cheap to make while typing and expensive to retrofit:

| Area | Rule |
| --- | --- |
| Component boundaries | Server component by default; `"use client"` only on the smallest interactive leaf |
| Data loading | Fetch on the server, pass the result down as seeded props, refetch only on user action |
| State placement | Colocate state, lift exactly one level when shared, derive instead of mirror |
| Lists | Key by stable domain id; add paging or virtualisation before the list grows |
| Loading states | One Suspense boundary plus a content-shaped skeleton per independent region |
| Effects | Effects only synchronise with things outside React, and always clean up |
| Server actions and errors | Dedicated `"use server"` module, authenticate + validate + authorise, typed results, per-region error boundary with a retry |

Each rule in `SKILL.md` comes with a paired BAD / GOOD snippet, so the skill doubles as a review checklist and as a template you can copy from.

## When to use this

Load it when any of these is true:

- You are creating a new route, page, or feature directory in a Next.js App Router app.
- You are about to type `"use client"` and are not sure how high in the tree it belongs.
- A component has `useEffect` + `fetch` + `useState(null)` to get its first render of data.
- A `useState` is initialised from a prop, and there is an effect keeping the two in sync.
- A page shows a single full-page spinner while several independent queries resolve.
- A list renders with `key={i}` or renders every row with no paging.
- You are adding or reviewing a server action that takes an id, a role, or a user id from the client.
- You are reviewing a PR and want a concrete rule to cite instead of a style opinion.

Do not reach for it for CSS, design-system, or build-tooling questions. It is about component and data structure only.

## Quick start

Say you are asked to add an orders dashboard: a filterable order list plus a slow stats panel.

1. Read the rules, then keep the checklist at the bottom open while you work.

```bash
cd ai-computer/skills/engineering/frontend-architecture
sed -n '220,227p' SKILL.md   # the Quick Checklist
```

2. Start server-first. The page fetches, and each slow region gets its own boundary.

```tsx
// app/orders/page.tsx  (server component, no "use client")
import { Suspense } from "react";

export default function OrdersPage() {
  return (
    <>
      <Suspense fallback={<StatsSkeleton />}>
        <OrderStats />
      </Suspense>
      <Suspense fallback={<OrderTableSkeleton rows={10} />}>
        <OrdersSection />
      </Suspense>
    </>
  );
}

async function OrdersSection() {
  const orders = await getOrders({ status: "open", limit: 50 });
  return <OrderList initialOrders={orders} />;
}
```

3. Put the client boundary on the interactive leaf only, and seed it.

```tsx
// app/orders/order-list.tsx
"use client";
import { useState } from "react";

export function OrderList({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders); // seeded, not fetched on mount

  async function handleStatusChange(status: Status) {
    setOrders(await fetchOrders({ status })); // user action drives the refetch
  }

  return (
    <>
      <StatusFilter onChange={handleStatusChange} />
      <ul>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} /> // stable domain id
        ))}
      </ul>
    </>
  );
}
```

4. Keep the privileged code in one auditable module.

```tsx
// app/orders/actions.ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const CancelOrder = z.object({ id: z.string().uuid() });

export async function cancelOrder(raw: unknown): Promise<ActionResult> {
  const session = await requireSession();                 // authenticate
  const parsed = CancelOrder.safeParse(raw);              // validate
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  if (!(await ownsOrder(session.userId, parsed.data.id))) // authorise
    return { ok: false, error: "FORBIDDEN" };

  await db.order.update({ where: { id: parsed.data.id }, data: { status: "cancelled" } });
  revalidatePath("/orders");
  return { ok: true };
}
```

5. Give the region a recovery path, not a blank screen.

```tsx
// app/orders/error.tsx
"use client";
export default function OrdersError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert">
      <h2>We could not load your orders.</h2>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
```

6. Verify the boundary did not creep upward. Every `"use client"` file plus its imports ship to the browser, so count them:

```bash
grep -rl '"use client"' app/orders
npx next build   # then check the First Load JS column for /orders
```

## Key concepts

**Client boundary weight.** `"use client"` is not a per-component flag, it is a cut in the module graph. Everything the file imports, transitively, becomes browser bundle weight for every visitor, whether or not they interact. Pushing the directive down one level from a page to a button can remove an entire subtree from the bundle.

**Seeded state.** The server already has the data when it renders. Passing it as `initialOrders` and calling `useState(initialOrders)` means first paint is correct with no spinner and no post-hydration round trip. The client store then exists only to hold *subsequent* user-driven results.

**Derive, do not mirror.** `useState(props.x)` runs its initialiser exactly once. The moment `props.x` changes, the two values disagree, and the usual patch is an effect that calls `setState`, which costs a second render pass and a window of visibly stale UI. If a value is computable during render, compute it during render.

**Per-region boundaries.** Suspense and error boundaries are scoped tools. One boundary per independent region means the slowest query delays only its own section, and one failing widget does not discard a half-filled form elsewhere on the page. A page-level boundary collapses all of that into all-or-nothing.

**Server actions are public endpoints.** A `"use server"` export compiles to a callable HTTP endpoint. Hidden form fields, ids, and role flags are attacker-controlled strings. Identity comes from the session, shape comes from a schema, permission comes from an ownership query, in that order.

**Structural decisions have a retrofit cost.** Paging, virtualisation, and boundary placement change the data contract, the scroll container, and every test around them. That is why these are write-time decisions rather than cleanup-pass decisions.

## Common pitfalls

**Marking the page client for one handler**

```tsx
// BAD: the whole subtree ships to the browser
"use client";
export default function InvoicePage({ invoice }) {
  return <><InvoiceLineItems items={invoice.items} /><button onClick={() => window.print()}>Print</button></>;
}

// GOOD: server page, tiny client leaf
export default function InvoicePage({ invoice }) {
  return <><InvoiceLineItems items={invoice.items} /><PrintButton /></>;
}
```

**Fetching initial data on mount**

```tsx
// BAD: extra round trip after hydration, plus an avoidable spinner
useEffect(() => { fetch("/api/orders").then((r) => r.json()).then(setOrders); }, []);

// GOOD: server fetches, client seeds
const [orders, setOrders] = useState(initialOrders);
```

**Mirroring a prop into state**

```tsx
// BAD: desyncs, then gets patched with an effect
const [value, setValue] = useState(query);
useEffect(() => setValue(query), [query]);

// GOOD
const results = filter(query);
```

**Index keys**

```tsx
// BAD: on reorder or delete React reuses the wrong DOM node, so focus and inputs land on the wrong row
{rows.map((row, i) => <Row key={i} row={row} />)}

// GOOD
{rows.map((row) => <Row key={row.id} row={row} />)}
```

**One spinner for the whole page**

```tsx
// BAD: everything waits on the slowest query
const [stats, feed] = await Promise.all([getStats(), getFeed()]);

// GOOD: each region streams behind its own skeleton
<Suspense fallback={<StatsSkeleton />}><Stats /></Suspense>
<Suspense fallback={<FeedSkeleton />}><Feed /></Suspense>
```

**Effects computing derivable values**

```tsx
// BAD: second render pass, stale frame in between
useEffect(() => { setFullName(`${first} ${last}`); }, [first, last]);

// GOOD
const fullName = `${first} ${last}`;
```

**Trusting the client's identity in a server action**

```tsx
// BAD: userId came from the browser, so it proves nothing
export async function updateInvoice(input: { id: string; userId: string; total: number }) {
  return db.invoice.update({ where: { id: input.id }, data: { total: input.total } });
}

// GOOD: session authenticates, schema validates, ownership check authorises
const session = await requireSession();
const parsed = UpdateInvoice.safeParse(raw);
if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
if (!(await ownsInvoice(session.userId, parsed.data.id))) return { ok: false, error: "FORBIDDEN" };
```

**Throwing raw errors across the boundary**

```tsx
// BAD: production clients receive an opaque digest the UI cannot act on
throw new Error("invoice total must be positive");

// GOOD: typed result the form can render inline
return { ok: false, error: "INVALID_INPUT" };
```

## See also

- `SKILL.md` in this directory, for the full rules and every paired example.
- `../api-design/SKILL.md` and `../api-integration/SKILL.md`, for the contracts the server components and actions call into.
- `../security-audit/SKILL.md`, for the authenticate / validate / authorise sequence applied beyond server actions.
- `../performance-profiling/SKILL.md`, for measuring bundle size and render cost once the structure is in place.
- `../code-review/SKILL.md` and `../test-strategy/SKILL.md`, for using the Quick Checklist as review and test criteria.
