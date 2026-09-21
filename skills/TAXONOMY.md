# Skill taxonomy

Categories are chosen so that no category exceeds roughly a dozen skills once
the planned backlog lands, and so that a reader looking for a skill has exactly
one obvious place to look.

A skill lives at `skills/<category>/<name>/SKILL.md`. Never nest deeper.

## Categories

| Category | Holds | Boundary against its nearest neighbour |
|---|---|---|
| `engineering` | Writing and changing production code: refactoring, debugging, testing, API and database design, performance. | Code craft. Anything about *shipping and running* the code is `devops`. |
| `security` | Finding and fixing vulnerabilities: authz, authn, input validation, crypto, dependencies, secrets. | Adversarial review. Non-adversarial review is `engineering/code-review`. |
| `devops` | Build, deploy, run, observe: containers, orchestration, pipelines. | Runtime and delivery, not source code. |
| `devtools` | The developer's own machine and loop: shell, multiplexer, dotfiles, environment repair, regex, code navigation. | Personal tooling. If it runs in CI it is `devops`. |
| `data` | Analysis and presentation of data: dataframes, analyst SQL, BI dashboards, visualisation. | Consuming data to answer a question. Designing the store is `engineering/database-design`. |
| `office` | Producing documents in office formats: Word, Excel, PowerPoint, Sheets. | The file format and its API. What to *say* in the document is `writing` or `design`. |
| `writing` | Prose for a reader: technical docs, blogs, newsletters, copy, summaries. | Words. Visual arrangement is `design`. |
| `content` | Produced media and its distribution: video, podcast, social, SEO. | Non-prose channels with an audience and a platform. |
| `research` | Finding and verifying what is true: literature, citations, papers, surveys, grants, web research. | Sourcing and evidence. |
| `career` | Representing yourself: resumes, profiles, cover letters, portfolios, interviews, negotiation. | |
| `design` | How a thing looks and feels to use: usability, accessibility, design systems, slides. | Visual and interaction craft. Implementation is `engineering/frontend-architecture`. |
| `workflow` | How work itself is organised: planning, specs, autonomous execution, meetings, email, learning. | Process, not artefact. |
| `finance` | Personal money: budgets, portfolios, retirement. | |
| `ai` | Working with models: prompting, model selection, agent SDKs. | |
| `homelab` | Self-hosted infrastructure at home. | |
| `meta` | Skills about this repository's own artefacts: authoring skills, generating READMEs. | |

## Rules

- **One obvious home per skill.** If a skill plausibly fits two categories, the
  table's boundary column decides it. Add a boundary note when a new ambiguity
  appears rather than leaving it to taste.
- **Split a category before it passes about a dozen skills.** A category that
  keeps growing has stopped describing anything.
- **Do not create a category for one skill.** Park it in the closest existing
  category until a second and third arrive.
- **Category names are plural-free and lowercase**, matching the directory name.
