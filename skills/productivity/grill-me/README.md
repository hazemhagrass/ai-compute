# Grill Me

<!-- robot-banner -->
<div align="center">
<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcjNxOGRzYWxnYnN5dGEzNjVldGVvMzF0c2l5bTV1Zm5wNWJ2dGlmbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif" alt="AI skill robot" width="180" />
</div>

Stress-test any plan or design before you commit to it. Get interviewed relentlessly, branch by branch through the decision tree, until every blind spot is on the table.

## What it does

Maps your plan as a **design tree** where every decision branches into dependent decisions, then interviews you **round by round** through the frontier: questions you can answer now without guessing at prerequisites.

You get questions in batches (not one-at-a-time) with the AI's recommended answer attached. You make the final call, the tree updates, and the next round asks what that unblocked.

## When to use it

- **High-stakes decisions** that need validation before implementation
- Plans with **many interdependent choices** (service boundaries, data migration, rollback strategy)
- You want **adversarial review**, not nodding agreement
- Someone says "grill me", "stress-test this", "poke holes in my plan"

## When NOT to use it

- ❌ Lightweight brainstorming (too formal)
- ❌ Debugging implementation (use `systematic-debugging` instead)
- ❌ Plans already validated and ready to execute
- ❌ You want quick feedback, not deep interrogation

## How a session works

1. **You describe the plan** (or the AI reads context from files/notes)
2. **AI maps the decision tree** and identifies the frontier
3. **Round 1**: AI asks all questions whose prerequisites are settled, with recommended answers
4. **You answer** (accept recommendations or override)
5. **Frontier updates**: answered questions unblock new questions
6. **Round 2, 3, ...** until the frontier is empty
7. **Confirmation**: AI asks "have we reached shared understanding?"
8. **Done**: The output is the conversation itself, not implementation

## Example round

```
❓ **Q1** - **Service boundaries**: Should user auth be its own microservice or part of the API gateway?
➡️ Own microservice. Auth has distinct scaling needs and will need independent updates for compliance.

❓ **Q2** - **Data migration**: Migrate all at once or dual-write during transition?
➡️ Dual-write. One-shot migration risks extended downtime and doesn't allow rollback.

❓ **Q3** - **Timeline buffer**: What happens if the migration takes 4 months instead of 3?
➡️ Client has a hard deadline for Q3 compliance. Need explicit contingency: reduced scope or staged rollout.
```

You answer, the AI computes the next frontier (e.g., "If auth is separate, how do you handle session state?" only makes sense after Q1 is settled).

## Key concepts

### Design tree
Every decision branches into decisions that depend on it. "Use GraphQL" branches into "schema-first or code-first?", "client caching strategy", "resolver error handling", etc.

### Frontier
The set of questions you can honestly answer **right now**, without guessing at prerequisites. A question about "GraphQL schema versioning" isn't on the frontier until you've decided to use GraphQL.

### Round-based questioning
Ask the whole frontier at once (not one-at-a-time), wait for answers, recompute, repeat. Faster than 13 sequential turns.

### Fact-finding vs decisions
The AI looks up facts (filesystem, docs, code). You make decisions. If the AI asks "what's in `src/api/`?", it's broken the skill - it should explore the codebase itself.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| AI asks one question at a time | Remind it to ask the whole frontier in one round |
| AI asks for facts it could discover | "You can read the codebase/docs yourself" |
| AI acts on the plan before confirmation | "Stop. We haven't confirmed shared understanding yet." |
| Questions depend on other open questions in same round | That question belongs to the next round, not this one |
| Session ends too early | "The frontier isn't empty. What about X, Y, Z?" |

## Tips for better grilling sessions

1. **Start with stakes**: Tell the AI the cost of failure (prod outage? reversible? affects customers?)
2. **Bring context**: Point to docs, code, or notes so questions are specific, not generic MBA questions
3. **Push back on vague answers**: The AI should give concrete recommendations, not "it depends"
4. **Track resolved decisions**: Keep a checklist so you know what's settled and what's still open
5. **Time-box it**: A typical session is 30-45 minutes. If it's taking 2 hours, the plan is too big for one grill session.

## Output

The **conversation itself** is the deliverable. You walk away with:
- Every decision explicitly answered
- Hidden assumptions surfaced
- Dependencies between choices mapped out
- Shared understanding confirmed

No code is written during grilling. That comes after.
