# Survey Design

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="survey-design robot" width="200">
</div>

Build a questionnaire that measures what you think it measures, from the decision it informs down to the wording of each option.

## What it does

Turns "let's ask people" into an instrument whose answers are interpretable. The skill applies rules across five stages:

1. **Decide first.** The decision, its owner, and the result that would change it get written down before question one exists. Every drafted question then faces one test: if this answer came back at either extreme, what would we do differently? No answer means cut the question.
2. **Write questions that can be answered.** Leading and loaded stems, double-barrelled items, vague quantifiers, double negatives, and overlapping response options each get a named repair with the reason attached.
3. **Build scales that mean the same thing to everyone.** Every point labelled rather than only the ends, odd versus even chosen deliberately, and "Don't know" living outside the scale rather than hiding in the midpoint.
4. **Design against the respondent's biases.** Acquiescence, social desirability, order effects and priming, demographics placed last and asked only when they cut a decision.
5. **Get answers from a definable group.** Sampling frame and coverage error, why a convenience sample does not generalise at any sample size, nonresponse bias as the main threat, incentives and what they buy, consent and retention, and a pilot with real respondents as the single highest-value step.

It separates attitude questions from behaviour questions throughout, because self-reported behaviour is filtered through recall and self-presentation, and the skill insists it be reported as self-report rather than as behaviour.

The skill stops at the point responses arrive. Analysis of those responses belongs to [`research-data-analysis`](../research-data-analysis/SKILL.md); claims made from the results are governed by [`truth-first`](../truth-first/SKILL.md).

## When to use this

Use it when:

- Writing a customer, employee, user research, or academic questionnaire
- Reviewing someone else's draft survey before it goes out, especially one that reads fine
- Judging whether an existing survey's results support the claim being made from them
- Deciding whether a survey is even the right instrument, or whether logs already hold the answer
- Turning a stakeholder's "we should survey users" into something with a decision attached

Skip it when:

- Running unstructured interviews or open discovery, where comparing answers is not the point
- The question is answerable from logs, records, or documentation, which beats self-report
- The responses are already collected and the task is analysing them

## Quick start

**The vague goal:** "We want to know how people feel about our docs."

**Step 1, name the decision.** The docs team has one quarter and two options: rewrite the getting-started guide, or build a search index across the whole site. A result that would move them: if most people who failed to find something were browsing rather than searching, rewrite; if they searched and got nothing useful, build search.

That reframes the goal into a measurable one: among people who looked something up in the docs recently, what did they do, and did it work?

**Step 2, draft and reject.**

Rejected draft A: "How satisfied are you with our documentation?"
Rejected because satisfaction does not distinguish the two options. Both a rewrite and a search index would raise it, so any answer leaves the decision exactly where it started.

Rejected draft B: "Do you find the docs clear and easy to search?"
Rejected as double-barrelled: clear and searchable are the two competing hypotheses, and a single "No" cannot tell them apart. This is the question the whole survey exists to split.

Rejected draft C: "How often do you use the docs?" (Never / Rarely / Sometimes / Often)
Rejected because "often" is not a unit. Replaced with a counted question over a named window.

**Step 3, the finished instrument.** Five questions, roughly one minute.

1. In the last 30 days, about how many times did you look something up in the docs?
   (0 / 1-2 / 3-5 / 6-10 / More than 10)
   *If 0, skip to Q5.*

