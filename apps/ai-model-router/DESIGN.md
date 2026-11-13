---
version: alpha
name: AI Model Router
description: Dark-only operator console for AI providers, keys, routing, prompt logs and cost analytics (ai-compute, apps/ai-model-router).
colors:
  # Source: src/app/globals.css :root. Token names equal the CSS variable names (var(--<name>)).
  bg: "#07080c"
  bg-soft: "#0c0e14"
  panel: "#10131b"
  panel-2: "#151925"
  border: "#212738"
  border-soft: "#1a1f2e"
  fg: "#e8ecf5"
  fg-muted: "#8b94ad"
  fg-dim: "#5c657d"
  accent: "#6c8cff"
  accent-2: "#a56cff"
  good: "#3ddc97"
  warn: "#ffb45c"
  bad: "#ff6b7e"
  chart-1: "#6c8cff"
  chart-2: "#a56cff"
  chart-3: "#3ddc97"
  chart-4: "#ffb45c"
  chart-5: "#ff6b7e"
  chart-6: "#4fd6e8"
  chart-7: "#ffd76c"
  chart-8: "#ff8ac4"
typography:
  # Families: Geist (--font-geist-sans) and Geist Mono (--font-geist-mono), loaded with next/font/google in src/app/layout.tsx.
  # Keys are the Tailwind classes used in code. Sizes and line heights are Tailwind v4 defaults.
  text-2xl:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 2rem
    letterSpacing: "-0.025em"
  text-xl:
    fontFamily: Geist
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.75rem
  text-lg:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.75rem
  text-sm:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.25rem
  text-sm-semibold:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.25rem
    letterSpacing: "-0.025em"
  text-xs:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1rem
  text-11px:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Geist
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0.05em
  text-10px:
    fontFamily: Geist
    fontSize: 10px
    fontWeight: 400
    lineHeight: 1.5
  text-9px:
    fontFamily: Geist
    fontSize: 9px
    fontWeight: 600
    lineHeight: 1.5
  mono-stat:
    fontFamily: Geist Mono
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.75rem
    fontFeature: "\"tnum\""
  mono-xs:
    fontFamily: Geist Mono
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1rem
    fontFeature: "\"tnum\""
  mono-11px:
    fontFamily: Geist Mono
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  # Tailwind v4 default radius scale, as used in components.
  sm: 0.25rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  2xl: 1rem
  full: 9999px
spacing:
  # Tailwind v4 default 0.25rem step. Keys are the class suffix (p-2, gap-3, px-4).
  "0.5": 2px
  "1": 4px
  "1.5": 6px
  "2": 8px
  "2.5": 10px
  "3": 12px
  "3.5": 14px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  container-max: 100rem
