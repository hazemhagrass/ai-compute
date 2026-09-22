---
name: survey-design
description: Use when writing a survey or questionnaire. Design an instrument that measures what you think it measures.
---

Name the decision before writing question one. A survey with no decision attached produces a report nobody reads, and every argument about wording becomes unresolvable because there is no standard to resolve it against.

This skill covers instrument design and data collection: what you ask, whom you ask, and how you get answers back. Analysis of the responses belongs to [`research-data-analysis`](../research-data-analysis/SKILL.md). Claims made from the results are governed by [`truth-first`](../truth-first/SKILL.md).

## Before any question exists

### 1. Write the decision, then the questions that change it

Fix on paper: the decision, who makes it, the options on the table, and what result would move them. Then write only questions whose answers could move that decision.

**Bad:** "Let's survey users about their experience with the product."

**Good:** "Decision: whether to build offline mode next quarter or spend that team on search. Owner: product lead. A survey result that shifts the decision: more than a third of weekly users report losing work to connectivity in the last month. Questions must therefore measure recent connectivity-related loss, not general satisfaction."

Test every drafted question: "if the answer came back at either extreme, what would we do differently?" No answer, cut the question. This test alone removes most of a typical draft, and shortening the survey is itself a design win (rule 17).

### 2. Write the tabulation before you collect

Sketch the exact table or chart each question will produce, with fake numbers in it. This catches questions whose answers cannot be tabulated, response options that overlap, and scales that cannot be compared across groups. Fixing it in the sketch costs minutes; fixing it after collection costs the whole round.

## Question wording

### 3. Kill leading and loaded questions

A leading question supplies the answer. A loaded question smuggles in an assumption the respondent never agreed to.

**Bad:** "How much did you enjoy our new streamlined checkout?"
**Good:** "Compared with the previous checkout, how easy or difficult was this one to complete?" with a labelled scale from much easier to much more difficult.
**Reason:** "enjoy" presumes enjoyment and offers no route to "I did not"; "streamlined" is the company's own claim presented as fact. The repair offers both directions symmetrically.

**Bad:** "Don't you agree that the documentation needs improvement?"
**Good:** "How would you rate the documentation?" with a labelled scale from very poor to very good.
**Reason:** "Don't you agree" makes disagreement socially awkward and names the conclusion.

**Bad:** "Should the company stop wasting money on redundant tooling?"
**Good:** "In your view, is the current tooling budget too low, about right, or too high?"
**Reason:** "wasting" and "redundant" are the finding, asserted inside the question.

**Bad:** "How has the new policy improved your workflow?"
**Good:** "Since the new policy took effect, has your workflow become easier, stayed about the same, or become harder?"
**Reason:** the bad version presupposes improvement, so anyone who got worse has nowhere to go.

### 4. Split double-barrelled questions

A double-barrelled question asks two things and accepts one answer, so no answer is interpretable. The tell is "and" or "or" inside the stem.

**Bad:** "How satisfied are you with the speed and reliability of the service?"
**Good:** two questions, one on speed and one on reliability, each on the same labelled scale.
**Reason:** a fast but flaky service and a slow but solid one produce the same middling response, and you cannot tell which you have.

**Bad:** "Do you find the onboarding documentation clear and complete?" (Yes / No)
**Good:** "Was the onboarding documentation clear?" and "Did the onboarding documentation cover everything you needed?"
**Reason:** "No" could mean unclear, incomplete, or both, and those imply different fixes.

**Bad:** "Would you recommend this tool to colleagues and use it again yourself?"
**Good:** split into recommendation and repeat use.
**Reason:** these diverge often, for example among people who found it useful once for a task they will not repeat.

### 5. Use words every respondent reads identically

Cut jargon, internal product names, vague quantifiers, and negations.

**Bad:** "How often do you use the platform?" (Never / Rarely / Sometimes / Often / Always)
**Good:** "In the last 7 days, on how many days did you open the app?" (0 / 1-2 / 3-4 / 5-6 / 7)
**Reason:** "often" means weekly to one person and hourly to another, so the vague scale measures vocabulary, not behaviour. Named counts and a fixed window are comparable across people.

**Bad:** "I would not describe the process as unhelpful." (Agree / Disagree)
**Good:** "How helpful or unhelpful was the process?" on a labelled scale.
**Reason:** double negatives are misread under time pressure, and misreads look like real answers.

### 6. Make response options exhaustive and mutually exclusive

