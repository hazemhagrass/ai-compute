---
name: grill-me
description: Use when stress-testing a plan or design. Interview relentlessly until shared understanding.
---

Interview the user relentlessly about a plan, decision, or design until you reach shared understanding. Map the subject as a design tree where every decision branches into the decisions that depend on it.

## How it works

Work the tree in rounds. The **frontier** is every decision whose prerequisites are already settled: questions you can ask now without guessing at answers you haven't heard yet.

Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before computing the next round.

## Round format

```
❓ **Q1** - **<question title>**: <question body, can be multiple paragraphs with choices>
➡️ <your recommended answer>

❓ **Q2** - **<question title>**: <question body>
➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.

A question whose answer depends on another question still open in this round belongs to a later round, not this one.

## Your responsibilities

**Finding facts is your job, never the user's.** When a frontier question needs a fact from the environment (filesystem, codebase, tools), dispatch a subagent to find it. Don't ask the user for anything you could look up yourself.

Don't block the round on exploration: a running subagent is an unsettled prerequisite, so only downstream questions wait for its report. Ask the rest of the frontier now.

**The decisions are the user's.** Put each to them with your recommendation, then wait.

## When to stop

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed.

**Do not act on the plan until the user confirms you have reached a shared understanding.**

## Anti-patterns

- Asking one question at a time when multiple are ready (wastes rounds)
- Asking for facts you could discover yourself (filesystem, docs, code)
- Blocking the whole round on one fact-finding mission (ask the rest)
- Acting on the plan before confirmation (the output is the conversation, not implementation)
- Asking questions that depend on unsettled questions in the same round (breaks the frontier)

## When to use

- User says "grill me", "stress-test this", "poke holes in my plan"
- A high-stakes decision needs validation before implementation
- A design has many interdependent choices
- The user wants adversarial review, not agreement

## When not to use

- Lightweight brainstorming (too formal)
- Implementation debugging (use systematic-debugging instead)
- Plans already validated and ready to execute
- User wants quick feedback, not deep interrogation
