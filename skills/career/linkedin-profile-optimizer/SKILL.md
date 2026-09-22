---
name: linkedin-profile-optimizer
description: Use when optimising a LinkedIn profile for search. Make it findable in recruiter field search and credible to the human who opens it.
---

# LinkedIn Profile Optimizer

A LinkedIn profile is read twice, like a resume, but the order is reversed. A
query finds you first, and only then does a person open the page. Most profiles
are written entirely for the second reader, so the first one never fires.

## Separate what is documented from what is guessed

LinkedIn's ranking is proprietary, undocumented, and changes without notice. Any
claim about how much a field is "weighted" is inference, including the inferences
in this skill. Hold the line between these two categories:

- Observable and documented: which fields exist, which fields a recruiter can
  filter on, character limits enforced by the editor, what each privacy setting
  says it does, what your public profile shows when logged out.
- Inference, and labelled as such here: which fields matter most for ranking,
  how recency affects surfacing, how endorsements feed the skills filter.

Two consequences. First, verify limits in the editor rather than trusting a
number from a blog post, including the numbers below: LinkedIn has raised the
headline limit before and can do it again. Second, prefer changes that are true
regardless of ranking. A real job title in the title field helps because a title
filter reads that field at all, not because of a weight you cannot see.

## Recruiter search is field scoped, so keywords must live in fields

LinkedIn Recruiter (the paid product most in-house and agency recruiters use)
supports boolean operators (`AND`, `OR`, `NOT`, quoted phrases, parentheses) and
separate filters for job title, company, skills, school, location, and years in
role, alongside a general keyword box. A typical search looks like this:

```text
Title:    ("Marketing Manager" OR "Growth Marketing Manager") NOT intern
Skills:   "Demand Generation" AND ("HubSpot" OR "Marketo")
Location: Greater London
```

A title filter reads the title field on your Experience entries. A skills filter
reads your Skills section. Neither reads your About paragraph. This is the single
most useful thing to understand: prose that is only in About can be invisible to
a filtered search even though the words are on your page.

```text
Bad:  About says "I lead demand generation using HubSpot and Marketo."
      Skills section lists: Leadership, Communication, Microsoft Office.
      Title field says: Growth Ninja.
      A filtered search for the exact job it describes returns nothing.

Good: Title field: Marketing Manager (internally "Growth Ninja")
      Skills: Demand Generation, HubSpot, Marketo, Marketing Automation
      About: the same story in prose, for the human who arrives later.
```

Write the keyword list first, from three or four live job postings for the role
you want, then place each keyword in the field a recruiter would filter on. The
prose comes after.

## Spend the headline on the search, not on your job title

The headline sits under your name and travels with you into search results,
comments, and connection requests, so it is the one field that follows you off
your profile. LinkedIn also auto fills it with "Job Title at Company" and most
people never change it, which spends the most visible line on the page
restating two facts that are already in the Experience section below.

Inference, not documented: the headline appears to carry meaningful weight in
keyword matching. Treat it as a field worth loading regardless, because even if
its ranking weight were zero it is the line a human reads before deciding to
click.

The editor currently allows a long headline (on the order of two hundred
characters; check what it lets you type rather than trusting that figure). Use
the room for role, specialism, and stack or domain.

```text
Bad:  Senior Engineer at Acme
      Wastes the field, matches only one title, says nothing about domain.

Good: Senior Backend Engineer | Distributed Systems, Go, Postgres |
      Payments infrastructure at scale
```

- Lead with the standard title someone would search for, not an aspiration.
- Add the variants you would answer to, if they are honest ones.
- Name tools and domain, because those are what a keyword search contains.
- Avoid pure slogans ("Turning coffee into code"). They match nothing and read
  as filler to a human too.

## Write the About section for the two lines shown before "see more"