**Bad:** "How long have you used the product?" (Less than 1 year / 1-3 years / 3-5 years / More than 5 years)
**Good:** (Less than 1 year / 1 to under 3 years / 3 to under 5 years / 5 years or more)
**Reason:** the bad version makes "3 years" fit two buckets, so respondents split arbitrarily and the boundary counts are noise.

Add an explicit escape hatch where one is plausible: "Not applicable", "Don't know", or "Prefer not to say". Without one, people who genuinely have no answer pick something, and invented answers are indistinguishable from real ones.

## Attitudes versus behaviour

### 7. Do not read self-reported behaviour as behaviour

An attitude question asks what someone thinks or prefers. A behaviour question asks what they did. Only the attitude question is measuring its target directly: self-reported behaviour is filtered through recall, estimation, and self-presentation, and the gap runs predictably toward the flattering direction.

Where instrumentation, logs, or records exist, use them for behaviour and reserve the survey for reasons, preferences, and perceptions, the things no log contains.

**Bad:** "How many hours per week do you spend on code review?"
**Good:** "Thinking about last week specifically, roughly how many hours did you spend on code review?" (None / Under 1 / 1 to 3 / 4 to 7 / 8 or more / Not sure), and cross-check against review timestamps where available.
**Reason:** "per week" invites an idealised typical week. A named recent window narrows the recall task, and the explicit "Not sure" keeps guesses out of the data.

**Bad:** "Would you pay for this feature?" (Yes / No)
**Good:** "In the last 12 months, have you paid for any tool that does this?" plus "If this feature cost 20 per month, how likely would you be to buy it?" on a labelled likelihood scale.
**Reason:** stated intention to buy is an attitude wearing behaviour's clothes. Past paid behaviour is evidence; intention at a named price is at least a measurable attitude.

Report accordingly. "Respondents reported spending about 6 hours" is defensible. "Respondents spend 6 hours" is not.

## Scales

### 8. Label every point, not only the ends

**Bad:** "Rate your satisfaction: 1 2 3 4 5 (1 = very unsatisfied, 5 = very satisfied)"
**Good:** Very dissatisfied / Dissatisfied / Neither satisfied nor dissatisfied / Satisfied / Very satisfied
**Reason:** bare numbers get interpreted like school grades or star ratings, differently per respondent and per culture. Fully labelled points define the same steps for everyone and make the results readable without a legend.

Keep the scale's spacing verbally even, keep the positive and negative sides symmetric, and keep direction and point count identical across the whole instrument so respondents do not have to relearn the scale mid-survey.

### 9. Choose odd or even points deliberately

An odd count (5 or 7) includes a true midpoint. An even count (4 or 6) forces a side.

- Use odd when neutrality is a real, meaningful position, for example an opinion on something many respondents have not formed a view about. Removing the midpoint there pushes genuine neutrals into a direction they do not hold.
- Use even when everyone has a side and the midpoint is mainly used as an exit, for example rating an experience they just had.
- Either way, add a separate "Don't know" or "Not applicable" option outside the scale. A midpoint and an absent opinion are different states, and merging them destroys both.

Five to seven labelled points is the usual working range. Below five the scale is coarse; above seven the labels stop being distinguishable in words.

### 10. Do not average an ordinal scale without saying so

Scale points are ordered, but the distance between "Satisfied" and "Very satisfied" is not known to equal the distance between "Neutral" and "Satisfied". Report distributions, or top-two and bottom-two boxes, and treat any mean as a summary convention rather than a measurement. See [`research-data-analysis`](../research-data-analysis/SKILL.md) for how to handle this in the analysis.

## Bias from the respondent

### 11. Counter acquiescence bias

Acquiescence is the tendency to agree with a statement as presented, independent of its content. Agree/disagree batteries are its natural habitat.

**Bad:** "The support team is responsive." (Strongly agree ... Strongly disagree)
**Good:** "How would you rate the support team's response time?" (Much slower than I need / Somewhat slower than I need / About right / Faster than I need)
**Reason:** an item-specific scale asks about the construct directly, so agreement pressure has nothing to attach to.

Where an agree/disagree battery is unavoidable, do not repair it by flipping half the items into negative phrasing: reverse-worded items pick up their own error from misreads. Prefer converting the items to item-specific scales.

### 12. Counter social desirability bias

People over-report the admirable and under-report the awkward, more strongly when they feel identifiable.

