---
name: data-visualization-principles
description: "Use when building a chart. Pick the form from the question being asked, then refuse the distortions: truncated bars, dual axes, mean-only summaries, and colour used as decoration."
---

# Data Visualization Principles

A chart is an argument made with ink. The reader cannot audit your data, so every
encoding you choose is a claim they have to trust. Most bad charts are not ugly;
they are honest data drawn in a form that makes the wrong comparison easy and the
right one impossible.

This skill covers the chart itself. For how a chart behaves inside a deck (title
as assertion, one idea per slide, appendix discipline), see
`skills/design/presentation-design`.

## 1. Pick the form from the question, not from habit

Name the question in one sentence before opening a plotting library. The question
determines the encoding; the encoding determines whether the reader sees the
answer in under a second or does arithmetic in their head.

| Question type | Ask | Use | Avoid |
| --- | --- | --- | --- |
| Comparison | Which is biggest? | Horizontal bar, sorted by value | Pie, radar |
| Composition | How does the whole split? | Stacked bar, treemap, waterfall | Pie with 8 slices |
| Distribution | What is the spread? | Histogram, box, violin, strip | A single mean bar |
| Relationship | Do these move together? | Scatter, hexbin | Two lines on twin axes |
| Trend | How did it change over time? | Line, slope chart | Grouped bar over 24 months |

- **Write the question as the working title before you plot.** If you cannot state
  it, the chart has no job and will end up showing everything and saying nothing.
- **Use a table when the exact values are the point.** People cite numbers, not
  pixel lengths, and a chart forces them to guess at what a table states.

Bad: a grouped bar chart of 12 months by 4 regions, because "we have monthly data".
Good: a line chart of the 2 regions that diverged, because the question was
"which region broke trend?".

## 2. Pie charts fail past a few slices

Pie charts encode value as angle and arc, and human judgement of angle is far less
accurate than judgement of length along a common baseline. With 3 slices that
imprecision is harmless. With 8 it means the reader cannot rank the slices at all,
which is usually the only thing they wanted to do.

- **Cap a pie at 2 or 3 slices, and only for a part-of-whole where the parts are
  far apart.** Otherwise the ranking task fails.
- **Replace every other pie with a sorted horizontal bar.** Bars share a baseline,
  so the comparison becomes length against length, which reads accurately.
- **Never use a 3D or exploded pie.** Perspective changes the apparent area of a
  slice by its position, so identical values render as different sizes.

## 3. Bars start at zero, lines need not

The rule differs because the encoding differs, not because one chart type is more
honest than the other.

- **A bar encodes value as length from the axis, so the bar's length must be
  proportional to the value.** Cutting the axis at 95 makes a 96-vs-100 difference
  look like 1-vs-5. The bar lies about a ratio the reader can literally measure.
- **A line encodes value as vertical position, and the message is the slope
  between points, not the distance to the axis.** A forced zero baseline on a
  series that lives between 98.1 and 98.4 flattens real movement into a straight
  line, which is its own distortion.
- **When you zoom a line axis, label the range plainly and keep the tick labels
  readable.** The reader must be able to see that the axis does not start at zero.

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

regions = ["EU", "APAC", "LATAM", "NA"]
score = [96.0, 97.5, 98.8, 100.0]

fig, (bad, good) = plt.subplots(1, 2, figsize=(9, 3.4))

# Bad: truncated bar axis turns a 4 point gap into a 5x visual gap
bad.bar(regions, score, color="#b0b0b0")
bad.set_ylim(95, 101)
bad.set_title("Bad: bars on a truncated axis")

# Good: bars from zero, so length stays proportional to value
good.bar(regions, score, color="#b0b0b0")
good.set_ylim(0, 105)
good.set_title("Good: bars from zero")