components:
  # textColor "#06070c" is a raw literal in code (33 uses), not yet a token. See Known mismatches M1.
  app-background:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.2xl}"
    padding: 20px
  card-header-subtitle:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-dim}"
    typography: "{typography.text-xs}"
  stat:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg}"
    typography: "{typography.mono-stat}"
    rounded: "{rounded.xl}"
    padding: 12px 16px
  stat-label:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg-dim}"
    typography: "{typography.label-caps}"
  stat-sub:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg-muted}"
    typography: "{typography.text-11px}"
  empty:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-dim}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.xl}"
    padding: 32px 24px
  nav-bar:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.xl}"
    padding: 6px
  nav-tab:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.lg}"
    padding: 10px 16px
  nav-tab-hover:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg}"
  nav-tab-hint:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-dim}"
    typography: "{typography.text-10px}"
  nav-tab-active:
    backgroundColor: "{colors.accent}"
    textColor: "#06070c"
    typography: "{typography.text-sm}"
    rounded: "{rounded.lg}"
    padding: 10px 16px
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#06070c"
    typography: "{typography.text-sm-semibold}"
    rounded: "{rounded.xl}"
    padding: 10px 20px
  button-primary-sm:
    backgroundColor: "{colors.accent}"
    textColor: "#06070c"
    typography: "{typography.text-xs}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
  button-primary-gradient:
    backgroundColor: "{colors.accent}"
    textColor: "#06070c"
    typography: "{typography.text-sm-semibold}"
    rounded: "{rounded.xl}"
    padding: 12px 16px
  button-primary-gradient-end:
    backgroundColor: "{colors.accent-2}"
    textColor: "#06070c"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.xl}"
    padding: 10px 20px
  button-secondary-hover:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg}"
  button-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bad}"
    typography: "{typography.text-xs}"
    rounded: "{rounded.lg}"
    padding: 6px 12px
  input:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.fg}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  input-toolbar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.xl}"
    padding: 10px 16px
  input-placeholder:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-dim}"
  table-header:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-dim}"
    typography: "{typography.text-xs}"
  table-cell-numeric:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg-muted}"
    typography: "{typography.mono-xs}"
  badge-warn:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.warn}"
    typography: "{typography.text-10px}"
    rounded: "{rounded.full}"
    padding: 2px 8px
  notification-count:
    backgroundColor: "{colors.bad}"
    textColor: "#ffffff"
    typography: "{typography.text-9px}"
    rounded: "{rounded.full}"
  alert-error:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bad}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.xl}"
    padding: 12px 16px
  toast:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.text-sm}"
    rounded: "{rounded.xl}"
    padding: 12px 16px
  toast-good:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.good}"
  toast-bad:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bad}"
  dialog:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    rounded: "{rounded.2xl}"
  progress-track:
    backgroundColor: "{colors.panel-2}"
    rounded: "{rounded.full}"
    height: 8px
  chart-accent-series:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.accent}"
  chart-secondary-series:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.good}"
  chart-palette-text:
    backgroundColor: "{colors.bg-soft}"
    textColor: "{colors.chart-6}"
  chart-palette-7:
    backgroundColor: "{colors.bg-soft}"
    textColor: "{colors.chart-7}"
  chart-palette-8:
    backgroundColor: "{colors.bg-soft}"
    textColor: "{colors.chart-8}"
  chart-palette-1-5:
    backgroundColor: "{colors.border-soft}"
    textColor: "{colors.chart-1}"
  chart-palette-2:
    backgroundColor: "{colors.border-soft}"
    textColor: "{colors.chart-2}"
  chart-palette-3:
    backgroundColor: "{colors.border-soft}"
    textColor: "{colors.chart-3}"
  chart-palette-4:
    backgroundColor: "{colors.border-soft}"
    textColor: "{colors.chart-4}"
  chart-palette-5:
    backgroundColor: "{colors.border}"
    textColor: "{colors.chart-5}"
---

# AI Model Router design system

## Overview

AI Model Router (repo `ai-computer`, app `apps/ai-model-router`, project ai-compute) is a single-operator admin console: one page for every AI provider, key and endpoint, a router that recommends a model per task, prompt logs and cost analytics. The user is a technical owner who reads dense tables, ids and dollar figures, so the tone is quiet, dark, data-first: near-black surfaces, one blue accent with a violet partner, monospaced numbers.

Stack: Next.js 16.4, React 19.3, Tailwind CSS v4 (`@tailwindcss/postcss`), no component library. Token source files:

- `src/app/globals.css`: the `:root` CSS variables (the only colour source), the `@theme inline` Tailwind mapping, body gradients, scrollbar, keyframes.
- `src/app/layout.tsx`: font loading (`next/font/google`), `<html lang="en">`.
- `src/components/ui.tsx`: shared primitives and `CHART_COLORS`.

Theme: dark only. There is no light theme, no theme toggle and no `.dark` class. `color-scheme: dark` is set on `input, textarea, select`. Because the app has one theme, this file uses plain token names; if a light theme is ever added, add sibling `-light` tokens and a Light theme subsection (the Beinno convention is a suffix on the non-default theme).

This file describes the code as it is on `main` at `7ab47bc` (2026-10-16). Gaps between the code and the rules below are listed under Known mismatches; they are not fixed by this document.

## Colors

All colours are CSS variables in `src/app/globals.css :root`. Components reference them as Tailwind arbitrary values, for example `bg-[var(--panel)]`, `text-[var(--fg-dim)]`, `border-[var(--border)]`, often with an opacity modifier (`bg-[var(--panel)]/80`, `bg-[var(--bad)]/10`, `border-[var(--bad)]/40`). This is the house pattern: about 600 uses.

`@theme inline` also maps Tailwind colour names: `bg` to `--bg`, `panel` to `--panel`, `panel2` to `--panel-2`, `line` to `--border`, `fg`, `muted` to `--fg-muted`, `dim` to `--fg-dim`, `accent`, `accent2` to `--accent-2`, `good`, `warn`, `bad`. These generate classes such as `bg-panel` or `text-dim`, but no component uses them today (0 uses). Note the names differ: the CSS variable is `--accent-2`, the Tailwind colour is `accent2`. There is no CSS variable `--accent2`.