- Say plainly whether responses are anonymous, confidential (identity known, not reported) or identified. Guarantee only what the collection setup actually delivers; a "fully anonymous" survey with an email field in it is a false statement that respondents notice.
- Normalise the awkward answer in the stem.
- Avoid asking sensitive questions alongside anything that re-identifies a small group, such as team plus tenure plus role in a 30-person company.

**Bad:** "Do you follow the code review checklist on every pull request?" (Yes / No)
**Good:** "Teams use the review checklist to different degrees. In the last 10 pull requests you reviewed, on roughly how many did you use the checklist?" (0-2 / 3-5 / 6-8 / 9-10 / Not sure)
**Reason:** the stem licenses the unflattering answer, and the count replaces a yes/no self-verdict with an estimate people will actually give.

### 13. Control order effects and priming

Earlier questions shape later ones. A battery of specific complaints before an overall rating drags the overall rating down; a warm question about a favourite feature drags it up.

- Ask general or overall questions before specific ones on the same topic.
- Keep sensitive and demographic questions late (rule 14), so an early identity question does not colour everything after it.
- Randomise the order of items within a battery, and of response options in long unordered lists, where the tool supports it. Do not randomise ordered scales.
- Keep related items grouped so the instrument reads coherently, and change topic with a short heading rather than by surprise.

### 14. Put demographics last, ask only what changes a decision

Demographic questions at the top feel like screening and cost you responses. Placed at the end, they are answered by people already invested.

Ask a demographic question only when you would cut the data by it and act differently on the result. Every unused demographic is retention risk and a re-identification vector for nothing.

**Bad:** "Gender: Male / Female" (required)
**Good:** "Gender (optional): Woman / Man / Non-binary / Prefer to self-describe: ____ / Prefer not to say"
**Reason:** a forced binary excludes real respondents and makes the rest of their answers a fight to submit. Optional, inclusive, self-describe, and a decline option keep people in the survey.

**Bad:** "Age: ____" (required)
**Good:** "Age group (optional): Under 25 / 25-34 / 35-44 / 45-54 / 55-64 / 65 or over / Prefer not to say"
**Reason:** exact age is more precise than any decision needs and more identifying than most respondents will accept. Collect the coarsest form that still cuts the data.

## Structure and flow

### 15. Screen early, branch with skip logic

Put eligibility screeners at the very start and end the survey politely for people who do not qualify, so you do not pay for or analyse irrelevant responses.

Use skip logic to keep every respondent on questions that apply to them. Never ask about a feature someone just said they have never used: irrelevant questions produce filler answers and teach respondents that the survey is not listening.

**Bad:** "How would you rate the export feature?" asked of all respondents, with no option for non-users.
**Good:** "Have you used the export feature?" (Yes / No / Not sure) and show the rating only on Yes.

Test every branch before launch, including the disqualification path and the path where someone answers "No" to everything. A broken branch that dead-ends is silent data loss.

### 16. Use closed questions for measurement and open questions sparingly

Closed questions are countable, comparable, and cheap to answer. Open text is where you find the thing you did not know to ask about, and it costs real analyst time to code into categories.

Practical pattern: closed questions carry the measurement, and one or two open questions sit at the end, for example "What is the single biggest problem you have with X?" and "Anything else we should have asked?" Budget the coding time before you add a third, and never make open text mandatory.

Open text is also a privacy hazard: respondents put names, incidents, and their own identity into it. Plan for that in retention (rule 22).

### 17. Keep it short, and let length be a design constraint

Fatigue shows up as straight-lining down a column, dropping detail in open text, and abandonment partway through. It falls hardest on the last questions, which is exactly where the questions you added last and care most about tend to live.

- State the real completion time on the invitation, measured from the pilot rather than guessed.
- Show progress honestly; a bar that sits at 40% for twenty questions reads as deception.
- When adding a question, name the one it replaces.

## Who answers, and who does not

### 18. Define the sampling frame before sending

The target population is who you want to describe. The sampling frame is the list you can actually reach. Coverage error is the gap between them, and it is a property of the frame, not of the sample size.

Write both down, then write the gap explicitly. Example: "Target population: all active customers. Frame: customers who opted into product email. Gap: customers who opted out, and everyone whose usage runs through an admin account with no personal email. These skew toward larger accounts."

### 19. A convenience sample does not generalise, at any n