fig.tight_layout()
fig.savefig("bars.png", dpi=120)
```

## 4. Dual axes invent a relationship

Two series on twin y axes can be made to cross, converge, or diverge anywhere you
like by choosing the two scales. The correlation the reader sees is a property of
your axis limits, not of the data.

- **Never put two different units on twin y axes to imply they move together.**
  The apparent relationship is an artifact you chose.
- **Index both series to a common base and plot them on one axis instead**, or use
  two stacked panels sharing the x axis, or a scatter if the relationship is the
  actual claim.

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

months = list(range(1, 13))
revenue = [100, 104, 103, 109, 112, 118, 121, 119, 125, 131, 128, 136]
tickets = [820, 804, 830, 795, 770, 742, 733, 760, 715, 690, 702, 665]

# Good: index both to their first value, one shared axis, direct labels
fig, ax = plt.subplots(figsize=(6, 3.4))
rev_idx = [100 * v / revenue[0] for v in revenue]
tix_idx = [100 * v / tickets[0] for v in tickets]
ax.plot(months, rev_idx, color="#1f6feb")
ax.plot(months, tix_idx, color="#999999")
ax.annotate("Revenue", (months[-1], rev_idx[-1]), xytext=(4, 0),
            textcoords="offset points", color="#1f6feb", va="center")
ax.annotate("Support tickets", (months[-1], tix_idx[-1]), xytext=(4, 0),
            textcoords="offset points", color="#999999", va="center")
ax.set_xlim(1, 15)
ax.set_ylabel("Indexed to month 1 = 100")
fig.tight_layout()
fig.savefig("indexed.png", dpi=120)
```

## 5. Plot the distribution, not only the mean

A bar of means with an error bar collapses every shape into two numbers. Bimodal
data, heavy skew, and a handful of extreme outliers all produce the same bar, and
each of them makes the mean a bad summary of any single case.

- **Show the spread whenever a reader might act on an individual case**, because
  "average latency 200ms" is useless to the user sitting in the slow mode.
- **Prefer a histogram or violin when the shape matters, a box plot when you are
  comparing many groups, and overlay the raw points when n is small.**
- **Report a median and a high percentile alongside a mean for any skewed
  quantity** such as latency, revenue per account, or session length.

Bad: two bars, "control 4.1, variant 4.4", with standard error whiskers.
Good: two histograms on a shared x axis showing that the variant did not shift
the middle at all; it emptied the bottom mode.

## 6. Overplotting hides the data it is made of

A scatter with 50,000 points is a solid blob. Every point after the first few
thousand adds ink and removes information, and the dense core, which is where the
data actually lives, is exactly the part you can no longer see.

- **Add transparency first for a few thousand points**, because overlapping marks
  then accumulate into visible density.
- **Switch to binning (hexbin or a 2D histogram) past roughly ten thousand
  points**, because density becomes a colour value instead of a pile of marks.
- **Jitter categorical scatter on the category axis**, since identical x values
  stack into a vertical line that hides the count.

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

rng = np.random.default_rng(0)
x = rng.normal(size=40000)
y = x * 0.6 + rng.normal(size=40000)