Surfaces
- **bg (#07080c)** `--bg`: page background on `html, body`; also the scrollbar thumb border.
- **bg-soft (#0c0e14)** `--bg-soft`: defined, currently unused in components.
- **panel (#10131b)** `--panel`: cards (at 80% with `backdrop-blur-sm`), nav bar (60%), toolbar inputs (70%), dialogs, toasts, menus.
- **panel-2 (#151925)** `--panel-2`: nested surfaces: stats, form inputs (60%), hover fill for tabs and secondary buttons, chart tracks, tooltips.

Lines
- **border (#212738)** `--border`: default border colour (`* { border-color: var(--border) }`), card and input borders, scrollbar thumb.
- **border-soft (#1a1f2e)** `--border-soft`: dividers inside cards (card header rule), stat borders, chart grid lines.
- Scrollbar thumb hover uses the raw value `#2d364d` (not a token, see M3).

Text
- **fg (#e8ecf5)** `--fg`: primary text and numbers.
- **fg-muted (#8b94ad)** `--fg-muted`: secondary text, numeric columns, stat sub-lines, header tagline.
- **fg-dim (#5c657d)** `--fg-dim`: tertiary text: card subtitles, caps labels, table headers, placeholders, axis labels, empty states. Fails AA for body text (see Accessibility).

Accent and status
- **accent (#6c8cff)** `--accent`: the single interaction colour: active tab, primary buttons, focus border, range inputs (`accent-color`), the main chart series.
- **accent-2 (#a56cff)** `--accent-2`: only as the end stop of the accent gradient (`from-[var(--accent)] to-[var(--accent-2)]`) on the wordmark, the two gradient CTAs and the router progress bar.
- **good (#3ddc97)** `--good`: success, healthy, second chart series.
- **warn (#ffb45c)** `--warn`: warnings, budget badges.
- **bad (#ff6b7e)** `--bad`: errors, destructive actions, unread count dot.
- **Text on accent (#06070c)**: a raw literal, not a token (33 uses as `text-[#06070c]`, plus `text-[#06070c]/70` for the active tab hint). See M1.

Charts
- **chart-1 to chart-8** `--chart-1` ... `--chart-8`: categorical series palette, exposed in JS as `CHART_COLORS` in `ui.tsx` and applied through inline `style` (`stroke`, `background`). chart-1 to chart-5 equal accent, accent-2, good, warn, bad; chart-6 `#4fd6e8`, chart-7 `#ffd76c`, chart-8 `#ff8ac4` are chart-only.

Background atmosphere: `body` has two fixed radial gradients built from rgba literals of accent (`rgba(108, 140, 255, 0.09)`) and accent-2 (`rgba(165, 108, 255, 0.08)`). These live in `globals.css`, which is allowed.

## Typography

Families
- **Geist** (`--font-geist-sans`, mapped to Tailwind `--font-sans`): all UI text. Body stack: `var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif`.
- **Geist Mono** (`--font-geist-mono`, Tailwind `font-mono`): numbers, money, ids, model ids, timestamps, code and keys (about 90 uses), usually with `tabular-nums` (16 uses).
- Both are loaded with `next/font/google`, subset `latin`, variable font. `<html>` has `antialiased`. No other fonts, no Arabic font.

Scale in use (Tailwind v4 defaults plus three pixel sizes)

| Class | Size / line height | Uses | Role |
|---|---|---|---|
| `text-2xl font-semibold tracking-tight` | 24px / 32px | 6 | Page title (`AppShell` h1), big numbers |
| `text-xl` | 20px / 28px | 1 | `Stat` value (mono, semibold) |
| `text-lg` | 18px / 28px | 5 | Section numbers, donut centre value |
| `text-sm` | 14px / 20px | 118 | Default body, inputs, buttons, tab labels |
| `text-sm font-semibold tracking-tight` | 14px | | `Card` title (h3) |
| `text-xs` | 12px / 16px | 104 | Secondary text, tables, small buttons, legends |
| `text-[11px]` | 11px | 55 | Caps labels (`uppercase tracking-wider`), stat sub-lines, mono meta |
| `text-[10px]` | 10px | 21 | Tab hints, axis labels, tooltips, badges |
| `text-[9px]` | 9px | 1 | Notification count |

Weights: 400 default, `font-medium` (500) for labels and list names, `font-semibold` (600) for titles, values and primary buttons (about 104 weight classes in total). No `text-base`, no `text-3xl` or larger. `text-base` is not used: body copy is 14px.

Caps label pattern: `text-[11px] font-medium uppercase tracking-wider text-[var(--fg-dim)]` (form labels, `Stat` label). 33 `uppercase` uses.

Rules: numbers that are compared (money, tokens, percentages) use `font-mono tabular-nums`. Format them with `fmtUsd`, `fmtNum`, `fmtPct` from `ui.tsx`. The pixel sizes have no named token in `globals.css` (M6).

## Layout

- Spacing: Tailwind v4 default 4px step. Most used: `2` (8px), `3` (12px), `1` (4px), `4` (16px), `1.5`, `2.5`, `5`. Card body `p-5`, card header `px-5 py-3.5`, stat `px-4 py-3`, gaps `gap-2` to `gap-6`. Arbitrary spacing is rare (`gap-[3px]` in `HourHistogram`).
- Container: `AppShell` root `mx-auto w-full max-w-[100rem] flex-1 px-4 py-6 sm:px-6 lg:px-8`. The login page is a narrow centred column.
- Shell: header (title, tagline, counters, notification bell) above a horizontal, scrollable tab bar (`nav` with `overflow-x-auto`, 11 tabs: Hermes, Router, Playground, Compare, Analytics, Dashboard, Logs, Providers, Settings, Health, Models). There is no sidebar. One panel renders below in `<main className="amr-in">`.
- Grids: panels use `grid` with `sm:grid-cols-2`, `md:` and `xl:` column changes for stat rows and two-column layouts.
- Breakpoints: Tailwind v4 defaults, no custom screens. `sm` 40rem (640px, 14 uses), `md` 48rem (768px, 14), `lg` 64rem (1024px, 5), `xl` 80rem (1280px, 13), `2xl` unused. Mobile first.
- RTL: none. `lang="en"`, no `dir` attribute, physical properties (`ml-*`, `left-*`, `text-left`, `right-5`). The app is an English-only admin tool, so Arabic RTL is out of scope unless Hazem decides otherwise. If RTL is added, switch to logical properties first.

## Elevation & Depth

Depth comes from surface steps (bg, then panel, then panel-2), 1px borders and translucency, not shadows.

- Cards: `bg-[var(--panel)]/80 backdrop-blur-sm` over the body gradients.
- Shadows: no shadow tokens. Tailwind defaults are used only on floating layers: `shadow-xl` on toasts and the notification menu, `shadow-2xl` on the log detail dialog (3 uses total).
- Scrim: `bg-black/70 backdrop-blur-sm` behind the log detail dialog (off-palette, see M2).
- z-index layers (Tailwind defaults, no arbitrary values): `z-10` chart tooltip, `z-40` notification menu, `z-50` toasts and dialog.

## Shapes

Tailwind v4 radius scale.

| Class | Value | Uses | Where |
|---|---|---|---|
| `rounded-2xl` | 16px | 3 (Card is reused widely) | `Card`, login form, log dialog |
| `rounded-xl` | 12px | 48 | Stat, Empty, nav bar, large buttons, toolbar inputs, toasts, alerts, menus |
| `rounded-lg` | 8px | 67 | Tabs, form inputs, small buttons, menu items |
| `rounded-md` | 6px | 40 | Compact buttons, tooltips |
| `rounded` / `rounded-sm` | 4px | about 30 | Tiny chips, legend swatches (`rounded-sm`), histogram bars (`rounded-t-sm`) |
| `rounded-full` | 9999px | 20 | Progress tracks and fills, badges, status dots, count bubble |

Nesting rule in practice: outer container one step larger than its children (Card 2xl, Stat xl, input lg).

## Components

All shared primitives are in `src/components/ui.tsx`. Panels are in `src/components/*Panel.tsx`; the shell is `src/components/AppShell.tsx`; toast state is `useToasts` in `src/components/store.ts`. There is no Button, Input, Select, Table, Badge, Dialog or Toast primitive: those patterns are written inline in each panel (84 `<button>`, 80 `<input>`, 21 `<select>`, 4 `<textarea>`, 11 `<table>`).

### Card (`ui.tsx`, `Card`)
Props: `title`, `subtitle`, `action`, `className`. `rounded-2xl border border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-sm`; optional header `border-b border-[var(--border-soft)] px-5 py-3.5` with `text-sm font-semibold tracking-tight` title and `text-xs` fg-dim subtitle; body `p-5`.
- Do: wrap every panel section in `Card`; put actions in the `action` slot.
- Don't: rebuild a card with a custom `section` and different radius or padding.

### Stat (`ui.tsx`, `Stat`)
Props: `label`, `value`, `sub`, `tone` (`default | good | warn | bad | accent`). `rounded-xl border-[var(--border-soft)] bg-[var(--panel-2)]/60 px-4 py-3`; caps label; value `font-mono text-xl font-semibold tabular-nums` coloured by tone; sub `text-[11px]` fg-muted.
- Do: use `tone` for meaning (bad for errors, warn for budget), not decoration.
- Don't: add a local KPI tile (DashboardPanel has its own tile with `text-amber-400`, see M2).

### Empty (`ui.tsx`, `Empty`)
Dashed `rounded-xl border-[var(--border)]`, `min-h-[8rem]`, centred `text-sm` fg-dim. Used by every chart primitive for its empty state.
- Do: use it for every empty list, table or chart, with one plain sentence.

### Charts (`ui.tsx`: `Donut`, `BarList`, `AreaChart`, `HourHistogram`, `ContextGauge`)
Hand-written SVG and divs, colours from `CHART_COLORS` and tokens via inline `style`. `AreaChart`: accent line (2.5px) with an accent gradient fill, good dashed second series, border-soft dashed grid. `ContextGauge`: good / warn / bad by fill thresholds (0.7, 0.85) with a fg-dim 70% marker. Each shows `Empty` when it has no data.
- Do: pass colours as `var(--chart-n)` or status tokens. Don't: hardcode series colours.

### Navigation tabs (`AppShell.tsx`)
Bar: `rounded-xl border bg-[var(--panel)]/60 p-1.5`, horizontal scroll. Tab: `rounded-lg px-4 py-2.5`, label `text-sm font-medium`, hint `text-[10px]`. Inactive hover `bg-[var(--panel-2)]`. Active `bg-[var(--accent)] text-[#06070c]`, hint at 70%. `transition-colors`.
- States missing: no `aria-selected` / `role="tab"`, no visible focus ring.

### Buttons (inline, no primitive)
Variants found, by frequency:
- **Primary solid**: `rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50`. Small: `rounded-lg px-3 py-1.5 text-xs`. Compact: `rounded-md px-3 py-1.5 text-sm`.
- **Primary gradient** (hero CTA, 2 uses: Login submit, Router "recommend"): `w-full rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] px-4 py-3 text-sm font-semibold text-[#06070c] hover:opacity-90 disabled:opacity-50`.
- **Secondary**: `rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm hover:bg-[var(--panel-2)]`, plus `rounded-lg px-3 py-1.5 text-xs` and `rounded-md` sizes.
- **Danger**: `rounded-lg border border-[var(--bad)]/40 px-3 py-1.5 text-[var(--bad)] hover:bg-[var(--bad)]/10`.
- **Text link button**: `text-xs hover:underline`, fg-muted or bad.
- **Icon button**: notification bell, `rounded-lg border px-2.5 py-1.5`, has `aria-label="Notifications"`.
States: hover is opacity 90% (primary) or panel-2 fill (secondary); disabled is `opacity-50` (32 `disabled:` uses); loading is a label change ("Working…"); no focus style.
- Do: copy the exact class string of the variant above until a `Button` primitive exists. Don't: introduce new colours (ComparePanel and PlaygroundPanel use `bg-indigo-600 text-white`, see M2).

### Form fields (inline)
- Form input: `mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-2)]/60 px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]`; mono variant for keys and ids.
- Toolbar input / select: `rounded-xl border bg-[var(--panel)]/70 px-4 py-2.5 text-sm outline-none placeholder:text-[var(--fg-dim)] focus:border-[var(--accent)]`.
- Label: wrapping `<label>` with the caps label span above the field (implicit association). Help text `text-[11px]` fg-dim. Error: `rounded-lg border-[var(--bad)]/40 bg-[var(--bad)]/10 px-3 py-2 text-xs text-[var(--bad)]`.
- Range: native, `accent-color: var(--accent)`.
- Focus: only the border colour changes to accent (14 `outline-none`, 0 `focus-visible:`).

### Tables (inline)
Plain `<table>` in DashboardPanel, AnalyticsPanel, ModelsPanel, LogsPanel. Header `text-xs uppercase text-[var(--fg-dim)]` (or `thead text-[var(--fg-dim)]`); rows `border-t border-[var(--border)]` (or `/50`); cells `py-2` or `px-3 py-2`; numeric columns `text-right font-mono tabular-nums`. Sortable headers use `SortHeader` in DashboardPanel.
- Do: right-align and mono every numeric column.

### Badges and status dots (inline)
Badge: `rounded-full bg-[var(--warn)]/15 px-2 py-0.5 text-[10px] text-[var(--warn)]` (same pattern with good / bad / accent). Chip toggle: `rounded-full border px-2.5 py-1 text-[11px] transition-colors`. Dot: `h-1.5 w-1.5 rounded-full bg-[var(--bad)]` or warn. Count bubble: `rounded-full bg-[var(--bad)] text-[9px] font-semibold text-white`.

### Alerts and banners
Error banner: `rounded-xl border border-[var(--bad)]/40 bg-[var(--bad)]/10 px-4 py-3 text-sm text-[var(--bad)]`. `BudgetBanner.tsx` follows the same tinted pattern with warn.

### Toasts (`AppShell.tsx` + `useToasts` in `store.ts`)
Fixed `bottom-5 right-5 z-50`, stack `gap-2`. Each: `amr-in max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur`, background panel, border and text coloured by tone (good, bad, default border/fg) via inline `style`. No `role="status"` / `aria-live`.
- Do: call `onToast` / `push` from panels. Don't: build another toast layer.

### Dialog (`LogsPanel.tsx`, log detail)
Scrim `fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm`, closes on scrim click. Panel `amr-in mt-8 w-full max-w-3xl rounded-2xl border bg-[var(--panel)] shadow-2xl`, header like Card. No `role="dialog"`, `aria-modal`, Escape handling or focus trap. It is the only dialog.

### Notification menu (`AppShell.tsx`, `NotificationBell`)
Popover `absolute right-0 z-40 mt-2 w-80 rounded-xl border bg-[var(--panel)] p-2 shadow-xl`, items `rounded-lg px-2.5 py-2 text-xs hover:bg-[var(--panel-2)]`, read items fg-dim. Closes on outside mousedown; no Escape, no menu roles.

## Do's and Don'ts

Do
- Use the `:root` variables for every colour: `bg-[var(--token)]`, `text-[var(--token)]`, with opacity modifiers for tints.
- Build sections from `Card`, numbers from `Stat`, empty states from `Empty`, charts from the `ui.tsx` chart primitives and `CHART_COLORS`.
- Use accent for the one main action on a view; use the gradient CTA only for a full-width hero action.
- Put numbers, ids and money in `font-mono tabular-nums` and format them with `fmtUsd` / `fmtNum` / `fmtPct`.
- Design every data view for loading (`amr-pulse` "syncing…"), empty (`Empty`), error (bad alert) and success (toast).

Don't
- Don't use Tailwind palette colours (`zinc-*`, `indigo-*`, `red-*`, `white`, `black`) or `dark:` variants: the app is dark-only and has its own palette.
- Don't add a raw hex, `rgb()` or `hsl()` in any `.tsx` file.
- Don't add fonts, shadows, radii or z-index values outside the scales above.
- Don't add a second Button, Input, Dialog or Toast implementation; extract a shared primitive into `ui.tsx` instead.
- Don't rely on colour alone for status; pair it with text ("down", "over budget").

## Motion

Defined in `globals.css`:
- `.amr-in`: keyframes `amr-fade-up` (opacity 0 to 1, translateY 6px to 0), `0.28s ease-out both`. Used on the main panel, toasts, dialog and `BarList` rows (with a 30ms stagger via `animationDelay`). 8 uses.
- `.amr-pulse`: opacity 1 to 0.45, `1.4s ease-in-out infinite`. Used for "syncing…" and live states. 7 uses.

In components: `transition-colors` / `transition-opacity` / `transition-all` / `transition-[width]` (13 `transition` uses) with Tailwind default 150ms, `duration-300` (histogram bars) and `duration-500 ease-out` (bar and progress widths), one `animate-pulse`.

Reduced motion: not handled. There is no `prefers-reduced-motion` rule (M8). Allowed durations: 150ms (Tailwind default), 280ms (`amr-in`), 300ms, 500ms, 1.4s (pulse loop). Easing: `ease-out` for entrances, `ease-in-out` for loops.

## Accessibility

Contrast, WCAG 2.x, dark theme only (computed from the token hex values, solid backgrounds; translucent cards over `bg` sit between the panel and bg values).

| Foreground | Background | Ratio | AA normal text (4.5) | AA UI / large (3.0) |
|---|---|---|---|---|
| fg #e8ecf5 | bg #07080c | 16.92 | pass | pass |
| fg #e8ecf5 | panel #10131b | 15.69 | pass | pass |
| fg #e8ecf5 | panel-2 #151925 | 14.82 | pass | pass |
| fg-muted #8b94ad | bg | 6.61 | pass | pass |
| fg-muted #8b94ad | panel | 6.13 | pass | pass |
| fg-muted #8b94ad | panel-2 | 5.79 | pass | pass |
| fg-dim #5c657d | bg | 3.44 | **fail** | pass |
| fg-dim #5c657d | panel | 3.19 | **fail** | pass |
| fg-dim #5c657d | panel-2 | 3.02 | **fail** | pass (barely) |
| #06070c | accent #6c8cff | 6.55 | pass | pass |
| #06070c | accent-2 #a56cff | 5.93 | pass | pass |
| accent #6c8cff | panel | 6.04 | pass | pass |
| accent #6c8cff | panel-2 | 5.71 | pass | pass |
| good #3ddc97 | panel | 10.51 | pass | pass |
| warn #ffb45c | panel | 10.55 | pass | pass |
| bad #ff6b7e | panel | 6.77 | pass | pass |
| #ffffff | bad #ff6b7e (count bubble) | 2.74 | **fail** | **fail** |
| #ffffff | indigo-600 #4f46e5 (Compare/Playground) | 6.29 | pass | pass |
| border #212738 | panel | 1.25 | n/a | **fail** (inputs boundary) |
| border #212738 | bg | 1.35 | n/a | **fail** |

fg-dim is used for small text (11px and 10px labels, table headers, placeholders, subtitles), so those fail AA. Input borders at 1.25:1 do not meet the 3:1 non-text contrast for the field boundary; the fill difference (panel-2 on panel) is also low.

Focus: no visible focus ring anywhere. Inputs use `outline-none` with `focus:border-[var(--accent)]` (accent on panel is 6.04:1, so the colour itself is fine, but a 1px border change is the only cue); buttons and tabs rely on the browser default outline, which `outline-none` removes on inputs and which is not styled.

Semantics: `aria-label` x3, `aria-hidden` x1 in total. Tabs have no tab roles; the dialog has no dialog role, Escape or focus trap; toasts have no live region. Most form fields use wrapping `<label>`, one uses `htmlFor`.

Targets: compact buttons `px-3 py-1.5 text-xs` are about 28px tall, above the 24px minimum. Text link buttons (`text-xs hover:underline`) can fall below 24px tall.

Not checked in this pass: rendered screenshots. The app was not running locally and the repo is read-only for this task, so no visual verification was done (see M12).

## HARD RULES

1. Colours come only from the `:root` variables in `src/app/globals.css`; reference them as `var(--token)`.
2. A new colour is added as a `:root` token (and to this file) before any component uses it.
3. No raw hex, `rgb()`, `hsl()` or arbitrary colour (`bg-[#...]`, `text-[#...]`) in `.tsx` / `.ts` files; no Tailwind palette colours (`zinc-*`, `indigo-*`, `red-*`, `white`, `black`) and no `dark:` variants.
4. Fonts are Geist and Geist Mono via `next/font` in `layout.tsx` only; numbers use `font-mono tabular-nums`.
5. Reuse the `ui.tsx` primitives (`Card`, `Stat`, `Empty`, charts, `CHART_COLORS`, `fmt*`); new shared UI goes into `ui.tsx`, never a second copy in a panel.
6. Every interactive element has a visible focus indicator (`focus-visible:` ring in accent); `outline-none` is never used without one.
7. Radius, shadow, z-index and spacing use the Tailwind scales listed above; no arbitrary `rounded-[..]`, `shadow-[..]`, `z-[..]`.
8. Icon-only buttons have an `aria-label`; every data view handles loading, empty and error states.
9. Animations use `amr-in`, `amr-pulse` or the listed durations, and must respect `prefers-reduced-motion` once that rule exists.

Shared Beinno basics (logo use, promo videos in English and Egyptian Arabic) apply as written in the `beinno-design-system` skill. The app currently ships no logo file of its own (`public/` holds only the Next.js starter SVGs); the wordmark is the text "AI Model **Router**" with the accent gradient on "Router".

## Known mismatches

Code vs. this spec, as of `7ab47bc`. Each needs a Plane ticket via beinno-plane (IDs to be added when filed).

| ID | Mismatch | Where | Proposed fix |
|---|---|---|---|
| M1 | Text on accent is the raw literal `#06070c` (33 uses, plus `/70`) | AppShell 84, 91; LoginForm 108; ProvidersPanel 121, 512; ModelsPanel 240, 442, 674; AnalyticsPanel 254, 383; DashboardPanel 191; SettingsPanel 227, 363, 473, 563; HermesPanel (13); RouterPanel 65, 67, 69, 217, 389 | Add `--on-accent: #06070c` to `:root` and replace |
| M2 | Off-palette Tailwind colours and `dark:` variants (zinc, indigo, red, green, emerald, amber, white, black; 36 `dark:`). In Tailwind v4 `dark:` follows the OS `prefers-color-scheme`, so with a light OS these panels show white fields on the dark page | ComparePanel, PlaygroundPanel (whole panels); DashboardPanel 100, 202, 235; SettingsPanel 279, 291, 320, 428; AppShell 249 `text-white`; LogsPanel 267 `bg-black/70` | Restyle with tokens (input, button-primary, bad/good/warn); add a `--scrim` token |
| M3 | Scrollbar thumb hover `#2d364d` is raw | globals.css 76 | Add a token (for example `--border-strong`) |
| M4 | `HourHistogram` uses `var(--accent2)`, which is not defined (the variable is `--accent-2`). The whole `linear-gradient` is then invalid, so bars with calls likely render with no fill (not visually verified) | ui.tsx 381 | Use `var(--accent-2)` |
| M5 | No shared Button, Input, Select, Table, Badge, Dialog or Toast primitive; 84 buttons styled inline with at least 6 primary variants; 42 buttons have their class computed inline | all panels, HermesPanel (28 buttons), ModelsPanel (14) | Extract primitives into `ui.tsx` over time |
| M6 | Pixel font sizes 11/10/9px with no named token; 9px and 10px are below a comfortable reading size | 77 uses | Add named text tokens or move to `text-xs` minimum |
| M7 | fg-dim fails AA for text (3.02 to 3.44:1) and is used on small text | labels, table headers, placeholders, subtitles | Raise `--fg-dim` lightness or use fg-muted for text |
| M8 | No `prefers-reduced-motion` handling | globals.css | Add a reduced-motion block disabling `amr-in` / `amr-pulse` and transitions |
| M9 | No visible focus: 14 `outline-none`, 0 `focus-visible:`; tabs and buttons have no styled focus | all panels, AppShell | Add an accent `focus-visible` ring to every interactive element |
| M10 | `@theme inline` names (`bg-panel`, `text-dim`, `accent2`...) are defined but unused (0 uses); code uses `bg-[var(--...)]`. Two naming systems for the same colours | globals.css 28 to 43 | Pick one pattern (keep `var()` as the documented house style, or migrate) |
| M11 | Accessibility semantics missing: notification count white on bad 2.74:1; input borders 1.25:1; tabs without tab roles; dialog without role, Escape, focus trap; toasts without live region; only 3 `aria-label` | AppShell, LogsPanel, all forms | Fix per item |
| M12 | No screenshot verification of this spec yet (app not running, repo read-only for this task) | n/a | Screenshot Hermes, Router, Analytics, Logs dialog and Compare at 1280px and 390px and compare with this file |
| M13 | `--bg-soft` is defined but unused | globals.css 5 | Use or remove |

Linter note (`npx @google/design.md lint`, v0.4.0): 0 errors, 8 warnings. Seven are the real contrast failures in M7 and M11 (fg-dim text, white count bubble). One is `missing-primary`: the code names its brand colour `accent`, not `primary`, and this file keeps the code name on purpose.
