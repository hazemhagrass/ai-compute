# Phase 2: Security

The app stores API keys and an unbounded archive of every prompt ever sent. It currently has no authentication of any kind, which makes this the phase that blocks every deployment that is not localhost.

Tickets are GitHub issues; this file is the checklist over them. **Do not edit the
tracker block by hand** — run `node scripts/sync-plans.mjs --write`, which reads
live issue state so a closed issue flips its own box.

## Overall progress

<!-- tracker:start -->

<!-- Generated from GitHub issues. Edit the issues, not these numbers. -->

**0% done**

`⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜`

🟩 **0 done** · 🟧 **0 in progress** · ⬜ **5 remaining** — 5 tickets

<!-- tracker:end -->

## Tickets

- [ ] **[#9](https://github.com/hazemhagrass/ai-compute/issues/9) · Redact secrets from error messages returned to the browser** `S` — testConnection and chat return text.slice(0, 600) from a failed upstream response straight to the client. Several providers echo the submitted Authorization header or key fragment in their 4…
- [ ] **[#7](https://github.com/hazemhagrass/ai-compute/issues/7) · Stop logging full prompts and responses without a retention policy** `M` — Every prompt and response is stored in full, forever, in plaintext in SQLite. That is the feature, but it is also an unbounded, unencrypted archive of everything you have ever asked a model,…
- [ ] **[#8](https://github.com/hazemhagrass/ai-compute/issues/8) · Harden provider URLs against SSRF** `M` — A provider base URL is user-supplied and the server fetches it. Once auth exists this is low severity, but before that it is an open proxy: http://169.254.169.254/ reaches cloud instance met…
- [ ] **[#10](https://github.com/hazemhagrass/ai-compute/issues/10) · Rotate the encryption key without losing stored secrets** `M` — The AES master key is generated once into data/.secret and never rotates. There is no path to change it, and if it leaks, every stored provider key must be re-entered by hand.
- [ ] **[#6](https://github.com/hazemhagrass/ai-compute/issues/6) · Add authentication — the app is currently wide open** `L` — - Single-user password login is enough for v1; this is a personal tool, not a SaaS. Do not build multi-tenancy yet.

---

[All plans](./README.md) · [Open issues for this phase](https://github.com/hazemhagrass/ai-compute/labels/phase-2-security)
