---
name: accessibility-audit
description: "Use when auditing a web UI. Test against WCAG AA by hand. Semantic HTML first, keyboard operability, real contrast ratios, correct focus behaviour, and ARIA only as a last resort."
---

# Accessibility Audit

An accessibility audit is not a scan. It is an inspection of whether the page still works when the mouse is gone, the colours are gone, or the screen is gone. Automated tools flag a minority of real barriers, so run them first to clear the cheap failures, then do the work by hand. Thresholds below are WCAG 2.2 Level AA unless stated otherwise.

## Start from semantic HTML

- **Use the element that already has the behaviour before you build one.** A `<button>` arrives with a role, a focusable tab stop, Enter and Space activation, a disabled state, and form semantics. A `<div>` with `onClick` arrives with none of that, which is why it is the root of most accessibility bugs on a page.
- **Never attach a click handler to a non-interactive element.** Screen reader users navigate by role, so an element with no role is in none of the lists they navigate by, and keyboard users never reach it at all.
- **Use `<a href>` for navigation and `<button>` for action.** A link that runs JavaScript and goes nowhere breaks middle click and Ctrl click and contradicts the expectation its role sets.
- **If you truly cannot use the native element, you owe it every behaviour the native one had:** `role`, `tabindex="0"`, Enter and Space handlers, and the matching ARIA state. That is four places to get wrong instead of zero.

```html
<!-- BAD: no role, no tab stop, no keyboard activation, no disabled state -->
<div class="btn" onclick="save()">Save</div>
<a href="#" onclick="openDialog()">Settings</a>

<!-- GOOD -->
<button type="button" onclick="save()">Save</button>
<button type="button" onclick="openDialog()">Settings</button>

<!-- Acceptable only when a native button is genuinely impossible -->
<div role="button" tabindex="0" onclick="save()"
     onkeydown="if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); save(); }">Save</div>
```

## Make everything keyboard operable

- **Reach and operate every control with Tab, Shift+Tab, Enter, Space, and the arrow keys, with the mouse unplugged.** Anyone using a switch device, a screen reader, voice control, or a keyboard alone hits exactly this path.
- **Never remove the focus outline without replacing it.** `outline: none` is the most common way a keyboard user loses their place on a page.
- **Give the focus indicator at least 3:1 contrast against the adjacent colour**, the same non-text floor that applies to UI components.
- **Keep focus visible, not merely present.** A sticky header or footer bar that covers the focused control leaves the user pressing keys blind.
- **Do not use `tabindex` values above zero.** A positive `tabindex` jumps ahead of every natural tab stop and turns tab order into a puzzle. Use `0` to add a stop and `-1` for a target you move focus to in script.
- **Provide a skip link as the first focusable element**, so a keyboard user can jump past a long nav instead of tabbing through forty links on every page.

```css
/* BAD */
:focus { outline: none; }

/* GOOD: visible, high contrast, keyboard focus only */
:focus-visible { outline: 3px solid #0b5fff; outline-offset: 2px; }
```

## Trap focus in modals, then give it back

- **While a modal is open, keep Tab cycling inside it and hide the rest from assistive technology**, because a screen reader user who tabs out reads a page they cannot see and cannot interact with.
- **Move focus into the dialog when it opens**, to the dialog itself or its first meaningful control, not to the close button by default.
- **Return focus to the element that opened the dialog when it closes.** Focus dumped back to `<body>` means the next Tab starts at the top of the page and the user has lost their position entirely.
- **Close on Escape.** A dialog that only closes by mouse is a keyboard trap, which is a Level A failure.

```html
<!-- BAD: focus stays behind the overlay, Tab walks the page underneath -->
<div class="overlay"><div class="modal">
  <h2>Delete project</h2><button onclick="close()">Cancel</button>
</div></div>

<!-- GOOD: native dialog gives modality, focus containment, and Escape -->
<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete project</h2>
  <button type="button" data-close>Cancel</button>
  <button type="button" data-confirm>Delete</button>
</dialog>
```

```js
// GOOD: remember the opener, restore focus on close
let opener = null;
function openConfirm(trigger) {
  opener = trigger;
  document.getElementById("confirm").showModal(); // focus moves in, Escape works
}
document.getElementById("confirm").addEventListener("close", () => opener?.focus());
```

## Keep tab order equal to visual order

- **Order the DOM the way the page reads**, because tab order follows the DOM and a screen reader reads the DOM. CSS that reorders boxes reorders neither.
- **Avoid `order`, `row-reverse`, and large `grid-area` rearrangements on content users operate**, since they split what the eye sees from what the keyboard does and focus starts jumping across the screen.
- **Test it by tabbing once through the page watching only the focus ring.** If the ring jumps backwards or off to an unrelated region, the order is wrong.

