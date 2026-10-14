# MVVM in ai-model-router

This app uses a three-layer MVVM architecture. The rule that makes it work:

> **A View never fetches, never transforms, never decides. A ViewModel never
> renders. A rules module never imports React or `fetch`.**

Read `src/components/RouterPanel.tsx` + `use-router-view-model.ts` +
`router.rules.ts` as the reference implementation before converting anything.

## The three layers

```
View (Panel.tsx)          ViewModel (use-<feature>-view-model.ts)      Model
 renders only        ──>   state + actions + side effects        ──>   src/lib/*,
 zero logic                precomputed `view` object                   /api routes
       ^                        ^                                      ^
       └── props/state ─────────┘                          node-testable pure rules:
                                                           <feature>.rules.ts
```

| Layer | File | Allowed | Forbidden |
|---|---|---|---|
| **View** | `<Feature>Panel.tsx` | JSX, props, calling VM actions | `fetch`, business rules, data transforms, `useState` for domain data |
| **ViewModel** | `use-<feature>-view-model.ts` | `useState`/`useMemo`/`useCallback`, `api()` calls, toast/refresh orchestration | JSX, direct DOM |
| **Rules** | `<feature>.rules.ts` | pure functions, types, constants | React, `fetch`, side effects |
| **Model** | `src/lib/*`, `src/app/api/*` | domain logic, persistence, HTTP handlers | anything UI |

## Converting a panel (checklist)

1. **Extract rules first.** Skim the panel for pure derivations (formatting,
   validation, filtering, body-building) and move them into
   `<feature>.rules.ts`. They must take plain data and return plain data.
2. **Create the ViewModel** `use-<feature>-view-model.ts`:
   - Move every `useState`/`useEffect`/`useCallback` there.
   - Wrap `fetch` in the shared `api()` helper and expose async **actions**
     (`run`, `save`, `remove`), never raw setters for domain data.
   - Return `{ view, ...actions }` where `view` is a single `useMemo` object
     holding everything the View renders (flags, titles, formatted values).
3. **Gut the panel.** The Panel keeps at most local *presentation* state
   (currently-open accordion, hover). Everything else becomes
   `const { view, ...actions } = use<Feature>ViewModel(props)`.
4. **Test the rules** in `<feature>.rules.test.ts` (node, no React) and
   optionally the ViewModel with a `renderHook` if it earns its cost.

## Example: one action, sliced through the layers

```ts
// router.rules.ts                        (pure, node-testable)
export function buildRecommendationBody(draft: RouterDraft): BuildBodyResult {
  if (draft.mode === "preset" && !draft.taskId)
    return { ok: false, error: "Pick a task first" };
  return { ok: true, body: { taskId: draft.taskId, limit: 8 } };
}
```

```ts
// use-router-view-model.ts               (stateful side effects)
const run = useCallback(async () => {
  const built = buildRecommendationBody(draft);          // rules call
  if (!built.ok) return onToast(built.error, "bad");     // effect orchestration
  const res = await api<...>("/api/recommend", { method: "POST", json: built.body });
  setRec(res.recommendation);                            // state update
  onRefresh();                                           // cross-panel signal
}, [draft, onToast, onRefresh]);
```

```tsx
// RouterPanel.tsx                        (render only)
<button onClick={vm.run} disabled={vm.view.busy}>
  {vm.view.busy ? "Routing…" : "Recommend a model"}
</button>
```

## Rules of engagement across panels

- Panels share data through **props from AppShell** (catalog, tasks, toast,
  refresh). A ViewModel may call `onToast`/`onRefresh`, but never reach into
  another panel's state.
- Server state mutations that validate/scoped-check belong in `/api` routes
  (Model layer), never duplicated client-side.
- The Model layer (`src/lib/*`) knows nothing about React; `/api` routes are
  the only place that imports it from the outside, and each ViewModel talks
  to `/api` exclusively through `src/components/store.ts`: `api()` for plain
  JSON, `apiWithMeta()` when the flow needs the `Response` (status branches
  with `throwOnError: false`, headers like `X-Budget-Warning`, or a streaming
  body with `raw: true`).

## Enforcement

- `pnpm lint` fails on layer violations: importing React or Next in a
  `*.rules.ts` file, touching `window`/`document` in one, or calling `fetch`
  inside a View. The guards live in `eslint.config.mjs`; fix the code, do not
  loosen the guard.

## What is deliberately NOT MVVM here

- `src/app/page.tsx`, `layout.tsx` and `/api` routes are the **Model**
  delivery/edge layer, not Views: server components may fetch and shape data
  (that is their Model-side job) as long as no client View does.
- `ui.tsx` primitives (Card, Button, …) are presentational components without
  ViewModels: a component that renders whatever it is handed and owns no
  domain state needs no ViewModel.
