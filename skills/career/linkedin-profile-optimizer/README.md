# LinkedIn Profile Optimizer

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="linkedin-profile-optimizer robot" width="200">
</div>

Make a LinkedIn profile findable in the field scoped boolean searches recruiters actually run, and credible to the human who opens it afterwards.

## What it does

Treats the profile as a document with two readers in a fixed order: a query finds you, and only then does a person read the page. Most profiles are written entirely for the second reader, so the first one never fires and the second never arrives.

The skill works in four moves:

1. **Put keywords in fields, not only in prose.** LinkedIn Recruiter supports boolean operators and separate filters for job title, company, skills, school, and location. A title filter reads the title field on your Experience entries. A skills filter reads your Skills section. Neither reads your About paragraph. Words that live only in About can be invisible to a filtered search.
2. **Spend the headline.** The headline follows you into search results, comments, and connection requests, and LinkedIn auto fills it with "Job Title at Company" that most people never change. That default restates two facts already visible in the Experience section below.
3. **Use standard job titles.** A title filter matching `"Marketing Manager"` does not match `Growth Ninja`. The fix is to put the industry standard title first and the internal one beside it, so the filter hits and nothing is misrepresented.
4. **Verify from outside.** Check the logged out public URL, the mobile truncation of About, and your own row in a boolean People search, because the edit view shows you a page no one else sees.

Throughout, it separates what is observable (which fields exist, which are filterable, what each privacy setting states, what a logged out visitor sees) from what is inference (ranking weights, recency effects, how endorsements feed the skills filter). LinkedIn's ranking is proprietary and changes, so anything about weight is marked as inference rather than dressed up as fact. It cites no percentages, no study results, and no "recruiters spend N seconds" statistics, following [`truth-first`](../../research/truth-first/SKILL.md).

It is the networked sibling of [`latex-resume`](../latex-resume/SKILL.md). That skill is about surviving a parser that flattens a PDF you submitted. This one is about being retrieved by a query you never see, on a page you do not control the rendering of.

## When to use this

Use it when:

- Starting a job search and the profile has not been touched since the last one
- Getting no recruiter inbound despite relevant experience, which is usually a field placement problem rather than an experience problem
- Holding a cute internal job title (`Growth Ninja`, `Chief Happiness Officer`, `Member of Technical Staff IV`) that no external search will ever match
- Deciding how to set Open To Work while still employed, where the recruiter only flag and the public photo frame have different consequences
- Repositioning toward a different role or function, where the old keywords still dominate the page
- Auditing a profile before a hiring push, a conference talk, or a funding round, where peer credibility matters more than inbound volume

Skip it when:

- You are writing the resume itself. Use [`latex-resume`](../latex-resume/SKILL.md) for the document and its parser.
- You are not job seeking and not building a public reputation, in which case an accurate, quiet profile is fine.
- The real problem is the evidence rather than its placement. No field arrangement compensates for a profile with nothing specific in it.

## Quick start

A worked example. Pat has ten years on backend teams, currently owns the payments ledger at a marketplace, and gets no recruiter contact.

**Before.** The three fields that matter, as they stand:

```text
Headline:   Senior Engineer at Acme

About:      I am a passionate and results driven professional with a proven
            track record of delivering value in fast paced environments.
            Throughout my career I have worked across the stack and thrive on
            solving complex problems with great teams...

Experience: Member of Technical Staff IV
            Acme Corp, 2019 to present
            Responsible for various backend systems and working with
            cross functional partners.

Skills (pinned): Leadership, Communication, Microsoft Office
```

Diagnose it against the filters, not against taste:

- A recruiter filtering Title on `("Backend Engineer" OR "Senior Software Engineer")` gets nothing, because the title field says `Member of Technical Staff IV`.
- A recruiter filtering Skills on `Go AND Postgres` gets nothing, because neither word is in the Skills section.
- The headline restates the Experience entry and names no technology, so a general keyword search has nothing to match either.
- Everything above "see more" in About is true of any candidate alive.