```html
<!-- BAD: visually Cancel then Save, but Tab reaches Save first -->
<div style="display:flex; flex-direction: row-reverse">
  <button>Save</button><button>Cancel</button>
</div>

<!-- GOOD: DOM order matches visual order -->
<div style="display:flex"><button>Cancel</button><button>Save</button></div>
```

## Measure contrast, do not eyeball it

Relative luminance is not the same as how bright a colour looks, so compute every pair. WCAG 2.2 Level AA thresholds:

| What | Ratio | Criterion |
| --- | --- | --- |
| Normal text | 4.5:1 | 1.4.3 Contrast (Minimum) |
| Large text: 18pt or larger, or 14pt or larger bold | 3:1 | 1.4.3 Contrast (Minimum) |
| UI components and meaningful graphics | 3:1 | 1.4.11 Non-text Contrast |

- **Treat 18pt as about 24px and 14pt bold as about 18.66px** when checking CSS sizes against the large-text exception.
- **Do not round up.** 4.49:1 fails 1.4.3, and a tool reporting "close" is reporting a failure.
- **Apply 3:1 to input borders, focus rings, toggle states, icon-only buttons, and chart lines**, because a control nobody can see is a control nobody can use and 1.4.3 does not cover non-text.
- **Check placeholder text and text over images.** Grey on white placeholders are the usual failure.
- Level AAA raises the text bars to 7:1 and 4.5:1 under 1.4.6 if you are asked for it, but AA is the compliance target for most work.

```css
/* BAD: about 2.8:1 on white, fails normal text */
.hint { color: #9a9a9a; background: #ffffff; }

/* GOOD: about 5.3:1 on white */
.hint { color: #6b6b6b; background: #ffffff; }
```

## Never carry meaning in colour alone

- **Pair every colour cue with text, shape, or an icon**, because a user with colour vision deficiency, a greyscale display, or bright sunlight receives only the second channel.
- **Underline links inside body text** rather than colouring them alone, since colour alone is exactly what 1.4.1 forbids.

```html
<!-- BAD: status is the dot colour and nothing else -->
<span class="dot dot-red"></span> Server 4

<!-- GOOD: colour plus icon plus text -->
<span class="dot dot-red" aria-hidden="true"></span>
<svg aria-hidden="true">...</svg> <span>Server 4: Offline</span>
```

## Write alt text for purpose, not appearance

- **Give decorative images an empty `alt=""`** so a screen reader skips them. Omitting the attribute makes some screen readers read the file name aloud.
- **Describe what an actionable image does, not what it looks like.** For an icon button the accessible name is the action.
- **For an informative image, write what a sighted user gets from it** in one sentence, and put long detail in nearby text rather than a paragraph of alt.
- **Never start with "image of" or "icon of".** The role is already announced.

```html
<!-- BAD -->
<img src="divider.png" alt="decorative swirl divider">
<button><img src="trash.svg" alt="trash can icon"></button>
<img src="rev.png" alt="chart">

<!-- GOOD -->
<img src="divider.png" alt="">
<button><img src="trash.svg" alt="Delete invoice"></button>
<img src="rev.png" alt="Revenue fell 12 percent in the EU while other regions grew.">
```

## Label forms and announce errors

- **Associate every input with a real `<label for>`.** A placeholder is not a label: it disappears on typing, often fails contrast, and is not reliably announced.
- **Put the error in text next to the field, link it with `aria-describedby`, and set `aria-invalid`**, because a red border communicates nothing to a screen reader and nothing to a user who cannot distinguish red.
- **Say what to do, not just that something is wrong.** "Enter a date as DD/MM/YYYY" beats "Invalid".
- **Move focus to the first invalid field on submit**, so the user is standing where the problem is.

```html
<!-- BAD: placeholder as label, error conveyed by colour only -->
<input type="email" placeholder="Email" class="input-error">

<!-- GOOD -->
<label for="email">Email address</label>
<input id="email" type="email" aria-invalid="true" aria-describedby="email-error">
<p id="email-error" class="error">
  <svg aria-hidden="true">...</svg> Enter an email address, for example name@example.com
</p>
```

## Reach for ARIA last

- **Prefer native HTML to any ARIA attribute.** ARIA changes what assistive technology reports without changing a single behaviour, so wrong ARIA actively lies to the user while broken markup at least fails honestly.
- **Never override a native role.** `<button role="link">` produces a control that says link, behaves like a button, and matches neither expectation.
- **Keep ARIA state in sync with visual state on every change**, because `aria-expanded="false"` left stale on an open menu is a false statement.
- **Do not put `aria-hidden="true"` on anything focusable.** You get a control the keyboard reaches and the screen reader refuses to name.
- **An element with a role owes you its required states and keyboard pattern.** `role="tablist"` without arrow key handling is worse than plain links.

