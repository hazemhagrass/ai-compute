# Phase 5: Providers

The client speaks two request shapes and waits for the full response. Streaming is the single biggest perceived-quality gap, and the features flags already advertise it.

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

- [x] **[#25](https://github.com/hazemhagrass/ai-compute/issues/25) · Validate that a model id actually exists on its provider** `S` — A model id is free text. A typo surfaces as a 404 from the provider at call time, buried in a raw error string, long after the mistake was made.
- [x] **[#26](https://github.com/hazemhagrass/ai-compute/issues/26) · Test every provider connection at once with a health dashboard** `S` — Connections are tested one provider at a time by hand. With seventeen configured, finding the broken one is tedious enough that it will not be done.
- [x] **[#23](https://github.com/hazemhagrass/ai-compute/issues/23) · Support multi-turn conversations, not just single prompts** `M` — chat() takes one system and one user string. Testing a model on anything conversational, or on how it handles a long context, is impossible.
- [x] **[#24](https://github.com/hazemhagrass/ai-compute/issues/24) · Add native Gemini and Bedrock request shapes** `M` — The client speaks OpenAI-compatible and Anthropic Messages. Gemini is reachable through its OpenAI compatibility layer, which works but silently drops native features (system instructions, s…
- [x] **[#22](https://github.com/hazemhagrass/ai-compute/issues/22) · Stream responses instead of blocking until the last token** `L` — The playground waits for the full response. A 40-second generation looks identical to a hang, which is the single biggest perceived-quality gap in the app.

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/hazemhagrass/ai-compute/labels/phase-5-providers)