**After.** Same facts, placed where they can be read:

```text
Headline:   Senior Backend Engineer | Distributed Systems, Go, Postgres |
            Payments infrastructure at scale

About:      I build payment systems that stay correct under load. Ten years on
            backend teams at two marketplaces, currently owning the ledger that
            settles about 40,000 orders a day.
            [see more]
            Most of my work is the unglamorous half of payments: idempotency,
            reconciliation, and the retry paths that decide whether a double
            charge reaches a customer. Open to staff level backend roles in
            payments or infrastructure, remote or London.

Experience: Senior Software Engineer (internal title: Member of Technical
            Staff IV)
            Acme Corp, 2019 to present
            Own the double entry ledger behind marketplace payouts: Go
            services on Postgres, settling roughly 40,000 orders a day.
            Led the migration from nightly batch settlement to streaming
            reconciliation.

Skills (pinned): Go, Postgres, Distributed Systems, Payments, Kubernetes
```

What changed, and why each change is defensible without knowing the ranking:

- The title field now carries a title a filter can match. The internal title is kept in the same line, so nothing is claimed that a reference check would contradict.
- The headline names role, domain, and stack, so a general keyword search has three handles instead of zero. It also reads as a description of a person rather than a slogan.
- The first two lines of About make a complete claim on their own, since that is all most visitors see before "see more".
- The pinned skills name the job Pat wants next rather than the ones with the most endorsements.
- The number in About and in the role description is one Pat can point at a dashboard for. That constraint comes from [`latex-resume`](../latex-resume/SKILL.md) and applies unchanged here.

Then verify from outside, which is the step people skip:

1. Open the public URL in a private window, logged out. Anything missing there is missing to search engines.
2. Open the profile on a phone and read where About truncates.
3. Run the query you think a recruiter would run in normal LinkedIn search with the People filter, for example `"Senior Software Engineer" AND "Payments"` with your location, and look for your own row.

## Key concepts

**Field scoped boolean search.** LinkedIn Recruiter supports `AND`, `OR`, `NOT`, quoted phrases, and parentheses, with separate filters for title, company, skills, school, location, and years in role, alongside a general keyword box. The filters read structured fields. This is the mechanism that makes placement matter more than eloquence.

**The headline as the travelling field.** It appears under your name and follows you into search results, comments, and connection requests, so it is the only field that works off your profile page. Its ranking weight is inference; its visibility is not.

**The two line About.** LinkedIn truncates About behind a "see more" link, and the cut point varies with device and window width. Design so the opening stands alone as a complete claim rather than counting characters.

**Standard title plus internal title.** Your employer's naming convention is not a search term anywhere outside your employer. Lead with the industry standard title, keep the internal one beside it, and never invent a level you did not hold.

**Skills as a filterable list.** Skills are structured data, which is why they can be filtered on. Pin the ones that name the job you want, use the exact strings from job postings, and remove ones that contradict your target. Endorsements are a weak tiebreaker with an unpublished mechanism, worth less than a recommendation someone had to write.

**Open To Work, two settings.** Recruiters only shares your interest with Recruiter users and adds no photo frame; LinkedIn states it cannot guarantee recruiters at your own employer will not see it. All LinkedIn members adds the green `#OpenToWork` frame visible to everyone, including your manager. Choose, rather than accept a default.

**Custom URL.** Editable under "Edit public profile & URL". Not a ranking trick. It exists so the link survives being typed onto a resume or read aloud, and so the version in your email signature matches.

**Recency as inference.** Update effects are undocumented. What is observable is that an updated profile carries current titles, and that posting puts you in your network's feed, producing inbound independent of any ranking.

**Recruiter inbound versus peer credibility.** These pull in opposite directions: dense keyword loading raises retrieval and lowers how you read to peers. Pick a primary reader, then keep the structured fields loaded for filters and the prose in a voice you would use out loud.

## Common pitfalls