```html
<!-- BAD: redundant, contradictory, and stale -->
<button role="button" aria-label="Close" aria-expanded="false">Open menu</button>

<!-- GOOD: native role, name from content, state updated in script -->
<button type="button" aria-expanded="true" aria-controls="menu">Open menu</button>
```

## Announce dynamic updates with live regions

- **Put a live region in the DOM before the update happens.** Injecting the region and its text at the same moment usually announces nothing.
- **Use `aria-live="polite"` for status and `assertive` only for errors that stop the user**, because assertive interrupts whatever is being read.
- **Announce the results of asynchronous work**: search counts, saved states, toasts, and validation summaries all change silently otherwise.

```html
<!-- BAD: result count appears silently -->
<p>{count} results</p>

<!-- GOOD: region exists up front, text swaps in -->
<p role="status" aria-live="polite" id="results-status"></p>
<script>document.getElementById("results-status").textContent = `${count} results`;</script>
```

## Give screen readers a map: headings and landmarks

- **Use one `<h1>` per page and never skip heading levels**, because screen reader users jump by heading and a broken outline reads as a broken structure.
- **Choose heading level by rank, not by font size.** Style with CSS.
- **Wrap regions in landmarks**: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`, with one `<main>` per page.
- **Label repeated landmarks** with `aria-label`, so "navigation" and "navigation" become "primary" and "breadcrumb".

```html
<!-- BAD: heading level chosen for size, no landmarks -->
<div class="top"><h3 class="big">Invoices</h3></div>

<!-- GOOD -->
<header><nav aria-label="Primary">...</nav></header>
<main><h1>Invoices</h1><h2>Overdue</h2></main>
```

## Size touch targets and respect motion preferences

- **Make pointer targets at least 24 by 24 CSS pixels**, or space undersized ones so a 24 pixel diameter circle centred on each does not overlap a neighbour, per 2.5.8 Target Size (Minimum) at Level AA. 44 by 44 is the Level AAA target under 2.5.5 and a better default for primary touch actions.
- **Grow the hit area with padding, not a transparent overlay**, so the focus ring matches the target the user actually presses.
- **Honour `prefers-reduced-motion`** by removing parallax, autoplaying motion, and large transitions, because vestibular disorders make these physically painful rather than merely annoying.
- **Reduce, do not delete.** Cutting a transition to a short fade keeps the state change legible.

```css
/* BAD: 16px icon button, unconditional motion */
.icon-btn { width: 16px; height: 16px; }
.panel { transition: transform 600ms; }

/* GOOD */
.icon-btn { min-width: 24px; min-height: 24px; padding: 8px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## Test by hand, and trust the manual pass

- **Run the automated scan first** (axe, Lighthouse, pa11y) to clear missing alt, missing labels, and obvious contrast failures cheaply.
- **Do not report a clean scan as an accessible page.** Automated rules detect a minority of real barriers, and none can tell you whether an alt text is correct, whether focus returns sensibly, or whether a flow makes sense.
- **Do a keyboard-only pass on every flow that matters**: unplug the mouse and complete signup, checkout, and the main task end to end.
- **Do a screen reader pass** with a real one: NVDA or JAWS on Windows, VoiceOver on macOS and iOS with Safari, TalkBack on Android.
- **Listen for the three failure sounds**: an unnamed control ("button"), a wrong role, and silence after an action.
- **Zoom the browser to 400% at 1280px wide** and check content reflows into one column with no horizontal scrolling and nothing clipped.

## Quick checklist

- Does every interactive element use a native interactive element?
- Can you complete every flow with the mouse unplugged?
- Is the focus ring always visible, at 3:1 contrast, and never covered?
- Does a modal contain focus, close on Escape, and return focus to its opener?
- Does tab order match visual order with no positive `tabindex`?
- Does every text pair hit 4.5:1, or 3:1 when 18pt or 14pt bold?
- Do UI borders, icons, and focus rings hit 3:1?
- Is every colour cue paired with text or shape?
- Is decorative `alt` empty and actionable `alt` the action?
- Is every input labelled and every error in text with `aria-describedby`?
- Is every ARIA attribute necessary, correct, and kept in sync?
- Do async updates land in a live region that already existed?
- One `<h1>`, no skipped levels, one `<main>`, labelled navs?
- Are targets 24 by 24 CSS pixels or spaced to compensate?
- Is `prefers-reduced-motion` honoured?
- Has a human driven it with a keyboard and a screen reader?