The About section is truncated in the feed and on the profile: visitors see an
opening fragment and a "see more" link, and only some of them expand it. The
exact cut point depends on device and window width, so do not design to a
character count. Design so that the first two lines stand alone as a complete
claim, and check the cut on a phone.

```text
Bad:  "I am a passionate and results driven professional with a proven track
      record of delivering value in fast paced environments. Throughout my
      career I have..."
      Everything above "see more" is true of anyone.

Good: "I build payment systems that stay correct under load. Ten years on
      backend teams at two marketplaces, currently owning the ledger that
      settles about 40,000 orders a day.
      [see more]"
```

Below the fold, write the longer version: what you work on, what you want next,
how to reach you. The field holds a few thousand characters, which is more than
you should use. Keep the same evidence discipline as a resume bullet: name the
thing, and do not cite a number you could not defend in an interview. See
[`latex-resume`](../latex-resume/SKILL.md) for that discipline in full, and
[`truth-first`](../../research/truth-first/SKILL.md) for the general rule.

## Put the real job title in the title field and the internal one beside it

Internal titles are the most common self inflicted invisibility. A title filter
matching `"Marketing Manager"` does not match `Growth Ninja`, `Customer Happiness
Hero`, or a levelled internal code like `IC4`. Your employer's naming convention
is not a search term anywhere outside your employer.

Put the industry standard title first so the filter hits, then keep the internal
title in the same field or the description so nothing is misrepresented.

```text
Bad:  Growth Ninja
      Chief Happiness Officer
      Member of Technical Staff IV

Good: Marketing Manager (internal title: Growth Ninja)
      Head of People Operations (internal title: Chief Happiness Officer)
      Senior Software Engineer (Member of Technical Staff IV)
```

- Never invent a level you did not hold. Renaming the same job is honest;
  promoting yourself is a reference check failure.
- Split genuinely different roles at one employer into separate entries, so each
  title is searchable and the progression is visible.
- Repeat the core keywords in the role description, since a general keyword
  search does read that text even when a title filter would not.

## Order the skills list for the filter, and treat endorsements as a tiebreaker

The Skills section is a structured list, which is why recruiters can filter on
it. LinkedIn caps the number of skills (currently around fifty; check the
editor) and lets you pin a few to the top of the section, which is the part
visitors see without expanding.

- Pin the skills that name the job you want, not the ones you have most
  endorsements for. The pinned set is a positioning statement.
- Prefer the exact terms used in job postings. `Kubernetes` and `Container
  Orchestration` are not the same string to a boolean query.
- Remove skills that contradict your target role. A backend profile carrying
  `Adobe Photoshop` from a student job dilutes the human read.
- Attach skills to specific roles where the editor allows it, so the claim is
  anchored to a job rather than floating.

Endorsements: inference, since the mechanism is not published. A skill with many
endorsements plausibly ranks or displays better than a bare one, and endorsement
counts are visible to anyone, so they act as light social proof. They are weak
evidence, because endorsing is one click by someone who may never have worked
with you. Do not run endorsement swap campaigns; spend the effort on
recommendations instead, which cost the writer something.

## Set Open To Work deliberately, because the two settings differ

Open To Work has two distinct visibility choices, and they are often confused:

- Recruiters only: your interest is shared with LinkedIn members using
  Recruiter, and no `#OpenToWork` frame appears on your photo. LinkedIn states
  it cannot guarantee that recruiters at your own employer will not see it, so
  treat it as discreet, not secret.
- All LinkedIn members: adds the green `#OpenToWork` photo frame, visible to
  everyone including colleagues, your manager, and customers.

Neither is wrong. The public frame is a broadcast that reaches your network and
signals availability without a recruiter licence; it also tells your current
employer. The recruiter only flag is the quieter option for anyone still
employed. Decide which you are choosing rather than accepting a default, and
fill in the role titles and locations in the same panel, since those are what
the availability filter reads.

## Claim the custom URL

