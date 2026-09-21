# Phase 4: Analytics

Analytics today is entirely retrospective: it reports what was spent after it was spent. This phase makes it predictive and reconcilable against a real invoice.

Tickets are GitHub issues; this file is the checklist over them. **Do not edit the
tracker block by hand** — run `node scripts/sync-plans.mjs --write`, which reads
live issue state so a closed issue flips its own box.

## Overall progress

<!-- tracker:start -->

<!-- Generated from GitHub issues. Edit the issues, not these numbers. -->

**100% done**

`🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩`

🟩 **5 done** · 🟧 **0 in progress** · ⬜ **0 remaining** — 5 tickets

<!-- tracker:end -->

## Tickets

- [x] **[#18](https://github.com/hazemhagrass/ai-compute/issues/18) · Export usage data as CSV and JSON** `S` — Usage data is trapped behind the analytics UI. Reconciling against a real provider invoice, or pivoting in a spreadsheet, needs the rows.
- [x] **[#17](https://github.com/hazemhagrass/ai-compute/issues/17) · Add budgets with alerts before the bill arrives** `M` — Analytics is entirely retrospective. It tells you what you spent after you spent it, which is the least useful moment to learn it.
- [x] **[#20](https://github.com/hazemhagrass/ai-compute/issues/20) · Price cached tokens separately from fresh input tokens** `M` — cached_tokens is recorded and then ignored by computeCost. Cache reads are roughly a tenth the price on Anthropic and OpenAI, so any workload reusing a large system prompt is being systemati…
- [x] **[#21](https://github.com/hazemhagrass/ai-compute/issues/21) · Show the true cost of a multi-turn conversation** `M` — Every call is logged independently, so the compounding cost of a long conversation (where the whole history is resent each turn) is invisible. That resend is the dominant cost in agentic use…
- [x] **[#19](https://github.com/hazemhagrass/ai-compute/issues/19) · Reconcile computed cost against real provider invoices** `L` — Cost is computed from stored per-1M prices, so it is an estimate that drifts from reality: cache discounts, batch pricing, tiered rates, and free-tier credits are all invisible to it.

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/hazemhagrass/ai-compute/labels/phase-4-analytics)