2. Thinking of the most recent time, how did you start looking?
   (Used the site search / Used a search engine / Browsed the navigation / Followed a link from somewhere else / Asked a person or a chat tool / Don't remember)

3. Did you find what you needed that time?
   (Yes, quickly / Yes, but it took a while / Partly / No / Don't remember)

4. If it took a while or you did not find it, what were you trying to do?
   (Open text, optional)

5. What is the single biggest problem you have with the documentation?
   (Open text, optional)

Then, optional and last: role, and how long they have used the product, because the docs team would act differently for newcomers than for long-term users. Nothing else, because nothing else cuts this decision.

**Step 4, the tabulation, sketched before sending.** A cross-tab of Q2 by Q3: starting method against outcome. If "Used the site search" plus "No" is the largest cell, build search. If "Browsed the navigation" plus "No" is, rewrite the guide. Sketching this with fake numbers is what proves the instrument can answer the question.

**Step 5, pilot.** Five real users, watched, thinking aloud. Typical catches at this stage: someone counts a search engine hit that landed on the docs as "Used the site search", which means Q2's options need an example each.

## Key concepts

- **Decision-first design.** A survey without a named decision produces a report nobody reads. The decision is also the arbiter for every wording argument that follows.
- **Double-barrelled question.** Two questions, one answer slot, no interpretable result. The tell is "and" or "or" inside the stem.
- **Leading and loaded.** A leading stem supplies the answer; a loaded stem asserts a premise the respondent never accepted. Both produce data that reflects the author.
- **Attitude versus behaviour.** Surveys measure attitudes directly and behaviour only through self-report. Bound behaviour questions to a named recent window, prefer logs where they exist, and report self-report as self-report.
- **Fully labelled scale.** Every point gets words. Bare numbers get read as school grades or star ratings, differently per person.
- **Odd versus even points.** Odd keeps a true midpoint for topics where neutrality is real; even forces a side where the midpoint is only an exit. Either way, "Don't know" sits outside the scale, because no opinion and a middling opinion are different states.
- **Acquiescence bias.** The pull toward agreeing with whatever a statement asserts. Item-specific scales dodge it; agree/disagree batteries invite it.
- **Social desirability bias.** Over-reporting the admirable, under-reporting the awkward, stronger when respondents feel identifiable. Anonymity and a normalising stem reduce it.
- **Order effects and priming.** Earlier questions shape later answers. General before specific, sensitive and demographic questions late, item order randomised within batteries.
- **Sampling frame and coverage error.** The frame is the list you can actually reach; coverage error is its gap from the population you want to describe. It is a property of the frame, not of the sample size.
- **Nonresponse bias.** Whether non-responders differ from responders on the thing being measured. It leaves no trace in the data, which is why it quietly destroys more surveys than bad wording does.
- **The pilot.** Five to ten real respondents, watched, thinking aloud. It catches ambiguity that no amount of desk review finds, because you see the hesitation.

## Common pitfalls

**Writing questions before naming the decision.**
Bad: "Let's survey users about their experience with the product."
Good: "Decision: offline mode or search next quarter. A result that moves it: more than a third of weekly users report losing work to connectivity in the last month."
Reason: with no decision, no question can be cut and no wording dispute can be settled, so the survey grows until nobody finishes it and nobody reads the report.

**Loaded framing that asserts the finding.**
Bad: "How has the new policy improved your workflow?"
Good: "Since the new policy took effect, has your workflow become easier, stayed about the same, or become harder?"
Reason: the bad version presupposes improvement, leaving anyone whose workflow got worse with nowhere to put that.

**Two questions in one slot.**
Bad: "How satisfied are you with the speed and reliability of the service?"
Good: separate items for speed and for reliability on the same labelled scale.
Reason: fast-but-flaky and slow-but-solid produce identical middling answers, and they call for opposite fixes.

**Vague frequency scales.**
Bad: "How often do you use the platform?" (Never / Rarely / Sometimes / Often / Always)
Good: "In the last 7 days, on how many days did you open the app?" (0 / 1-2 / 3-4 / 5-6 / 7)
Reason: "often" means weekly to one respondent and hourly to another, so the scale measures vocabulary rather than behaviour.

**Overlapping response bands.**
Bad: (Less than 1 year / 1-3 years / 3-5 years / More than 5 years)
Good: (Less than 1 year / 1 to under 3 years / 3 to under 5 years / 5 years or more)
Reason: "3 years" fits two buckets, so respondents split arbitrarily and the boundary counts become noise.

**Numbers-only scale endpoints.**
Bad: "Rate your satisfaction 1 to 5 (1 = very unsatisfied, 5 = very satisfied)."
Good: Very dissatisfied / Dissatisfied / Neither satisfied nor dissatisfied / Satisfied / Very satisfied.
Reason: unlabelled middle points are filled in by each respondent's own reference frame, so the steps are not the same size across people.

**Merging "neutral" with "no opinion".**
Bad: a 5-point agree/disagree scale as the only option for a policy most respondents have never encountered.
Good: the same scale plus a separate "Don't know / Not applicable" outside it.
Reason: without the escape hatch, people with no view pick the midpoint, and real neutrality becomes indistinguishable from ignorance.

**Agree/disagree batteries.**
Bad: "The support team is responsive." (Strongly agree ... Strongly disagree)
Good: "How would you rate the support team's response time?" (Much slower than I need / Somewhat slower than I need / About right / Faster than I need)
Reason: agreement pressure attaches to any asserted statement; an item-specific scale gives it nothing to attach to.

**Yes/no questions on things people would rather not admit.**
Bad: "Do you follow the code review checklist on every pull request?" (Yes / No)
Good: "Teams use the checklist to different degrees. In the last 10 pull requests you reviewed, on roughly how many did you use it?" (0-2 / 3-5 / 6-8 / 9-10 / Not sure)
Reason: a yes/no invites a self-verdict rather than a report; normalising the stem and asking for a count gets an answer people will actually give.

**Mandatory, binary demographics at the top.**
Bad: "Gender: Male / Female" (required, question 1)
Good: at the end, optional: Woman / Man / Non-binary / Prefer to self-describe / Prefer not to say.
Reason: a forced binary excludes real respondents and turns submitting into a fight; up front, identity questions prime everything after them and cost completions.

**Treating stated intention as behaviour.**
Bad: "Would you pay for this feature?" (Yes / No)
Good: "In the last 12 months, have you paid for any tool that does this?" plus a likelihood question at a named price.
Reason: intent to buy costs nothing to declare; past paid behaviour is evidence, and a named price at least makes the attitude measurable.

**Asking everyone about features only some have used.**
Bad: "How would you rate the export feature?" shown to all respondents.
Good: "Have you used the export feature?" (Yes / No / Not sure), with the rating shown only on Yes.
Reason: respondents forced past an inapplicable question supply filler, and filler is indistinguishable from data.

**Reporting a convenience sample as a population estimate.**
Bad: "A survey of 4,200 users found 78% want dark mode."
Good: "Of 4,200 respondents recruited from our Discord and social media, 78% want dark mode. Respondents self-selected and skew toward highly engaged users."
Reason: sample size fixes noise, not a biased frame; a large convenience sample is a precise estimate about a group you cannot define.

**Reporting a response rate and stopping there.**
Bad: "We had a 22% response rate, which is healthy for our industry."
Good: "22% responded. Responders skew toward the enterprise tier (61% of responses versus 38% of the frame), and late responders rated support lower than early ones, so the true average is likely below what is reported here."
Reason: the rate alone says nothing; what matters is whether non-responders differ on the measured thing, and responder composition plus the early/late comparison are the only signals you have about that.

**Shipping without a pilot.**
Bad: three colleagues proofread the draft and it went out.
Good: five target respondents filled it in while you watched and thought aloud.
Reason: review catches typos, and watching catches ambiguity, because the hesitation before an answer is the only visible symptom of a question that can be read two ways.

## See also

- [`research-data-analysis`](../research-data-analysis/SKILL.md) owns everything after the responses land: cleaning, ordinal scales, subgroup comparisons, and uncertainty.
- [`truth-first`](../truth-first/SKILL.md) governs the claims you make from the results, including the rule against citing a number you cannot trace.
- [`literature-review`](../literature-review/SKILL.md) for finding validated instruments already in use, so you adapt a measured scale rather than inventing one.
- [`data-visualization-principles`](../../data/data-visualization-principles/SKILL.md) for showing distributions and scale results without flattening them into a misleading average.
- [`technical-writing`](../../writing/technical-writing/SKILL.md) for the survey invitation, the consent notice, and the write-up.
- [`accessibility-audit`](../../design/accessibility-audit/SKILL.md) for the survey form itself, since an inaccessible instrument excludes respondents and becomes a coverage problem.