The public profile URL is editable ("Edit public profile & URL"), turning a
default like `/in/pat-lee-8a4b21739` into `/in/patlee`. This is not a ranking
trick; it is so the link survives being typed onto a resume, read aloud, or
pasted into an email. Claim it once, then use that URL everywhere so the version
in your resume header and your email signature match.

While in that panel, check which sections your public (logged out) profile
exposes. A profile hidden from non members is invisible to search engines and to
anyone who has not signed in.

## Keep the profile recent, and accept that this part is inference

Recency effects are not documented, so mark this as inference throughout. What is
observable: profiles that have been updated recently carry current titles, and
people who post or comment appear in the feeds of their network, which produces
inbound independent of any ranking.

A defensible cadence, offered as judgement rather than as a measured result:

- Update the current role's description when what you do changes, not annually.
- Comment where you actually have something to add. A thin comment on a viral
  post is visible to the wrong people.
- Post occasionally about work you can describe publicly. Consistency beats
  volume, and nothing is better than an inactive profile with a strong headline.

Avoid engagement tactics that trade credibility for reach, such as "comment
INTERESTED and I will DM you". They can work on volume and they cost you exactly
the peer audience the next section is about.

## Collect recommendations, the one section you cannot write yourself

Everything else on the profile is self reported. Recommendations are attributed
to a named person with their own profile attached, which is why a human reader
weighs them differently. Three or four specific ones beat a dozen generic ones.

- Ask people who saw a specific piece of work, and remind them which piece.
- Give the writer something to work from: the project, the timeframe, what you
  did. An unprompted request usually returns a paragraph of adjectives.
- Spread them across employers and across relationships: a manager, a peer, a
  report, a customer. One perspective repeated reads as a single opinion.

## Decide which reader you are optimising for

Recruiter inbound and peer credibility pull in different directions, and the
tension is real rather than something to write around.

| | Recruiter inbound | Peer credibility |
| --- | --- | --- |
| Headline | Dense with searchable role terms | Specific and plain |
| Skills | Broad, every plausible variant | Narrow and honest |
| Activity | Volume and visibility | Substance, whatever the reach |
| Risk | Reads as keyword stuffed to peers | Unfindable by filters |

Pick a primary reader. Someone actively job hunting should take the search side
and accept a keyword heavy headline. Someone building a reputation in a field,
or hiring into their own team, should take the credibility side. A workable
compromise is to keep the Skills and title fields fully loaded for the filters,
and keep the headline and About in a voice you would use out loud.

## Give the photo and banner the small job they can do

Neither is searchable, and neither earns attention on its own. They set whether
the page looks maintained.

- Photo: recent, your face filling most of the frame, in focus, with a plain
  background. Not a group crop, not a wedding photo, not a logo.
- Banner: the default blue tells the reader nothing. Replace it with something
  plain: your company, your work, a city, or a solid colour. Do not put small
  text in it, since it crops differently on mobile.
- Keep the photo visible to all LinkedIn members, or to everyone if you want the
  logged out view to work. A hidden photo makes a real profile look abandoned.

## Check the profile the way other people receive it

You never see your own profile as anyone else does, because you see the edit
view with every section expanded. Check the three views that matter:

1. Logged out: open your public URL in a private window. Whatever is missing
   there is missing to search engines and to anyone not signed in.
2. On a phone: the mobile app decides where About truncates and how much of the
   headline shows. This is where a headline written for a desktop width breaks.
3. As a search result: you cannot see Recruiter without a licence, but you can
   approximate it. Run the boolean query you think a recruiter would run
   (`"Marketing Manager" AND "Demand Generation"` plus your location) in the
   normal LinkedIn search with the People filter, and check whether you appear
   and how your headline reads in the results list.

Bad: publishing the rewrite because the edit page looked right.

Good: opening the public URL logged out, confirming the first two lines of About
stand alone on a phone, then running your own boolean query and finding your
own row in the results.