fig, (bad, good) = plt.subplots(1, 2, figsize=(9, 3.6))
bad.scatter(x, y, s=8)                      # Bad: an opaque blob
bad.set_title("Bad: 40k opaque points")
hb = good.hexbin(x, y, gridsize=45, cmap="viridis")   # Good: density encoded
good.set_title("Good: hexbin density")
fig.colorbar(hb, ax=good, label="count")
fig.tight_layout()
fig.savefig("overplot.png", dpi=120)
```

## 7. Colour is an encoding, not decoration

Every distinct colour on a chart is a promise that the difference means something.
Rainbow fills across a single series break that promise and cost the reader a trip
to the legend to learn nothing.

- **Sequential palette (viridis, Blues) for ordered magnitude**, one hue ramping
  in lightness, so "darker" reads as "more".
- **Diverging palette (RdBu, coolwarm) only when there is a meaningful midpoint**
  such as zero, a target, or a baseline, and set the midpoint explicitly or the
  colours will lie about which side of it a value falls on.
- **Categorical palette for unordered groups, and keep it under about 7 colours**,
  because beyond that the reader cannot hold the mapping in memory.
- **Use one accent colour for the series you are arguing about and grey for
  context.** Grey is not a wasted colour; it is what makes the accent mean
  something.
- **Choose colourblind-safe sets (viridis, cividis, or Okabe-Ito for categories)
  and never encode a distinction by red-vs-green alone.** Red-green deficiency is
  the common form, so back colour with position, shape, or a direct label.
- **Keep one colour bound to one meaning across every chart in the same document.**
  If EU is blue on slide 3 it is blue on slide 9.

## 8. Label directly, sort by value, cut the junk

These three are the cheapest quality wins and the most commonly skipped.

- **Label lines and bars at the data instead of adding a legend**, because a
  legend makes the eye ping-pong between the key and the mark on every lookup.
- **Sort bars by value, not alphabetically**, since the ranking is usually the
  question and alphabetical order scatters the answer at random.
- **Keep a category order only when the categories are genuinely ordered**
  (age bands, Likert scales, months) or when the reader must match against
  another chart.
- **Delete gridline lattices, borders, drop shadows, gradient fills, background
  images, and every 3D effect.** 3D bars in particular make the reader compare
  volumes under perspective, which no one can do.
- **Round to the precision of the decision.** "12%" not "11.73%", unless someone
  spends money on the second decimal.

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

labels = ["Storage", "Compute", "Network", "Support", "Licences"]
cost = [412, 268, 96, 54, 31]
pairs = sorted(zip(cost, labels))          # sort by value, biggest at top
values = [p[0] for p in pairs]
names = [p[1] for p in pairs]
colors = ["#1f6feb" if n == "Storage" else "#c9ccd1" for n in names]

fig, ax = plt.subplots(figsize=(6, 3.2))
ax.barh(names, values, color=colors)
for name, value in zip(names, values):
    ax.text(value + 6, name, f"{value}k", va="center", fontsize=9)
ax.set_title("Storage is 44% of the bill (n=5 cost lines, last 90 days)",
             loc="left", fontsize=11)
for side in ("top", "right", "bottom"):
    ax.spines[side].set_visible(False)
ax.get_xaxis().set_visible(False)
fig.tight_layout()
fig.savefig("sorted_bars.png", dpi=120)
```

## 9. Aspect ratio changes the slope the reader sees

The same series drawn wide looks flat and drawn tall looks like a cliff, because
perceived slope is the ratio of the plotted rise to the plotted run. Choosing the
box size is choosing how dramatic the trend appears.

- **Set the aspect ratio deliberately and keep it constant across charts the
  reader will compare.** Two panels at different widths are not comparable even
  with identical axes.
- **Aim for the average line segment to sit near 45 degrees** when the shape of
  the change is the message; that is where slope differences are easiest to judge.
- **Never stretch a chart to fill a layout slot.** Resize the slot instead.

## 10. Annotate the one takeaway, and state n and the window

A chart that needs narration is incomplete, because it will be screenshotted and
forwarded without you attached to it.

- **Write the single sentence you want remembered onto the chart**, as the title
  or as an annotation pointing at the mark that proves it.
- **Annotate the specific point, not the whole plot.** An arrow at the month the
  line broke trend does more than a paragraph beside it.
- **State n and the time window on the chart itself**, since a percentage over
  n=7 and the same percentage over n=70,000 are different claims and the reader
  cannot tell them apart from the bars.
- **Name the units and the source on the axis or in a small footer.** "Revenue"
  is not a unit; "Revenue, USD thousands, constant currency" is.

Bad: a title reading "Churn by Segment", no n, no period, a legend of 6 colours.
Good: "Enterprise churn halved after guided onboarding" with the drop point
annotated, the two relevant lines labelled at their ends, and a footer reading
"n=1,284 accounts, trailing 12 months, self-serve excluded".

## Quick checklist

- The question is written down and the chart form answers that question.
- No pie with more than 3 slices, no 3D, no exploded slices.
- Bars start at zero. A zoomed line axis is labelled as zoomed.
- No dual y axes; indexed series or stacked panels instead.
- Distributions shown where individual cases matter, not just means.
- Dense scatters use transparency or binning.
- Palette type matches the data type and survives colourblind simulation.
- Series labelled at the data; no legend the eye must travel to.
- Bars sorted by value unless the categories carry their own order.
- Aspect ratio chosen once and held across comparable charts.
- One takeaway annotated; n, time window, and units stated on the chart.

## When to use this skill

Use it when a chart will be seen by someone who did not build it, when a number
needs to survive a screenshot, when a reviewer says the chart "looks off" without
saying why, or when you are about to reach for a pie chart, a second y axis, or a
bar of means.

Skip it for throwaway exploratory plots you will delete in the same session, and
skip the annotation rules for charts in a live dashboard where the axis controls
and filters are already on screen.
