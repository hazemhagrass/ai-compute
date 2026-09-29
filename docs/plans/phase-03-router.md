# Phase 3: Router quality

The product is a ranking, and the ranking is built on scores that were assigned by hand. Everything here is about replacing plausible guesses with measurements.

Tickets are GitHub issues; this file is the checklist over them. **Do not edit the
tracker block by hand** — run `node scripts/sync-plans.mjs --write`, which reads
live issue state so a closed issue flips its own box.

## Overall progress

<!-- tracker:start -->

<!-- Generated from GitHub issues. Edit the issues, not these numbers. -->

**100% done**

`🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩`

🟩 **12 done** · 🟧 **0 in progress** · ⬜ **0 remaining** — 12 tickets

<!-- tracker:end -->

## Tickets

- [x] **[#13](https://github.com/hazemhagrass/ai-compute/issues/13) · Explain why a model was excluded, not just which ones ranked** `S` — rankModels silently drops anything failing a hard requirement. When a user constrains the search and gets two results, there is no way to tell whether the other twenty were expensive, incapa…
- [x] **[#16](https://github.com/hazemhagrass/ai-compute/issues/16) · Persist recommendations so a choice can be revisited** `S` — A recommendation exists only in React state. Reload the page and the reasoning is gone, which makes it impossible to ask "why did I pick this three weeks ago".
- [x] **[#12](https://github.com/hazemhagrass/ai-compute/issues/12) · Measure real latency and throughput instead of assuming a speed score** `M` — speed is a hand-assigned 0-100, but usage_events already records true latencyMs and tokensPerSec for every call. The data to replace the guess is sitting in the table unused.
- [x] **[#14](https://github.com/hazemhagrass/ai-compute/issues/14) · Let a task fall back to a second model when the first fails** `M` — The router names one model. In practice a provider 429s, a local box is asleep, or a model is deprecated, and the answer should be "use this, or that if it is down" rather than a dead end.
- [x] **[#15](https://github.com/hazemhagrass/ai-compute/issues/15) · Compare two models side by side on the same prompt** `M` — Deciding between two candidates currently means running one, switching the dropdown, running the other, and comparing from memory. The data model already supports this; only the UI is missin…
- [x] **[#11](https://github.com/hazemhagrass/ai-compute/issues/11) · Replace hand-written skill scores with a real evaluation harness** `L` — Every skill score in src/lib/seed.ts is a number I made up. They are plausible and internally consistent, which is exactly what makes them dangerous: the UI presents them with two significan…
- [x] **[#153](https://github.com/hazemhagrass/ai-compute/issues/153) · Model router: subscriptions and entitlements data model** `?` — Give the router a real model of what the user is actually entitled to use, so routing stops assuming every known model is reachable.
- [x] **[#154](https://github.com/hazemhagrass/ai-compute/issues/154) · Model router: rank only what the user can actually call** `?` — Make ranking respect what the user can actually call, and explain every exclusion.
- [x] **[#155](https://github.com/hazemhagrass/ai-compute/issues/155) · Model router: typed, user-editable routing policy** `?` — Replace the untyped settings bag with a routing policy the user owns and can edit.
- [x] **[#156](https://github.com/hazemhagrass/ai-compute/issues/156) · Model router: multi-key management with verification and rotation** `?` — Give the user a real key management surface, not a single field per provider.
- [x] **[#157](https://github.com/hazemhagrass/ai-compute/issues/157) · Model router: prefer local models when nothing else is reachable** `?` — Prefer local models when nothing is configured, so the app is useful on first run and never dead-ends.
- [x] **[#158](https://github.com/hazemhagrass/ai-compute/issues/158) · Model router: key, subscription and policy control surface** `?` — Give the user one screen where keys, subscriptions and routing policy are visible and editable, and where the router explains itself.

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/hazemhagrass/ai-compute/labels/phase-3-router)