If respondents selected themselves, or came from whoever was easy to reach, the result describes the respondents and nobody else. Collecting ten thousand responses that way makes the estimate precise about a group you cannot define. Sample size fixes noise; it does not fix a biased frame.

**Bad:** "A survey of 4,200 users found 78% want dark mode."
**Good:** "Of 4,200 respondents recruited from our Discord and social media, 78% want dark mode. Respondents self-selected and skew toward highly engaged users, so this is evidence about enthusiasts rather than about the user base."

Either sample randomly from a defined frame, or label the result as what it is. Do not average the difference away with a bigger send.

### 20. Treat nonresponse bias as the main threat

Nonresponse quietly destroys more surveys than bad wording does, because it leaves no trace inside the data: every response you have looks fine. What matters is not the response rate itself but whether non-responders differ from responders on the thing you are measuring. A satisfaction survey that the most frustrated users ignore will report healthy satisfaction forever.

- Record invitations sent, responses started, and responses completed, and report the rate.
- Compare responders against the frame on any attribute you already hold, for example plan tier, tenure, or usage band. A visible skew there is your best available signal about the invisible one.
- Send reminders, and compare late responders with early ones: late responders are the closest proxy you have for non-responders.
- Report the limitation in the write-up rather than letting a clean-looking dataset imply it does not exist.

### 21. Watch what incentives buy you

Incentives raise response rates and change who responds. A prize draw recruits people who enter prize draws; a payment recruits people for whom the payment is worth the time, and at a high enough rate it recruits speed-runners who straight-line to the end.

- Prefer a small incentive offered to everyone over a large lottery, and keep it small enough that it does not outweigh the reason to answer honestly.
- Never make the incentive contingent on a particular answer, which buys the answer.
- Disclose the incentive in the write-up, and if it required collecting contact details, keep those separate from the responses (rule 22).
- Screen for straight-lining and implausibly short completion times before analysis.

## Consent, privacy, retention

### 22. Ask for consent, collect less, delete on schedule

Before the first question, in plain language: who is running the survey, what it is for, roughly how long it takes, whether responses are anonymous or identified, who will see them, and how long the data is kept. Make participation and each sensitive question optional, and give a contact route for questions or withdrawal.

Then collect the minimum that answers the decision. Every extra field is a liability with no analytic payoff.

- Keep contact details for incentives or follow-up in a separate store from the responses, linked only if you genuinely need the link.
- Do not put a hidden identifier in a survey you described as anonymous.
- Set a deletion date for raw responses at design time and hold to it; strip or redact free text before sharing results more widely, since respondents name themselves and others in it.
- Where a legal regime applies to the respondents, get the notice and lawful basis reviewed rather than inferred from another company's privacy page.

## The pilot

### 23. Pilot with real respondents before launch. This is the highest-value step

Give the draft to five to ten people from the target population, watch them fill it in, and ask them to think aloud. Reviewing a draft finds typos; watching someone answer finds ambiguity, because you see them hesitate.

Watch for: a pause before answering, a question read twice, an answer that does not match what they say aloud, a scale point nobody picks, an open text box filled with something you expected a closed question to capture, and the actual completion time.

Then ask: what did this question mean to you, was any answer missing, was anything uncomfortable, and where did you want to stop.

Fix the instrument and pilot again if the changes were structural. Pilot responses are not part of the dataset.

## Before you send

1. Is the decision written down, and does every question move it?
2. Is any question leading, loaded, double-barrelled, or negated?
3. Are behaviour questions bounded to a named window, and reported as self-report?
4. Is every scale point labelled, consistent in direction, and paired with a "Don't know" outside the scale?
5. Do general questions precede specific ones, with demographics optional and last?
6. Is every skip-logic branch tested, including disqualification?
7. Are the frame, its coverage gap, and the incentive written into the method note?
8. Does the consent notice match what the collection setup actually does?
9. Did at least five real respondents complete it while you watched?

Any no, it is not ready to send.

## When to use this skill

Use it when:
- Writing a customer, employee, user research, or academic questionnaire
- Reviewing someone else's draft survey before it goes out
- Deciding whether an existing survey's results support the claim being made from them
- Turning a vague "let's ask people" into a measurable instrument

Skip it when:
- Running unstructured interviews or open discovery, where the point is not to compare answers
- The question is answerable from logs, records, or documentation, which beats self-report
- Analysing responses already collected (use [`research-data-analysis`](../research-data-analysis/SKILL.md))
