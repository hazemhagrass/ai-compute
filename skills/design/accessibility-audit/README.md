# Accessibility Audit

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="accessibility-audit robot" width="200">
</div>

A skill for auditing a web UI against WCAG 2.2 Level AA by hand, covering semantic HTML, keyboard operability, focus behaviour, contrast ratios, labels, and the narrow cases where ARIA is the right answer.

## What it does

This skill turns "make it accessible" into a fixed inspection pass with concrete
thresholds and a paired bad/good example for every rule. Each rule targets a
specific barrier that a real user hits, not a line item in a report.

| Rule | Prevents |
| --- | --- |
| Start from semantic HTML | A `div` with a click handler that nobody can reach |
| Make everything keyboard operable | `outline: none` losing the user's place |
| Trap focus in modals, then give it back | Tabbing into a page hidden behind an overlay |
| Keep tab order equal to visual order | Focus jumping backwards across the screen |
| Measure contrast, do not eyeball it | Grey placeholders at 2.8:1 shipping as "fine" |
| Never carry meaning in colour alone | Status a colour-blind user cannot read |
| Write alt text for purpose | "trash can icon" instead of "Delete invoice" |
| Label forms and announce errors | A red border that says nothing to a screen reader |
| Reach for ARIA last | `role="link"` on a button, lying about behaviour |
| Announce dynamic updates | Search results that change in silence |
| Headings and landmarks | Screen reader users with no map of the page |
| Targets and reduced motion | 16px tap targets and unavoidable parallax |
| Test by hand | A clean axe run reported as an accessible product |

It is prescriptive, states the WCAG numbers exactly, and gives markup you can
pattern-match against your own instead of reasoning from principles.

## When to use this

Use it when you are:

- Auditing an existing page, flow, or component library for WCAG AA.
- Reviewing a pull request that adds or changes UI.
- Building a new interactive component and deciding what it owes the keyboard.
- Fixing findings from an external accessibility report and wanting to
  understand what actually broke.
- Writing acceptance criteria for a UI ticket that has to be operable.

Do not use it as: a legal compliance sign off, a substitute for testing with
disabled users, or a replacement for an automated scan in CI. Run the scan too;
it is fast and it clears the cheap failures before a human spends time.

The sibling engineering skill covers component structure and data flow. Decide
structure there, then audit operability here.

## Quick start

A "Delete project" control from a real codebase, before and after.

### Before

```html
<div class="danger-btn" onclick="deleteProject()">
  <img src="trash.svg" alt="trash icon">
</div>

<div class="overlay" id="confirm">
  <div class="modal">
    <div class="modal-title">Delete project</div>
    <input placeholder="Type the project name">
    <div class="btn" onclick="closeConfirm()">Cancel</div>
    <div class="btn danger" onclick="reallyDelete()">Delete</div>
  </div>
</div>
```

```css
.danger-btn { width: 16px; height: 16px; color: #d33; }
.modal :focus { outline: none; }
```

Failures found in one keyboard pass: nothing here is reachable by Tab, nothing
activates with Enter, the icon announces "trash icon" rather than the action,
the dialog does not contain focus or close on Escape, focus never returns to the
opener, the input has no label, the destructive state is carried by colour alone,
the target is 16 by 16, and the focus ring was removed outright.

### After

```html
<button type="button" class="danger-btn" onclick="openConfirm(this)">
  <img src="trash.svg" alt="Delete project">
</button>

<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete project</h2>
  <p>This cannot be undone.</p>

  <label for="confirm-name">Type the project name to confirm</label>
  <input id="confirm-name" aria-describedby="confirm-error">
  <p id="confirm-error" role="status" aria-live="polite"></p>

  <button type="button" data-close>Cancel</button>
  <button type="button" data-confirm>
    <svg aria-hidden="true">...</svg> Delete permanently
  </button>
</dialog>
```

```css
.danger-btn { min-width: 24px; min-height: 24px; padding: 8px; color: #b3261e; }

.modal :focus-visible {
  outline: 3px solid #0b5fff;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  dialog { animation: none; }
}
```

```js
let opener = null;
function openConfirm(trigger) {
  opener = trigger;
  document.getElementById("confirm").showModal();
}
document.getElementById("confirm").addEventListener("close", () => {
  opener?.focus();
});
```

Nothing was redesigned. Two `div` elements became native elements and brought
their behaviour with them, the overlay became a `dialog` that contains focus and
closes on Escape, alt text became the action, the input got a label and a live
region for its error, the word "permanently" carries the danger that red was
carrying alone, and the target grew by padding rather than by an overlay.

## Key concepts

**Semantics before everything.** Role, focusability, and keyboard activation come free with the right element. A `div` with a click handler has none of them and is the single most common source of accessibility bugs, because the fix is four attributes and two handlers that are easy to get wrong.

**Operability is a keyboard property.** If a flow cannot be completed with the
mouse unplugged, it cannot be completed by switch users, most screen reader
users, or voice control users either.

**Focus is a location.** Users track a visible ring the way a mouse user tracks a
cursor. Removing the outline, covering it with sticky chrome, or dumping focus to
`<body>` on dialog close all erase the user's place on the page.

**The contrast numbers.** At Level AA: 4.5:1 for normal text, 3:1 for large text
(18pt or larger, or 14pt or larger bold, roughly 24px and 18.66px), and 3:1 for
UI components and meaningful graphics under 1.4.11. Level AAA raises the text
bars to 7:1 and 4.5:1. Compute the ratio; luminance is not perceived brightness,
and 4.49:1 fails.

