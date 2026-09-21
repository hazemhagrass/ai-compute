# Phase 6: Release

Making the thing installable and survivable by someone who is not the author, including the case where the author's disk dies.

Tickets are GitHub issues; this file is the checklist over them. **Do not edit the
tracker block by hand** — run `node scripts/sync-plans.mjs --write`, which reads
live issue state so a closed issue flips its own box.

## Overall progress

<!-- tracker:start -->

<!-- Generated from GitHub issues. Edit the issues, not these numbers. -->

**20% done**

`🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜`

🟩 **1 done** · 🟧 **0 in progress** · ⬜ **4 remaining** — 5 tickets

<!-- tracker:end -->

## Tickets

- [ ] **[#29](https://github.com/hazemhagrass/ai-compute/issues/29) · Import a config export back into a fresh instance** `S` — GET /api/export produces a config backup that nothing can consume. Export without import is a false sense of safety.
- [ ] **[#30](https://github.com/hazemhagrass/ai-compute/issues/30) · Write the deployment and operations guide** `S` — The README covers what the app is and how to run it locally. Nothing covers running it somewhere real.
- [ ] **[#31](https://github.com/hazemhagrass/ai-compute/issues/31) · Add a repo-level agent quickstart for the router app** `S` — The root CLAUDE.md covers repo conventions. An agent sent to work on the router app itself has to rediscover the architecture every session.
- [x] **[#27](https://github.com/hazemhagrass/ai-compute/issues/27) · Ship a Dockerfile and compose file** `M` — Deployment today is pnpm build && pnpm start on a machine with the right Node version. That is fine for localhost and nothing else.
- [ ] **[#28](https://github.com/hazemhagrass/ai-compute/issues/28) · Back up and restore the database and encryption key** `M` — There is no backup story. The SQLite file holds every provider key and the entire prompt archive, and .secret is the only thing that can decrypt the keys.

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/hazemhagrass/ai-compute/labels/phase-6-release)