**Keywords only in the About prose.**
Bad: About reads "I lead demand generation using HubSpot and Marketo" while Skills lists Leadership, Communication, Microsoft Office.
Good: `Demand Generation`, `HubSpot`, `Marketo` in the Skills section and in the role title or description, with the same story in About for the human.
Why: a skills filter reads the Skills section. Prose in About is not in the field the filter queries, so the search that describes your exact job returns nothing.

**Leaving the auto generated headline.**
Bad: `Senior Engineer at Acme`.
Good: `Senior Backend Engineer | Distributed Systems, Go, Postgres | Payments infrastructure at scale`.
Why: the default restates the Experience entry below it and names no domain or tool, so it spends your most visible and most travelled line on information the reader already has.

**A slogan instead of a headline.**
Bad: `Turning coffee into code | Dreamer | Builder`.
Good: `Backend Engineer | Go, Kubernetes | Building payment infrastructure`.
Why: it matches no query and, to a human, reads as filler where evidence was expected. It loses on both readers at once.

**The internal job title in the title field.**
Bad: `Growth Ninja`.
Good: `Marketing Manager (internal title: Growth Ninja)`.
Why: a title filter for `"Marketing Manager"` does the string match against your title field. A cute title makes a qualified person unsearchable for their own job.

**Inventing a senior title to widen matching.**
Bad: relabelling a Marketing Manager role as Director of Marketing because more searches hit Director.
Good: the real title, plus scope in the description: team size, budget, channels owned.
Why: it fails at the reference check, and one unravelled claim discredits the whole profile. Scope widens the human read without the risk.

**A generic About opening.**
Bad: "I am a passionate, results driven professional with a proven track record..."
Good: "I build payment systems that stay correct under load. Ten years on backend teams at two marketplaces, currently owning the ledger that settles about 40,000 orders a day."
Why: the opening is the only part many visitors see before "see more", and a sentence true of every candidate gives no one a reason to expand it.

**Pinning skills by endorsement count.**
Bad: pinning Leadership, Communication, and Teamwork because they have the most endorsements.
Good: pinning the skills that name the role you want next, for example Go, Postgres, Distributed Systems.
Why: the pinned set is the part visitors see without expanding, so it functions as positioning. Endorsement counts measure who clicked, not what you do now.

**Chasing endorsements through swaps.**
Bad: trading endorsements with strangers to inflate counts.
Good: asking three or four people who saw specific work for recommendations, reminding each which work.
Why: endorsing is one click by someone who may never have worked with you, so a human discounts it. A recommendation is attributed to a named profile and costs the writer effort, which is why it is weighed differently.

**Turning on the public Open To Work frame without deciding.**
Bad: enabling All LinkedIn members while employed, because it was the first option.
Good: choosing Recruiters only for a discreet search, and knowing LinkedIn does not guarantee your own employer's recruiters will not see it.
Why: the two settings have genuinely different audiences. The frame broadcasts to your whole network including your manager and your customers.

**Leaving the default URL and a restricted public profile.**
Bad: `/in/pat-lee-8a4b21739` on a resume, with public visibility switched off.
Good: a claimed custom URL, used identically in the resume header and email signature, with the public profile exposing the sections you want found.
Why: a hidden profile is invisible to search engines and to anyone not signed in, and an unreadable URL breaks the moment someone types it.

**Reviewing the profile in the edit view.**
Bad: publishing because the edit page looked right.
Good: the logged out private window, the phone, and your own boolean query in People search.
Why: the edit view shows every section expanded to an audience of one. It hides exactly the truncation and visibility failures you are trying to catch.

## See also

- [`latex-resume`](../latex-resume/SKILL.md) for the resume itself: designing for the ATS text layer, writing bullets as verb, work, result, and quantifying only from evidence. The evidence discipline carries over unchanged.
- [`truth-first`](../../research/truth-first/SKILL.md) for the rule this skill follows about separating verified mechanism from inferred ranking, and for why an unverifiable number is worse than no number.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) for the prose in About and in role descriptions: writing to a reader with a task rather than to an imagined audience.
