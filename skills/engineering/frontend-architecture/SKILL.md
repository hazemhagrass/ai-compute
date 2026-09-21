---
name: frontend-architecture
description: "Use when structuring a React or Next.js frontend. Enforces server-first composition, seeded data, local state, and per-region loading and error boundaries."
---

# Frontend Architecture

Rules for React and Next.js App Router work. Each one is a decision made while writing the component, not a cleanup pass afterwards.

## Component Boundaries

- **Default to a server component; add `"use client"` only where interactivity genuinely requires it** (event handlers, browser APIs, stateful widgets). Every `"use client"` file, and everything it imports, is bundle weight shipped to every visitor whether or not they ever click the thing.
- **Push the client boundary down to the smallest interactive leaf.** Marking a page client drags its whole subtree along; marking one button client keeps the page on the server.

```tsx
// BAD: whole page becomes client because one button needs onClick
"use client";
export default function InvoicePage({ invoice }: { invoice: Invoice }) {
  return (
    <article>
      <InvoiceLineItems items={invoice.items} />
      <button onClick={() => window.print()}>Print</button>
    </article>
  );
}

// GOOD: server page, one tiny client leaf
export default function InvoicePage({ invoice }: { invoice: Invoice }) {
  return (
    <article>
      <InvoiceLineItems items={invoice.items} />
      <PrintButton />
    </article>
  );
}

// print-button.tsx
("use client");
export function PrintButton() {
  return <button onClick={() => window.print()}>Print</button>;
}
```

## Data Loading

- **Fetch on the server and pass the result down as seeded props; never fetch on mount just to get initial data.** A mount fetch costs an extra round trip after hydration, renders a spinner the user did not need, and trips the React compiler's rules about effects that write state.
- **Refetch only in response to a real user action** (filter change, pagination, explicit refresh), seeded from the server payload so the first paint is already correct.

```tsx
// BAD: client component fetching its own initial data on mount
"use client";
export function OrderList() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    fetch("/api/orders").then((r) => r.json()).then(setOrders);
  }, []);
  if (!orders) return <Spinner />;
  return <OrderTable orders={orders} />;
}

// GOOD: server fetches, client seeds, refetch is user driven
// app/orders/page.tsx (server component)
export default async function OrdersPage() {
  const orders = await getOrders({ status: "open" });
  return <OrderList initialOrders={orders} />;
}

// order-list.tsx
("use client");
export function OrderList({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  async function handleStatusChange(next: Status) {
    setOrders(await fetchOrders({ status: next })); // user action, not mount
  }
  return (
    <>
      <StatusFilter onChange={handleStatusChange} />
      <OrderTable orders={orders} />
    </>
  );
}
```

## State Placement

- **Colocate state with the component that owns it, and hoist it only when a second component genuinely reads or writes it.** Premature hoisting turns every local keystroke into a re-render of the whole page subtree.
- **If two siblings need the same value, lift it exactly one level, to their nearest common parent, not into a global store.** Global stores make ownership unreadable and widen the re-render blast radius.
- **Derive state, never mirror it.** A `useState` initialised from a prop desynchronises the moment that prop changes, because the initialiser runs once.

```tsx
// BAD: mirrored prop plus an effect to patch the desync
function Search({ query }: { query: string }) {
  const [value, setValue] = useState(query);
  useEffect(() => setValue(query), [query]); // band-aid over a design bug
  const results = useMemo(() => filter(value), [value]);
  return <ResultList results={results} />;
}

// GOOD: derive during render, one source of truth
function Search({ query }: { query: string }) {
  const results = filter(query); // computed, not stored
  return <ResultList results={results} />;
}
```

## Lists

- **Key by a stable domain id, never by array index.** On reorder, insert, or delete, index keys make React reuse the wrong DOM node, so focus, scroll position, and uncontrolled input values land on the wrong row.

```tsx
// BAD
{rows.map((row, i) => <Row key={i} row={row} />)}

// GOOD
{rows.map((row) => <Row key={row.id} row={row} />)}
```