**Two channels, always.** Any meaning carried by colour must also be carried by
text, icon, or shape. Colour is not delivered to a colour-blind user, a greyscale
display, or a phone in direct sunlight.

**Alt text is about purpose.** Decorative images take `alt=""` so they are
skipped. Actionable images take the action as their name. Informative images take
the information a sighted user receives. Appearance is never the answer.

**ARIA is a promise you must keep.** ARIA changes what is reported without
changing behaviour, so wrong ARIA misinforms while plain broken markup merely
fails. A role obliges you to implement its states and keyboard pattern, which is
why no ARIA beats bad ARIA.

**Live regions must pre-exist.** A region injected together with its text usually announces nothing. Render the empty region first, then swap text into it.

**Structure is navigation.** Screen reader users jump by heading and landmark. One `<h1>`, no skipped levels, one `<main>`, and labelled navigation regions give them a map instead of a wall of text.

**Automated scans are a floor.** They catch a minority of real barriers and
cannot judge whether alt text is correct, whether focus returns sensibly, or
whether a flow is usable. The manual keyboard and screen reader pass is the
audit; the scan is the warm up.

## Common pitfalls

### Shipping a clickable div

Bad: `<div class="btn" onclick="save()">Save</div>`

Good: `<button type="button" onclick="save()">Save</button>`

Reason: the div has no role, no tab stop, and no Enter or Space activation, so
keyboard and screen reader users never reach the control at all.

### Removing the focus outline

Bad: `:focus { outline: none; }`

Good: `:focus-visible { outline: 3px solid #0b5fff; outline-offset: 2px; }`

Reason: the ring is how a keyboard user knows where they are, and a page without
one is navigated blind.

### Leaving a modal open behind the user

Bad: a `div` overlay where Tab walks into the page underneath and Escape does
nothing.

Good: `<dialog>` with `showModal()`, plus a `close` listener that returns focus
to the element that opened it.

Reason: an uncontained modal lets a screen reader read content the user cannot
see, and focus dumped to `<body>` on close restarts them at the top of the page.

### Trusting the contrast picker's "AA" badge at a glance

Bad: `color: #9a9a9a` on white for hint text, about 2.8:1.

Good: `color: #6b6b6b` on white, about 5.7:1, and 3:1 minimum on input borders
and focus rings.

Reason: 1.4.3 requires 4.5:1 for normal text and does not cover non-text at all,
so borders and icons need 1.4.11 checked separately.

### Conveying state with colour alone

Bad: a red dot for an offline server and a green dot for an online one.

Good: the same dot plus an icon and the word "Offline".

Reason: colour is one channel, and it is the channel missing for colour vision
deficiency, greyscale, and bright sunlight.

### Describing the picture instead of the job

Bad: `<button><img src="trash.svg" alt="trash can icon"></button>`

Good: `<button><img src="trash.svg" alt="Delete invoice"></button>`

Reason: the role is already announced, so the name has to carry what pressing it
will do.

### Using the placeholder as the label

Bad: `<input type="email" placeholder="Email" class="input-error">`

Good: a `<label for>`, plus `aria-invalid` and an `aria-describedby` error in
text.

Reason: the placeholder vanishes on first keystroke and the red border carries no
information to anyone who cannot see it.

### Papering over broken markup with ARIA

Bad: `<div role="button" aria-pressed="false" onclick="toggle()">` with no
`tabindex` and no key handler.

Good: `<button type="button" aria-pressed="false" onclick="toggle()">`

Reason: ARIA changes the announcement, never the behaviour, so this control now
claims to be a button it still cannot act like.

### Updating the page in silence

Bad: replacing a results list and its count with no announcement.

Good: an empty `<p role="status" aria-live="polite">` rendered up front, then
`textContent` set to the new count.

Reason: a screen reader user gets no notification that anything changed, and a
region created at the same instant as its text usually announces nothing.

### Picking heading levels by font size

Bad: `<h3 class="big">Invoices</h3>` as the page title because h3 looked right.

Good: `<h1>Invoices</h1>` with CSS setting the size.

Reason: heading level is the document outline that screen reader users navigate
by, and size is a style decision that belongs in CSS.

### Calling a clean scan an accessible page

Bad: an axe run with zero violations reported as done.

Good: the scan plus a keyboard-only pass on each main flow, a screen reader pass
with NVDA or VoiceOver, and a 400% zoom reflow check.

Reason: automated rules detect a minority of real barriers and cannot evaluate
whether alt text is right, whether focus returns, or whether a flow makes sense.

## See also

Related skills in this library:

- [frontend-architecture](../../engineering/frontend-architecture/SKILL.md) for the
  component and state structure that decides where these controls live before you
  audit them.
- [presentation-design](../presentation-design/SKILL.md) for the sibling rules on
  contrast, colour meaning, and readability in slides rather than in the DOM.
- [code-review](../../engineering/code-review/SKILL.md) for folding these checks
  into a review pass instead of a separate late audit.
- [test-strategy](../../engineering/test-strategy/SKILL.md) for deciding which of
  these checks belong in automated tests and which need a human.
- [technical-writing](../../writing/technical-writing/SKILL.md) for writing the
  error messages, labels, and alt text that this audit keeps demanding.