- **Add pagination or virtualisation while the list is still small.** Retrofitting either one is a rewrite: it changes the data contract (cursor, page size), the scroll container, the empty and loading states, and every test around them.
- **Pick one deliberately:** server pagination for unbounded server data, virtualisation (for example `@tanstack/react-virtual`) for long client-held lists that must scroll as one surface.

## Loading States

- **Put a Suspense boundary and its own skeleton around each independent region.** One page-level spinner blanks content the user was already reading and delays everything behind the slowest query.
- **Shape the skeleton like the content it replaces** (same rows, same heights) so layout does not jump when data lands.

```tsx
// BAD: the whole page waits on the slowest section
export default async function Dashboard() {
  const [stats, feed] = await Promise.all([getStats(), getFeed()]);
  return <><Stats data={stats} /><Feed data={feed} /></>;
}

// GOOD: each region streams in behind its own boundary
export default function Dashboard() {
  return (
    <>
      <Suspense fallback={<StatsSkeleton />}><Stats /></Suspense>
      <Suspense fallback={<FeedSkeleton />}><Feed /></Suspense>
    </>
  );
}
```

## Effects

- **Use an effect only to synchronise with something outside React** (subscriptions, timers, event listeners, imperative DOM or third party widgets), and always return its cleanup. Anything computable during render does not belong in an effect: an effect adds a second render pass plus a window where the UI shows stale values.

```tsx
// BAD: effect computing state that render could compute
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// GOOD
const fullName = `${first} ${last}`;

// GOOD effect: genuinely external, with cleanup
useEffect(() => {
  const socket = openSocket(roomId);
  socket.on("message", onMessage);
  return () => socket.close();
}, [roomId, onMessage]);
```

## Server Actions

- **Put the `"use server"` boundary in a dedicated actions module, not inline in shared components,** so every privileged entry point sits in one auditable place.
- **Treat every argument that crossed the boundary as hostile input: authenticate, validate the shape, then authorise before touching data.** A server action is a public HTTP endpoint; hidden form fields, ids, and roles sent by the client prove nothing.
- **Return a typed result object instead of throwing raw errors across the boundary,** because thrown server errors reach production clients as an opaque digest the UI cannot act on.

```tsx
// BAD: trusts client supplied identity and shape
"use server";
export async function updateInvoice(input: { id: string; userId: string; total: number }) {
  return db.invoice.update({ where: { id: input.id }, data: { total: input.total } });
}

// GOOD: session is the identity, schema is the shape, ownership is checked
"use server";
const UpdateInvoice = z.object({ id: z.string().uuid(), total: z.number().positive() });

export async function updateInvoice(raw: unknown): Promise<ActionResult> {
  const session = await requireSession();         // authenticate
  const parsed = UpdateInvoice.safeParse(raw);    // validate
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { id, total } = parsed.data;
  if (!(await ownsInvoice(session.userId, id))) return { ok: false, error: "FORBIDDEN" };
  await db.invoice.update({ where: { id }, data: { total } });
  revalidatePath("/invoices");
  return { ok: true };
}
```

## Error Boundaries

- **Wrap each independently failable region in an error boundary that offers a real recovery path** (retry, reset, navigate away), never a blank screen or a bare "something went wrong".
- **Scope the boundary to the region, not the app,** so one failing widget does not destroy a form the user has half filled in.

```tsx
// app/dashboard/error.tsx
"use client";
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert">
      <h2>We could not load your dashboard.</h2>
      <p>{friendlyMessage(error)}</p>
      <button onClick={reset}>Try again</button>
      <Link href="/support">Contact support</Link>
    </section>
  );
}
```

## Quick Checklist

- Is this component client only because it truly needs interactivity?
- Does any component fetch its own initial data on mount? Seed it from the server instead.
- Does any `useState` duplicate a prop or something derivable during render?
- Does every list key come from a stable id, and is paging or virtualisation already in place?
- Does each slow region have its own Suspense fallback and its own error boundary with a retry?
- Does every server action authenticate, validate, and authorise its arguments?
