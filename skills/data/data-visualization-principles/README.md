# Data Visualization Principles

<!-- robot-banner -->
<div align="center">
  <img src="assets/robot.svg" alt="data-visualization-principles robot" width="200">
</div>

A skill for choosing the right chart form from the question being asked and then drawing it honestly: zero baselines where length is the encoding, distributions instead of bare means, colour as an encoding, and the takeaway annotated on the chart itself.

## What it does

Most misleading charts contain correct data. They mislead because the encoding
makes the wrong comparison easy. This skill names the specific mechanisms and
gives the replacement for each:

- **Form selection.** A lookup from question type (comparison, composition,
  distribution, relationship, trend) to the encoding that answers it, and the
  common wrong choice for each.
- **Pie charts.** Why angle and arc are poor length substitutes, why 3 slices is
  the practical ceiling, and what to use instead.
- **Baselines.** Why a bar chart must start at zero while a line chart need not,
  grounded in the difference between encoding by length and encoding by position.
- **Classic distortions.** Truncated axes and dual y axes, including why the
  correlation a twin-axis chart shows is a property of your axis limits.
- **Distributions over means.** How a mean hides bimodality, skew, and outliers,
  and when to reach for a histogram, box, violin, or raw points.
- **Overplotting.** Transparency, hexbin and 2D histogram binning, and jitter,
  with the rough point counts where each takes over.
- **Colour.** Sequential vs diverging vs categorical palettes, colourblind-safe
  choices, accent-plus-grey, and consistent colour meaning across a document.
- **Direct labelling and sorting.** Removing the legend round trip, and sorting
  bars by value instead of alphabetically.
- **Chartjunk.** Gridline lattices, borders, gradients, and 3D effects.
- **Aspect ratio.** How the plot box shape changes perceived slope.
- **Context on the chart.** Annotating the single takeaway and stating n, the
  time window, and the units where the chart can be screenshotted away from you.

Every code example is runnable matplotlib using the Agg backend.

## When to use this

Concrete triggers:

- A chart is going in front of someone who did not build it.
- You are about to use a pie chart with more than three slices.
- You want a second y axis to show that two series "move together".
- A reviewer says the chart "looks off" but cannot say why.
- You are summarising a skewed quantity (latency, revenue per account, session
  length) with a mean.
- A scatter plot has turned into a solid blob.
- Your chart has a legend, and the reader keeps looking away from the data.
- The bars are in alphabetical order and the question is which is biggest.
- A percentage is shown with no n and no time window.

Skip it when:

- The plot is throwaway exploration you will delete in the same session.
- The values, not the shape, are the point (write a table).
- The chart lives in an interactive dashboard where axis controls, filters, and
  the active date range are already visible on screen.

## Quick start

Three steps, in order.

**Step 1: write the question, then pick the form**

State the question as a sentence. "Which cost line dominates the bill?" is a
comparison, so it is a sorted horizontal bar, not a pie.

**Step 2: draw it with the honest defaults**

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

labels = ["Storage", "Compute", "Network", "Support", "Licences"]
cost = [412, 268, 96, 54, 31]

pairs = sorted(zip(cost, labels))                 # sort by value
values = [p[0] for p in pairs]
names = [p[1] for p in pairs]
colors = ["#1f6feb" if n == "Storage" else "#c9ccd1" for n in names]

fig, ax = plt.subplots(figsize=(6, 3.2))          # aspect ratio chosen, not stretched
ax.barh(names, values, color=colors)              # accent plus grey, no palette spray
for name, value in zip(names, values):
    ax.text(value + 6, name, f"{value}k", va="center", fontsize=9)   # direct labels

ax.set_title("Storage is 44% of the bill", loc="left", fontsize=12)
ax.set_xlabel("Cost, USD thousands. n=5 cost lines, trailing 90 days.", fontsize=8)
for side in ("top", "right"):
    ax.spines[side].set_visible(False)
ax.set_xlim(0, max(values) * 1.15)                # bars start at zero
fig.tight_layout()
fig.savefig("cost_by_line.png", dpi=120)
```

**Step 3: check the spread before you summarise with a mean**

```python
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

rng = np.random.default_rng(7)
fast = rng.normal(120, 18, 3000)
slow = rng.normal(640, 70, 900)
latency = np.concatenate([fast, slow])            # two modes, one mean

fig, ax = plt.subplots(figsize=(6, 3.2))
ax.hist(latency, bins=60, color="#c9ccd1")
ax.axvline(latency.mean(), color="#1f6feb")
ax.annotate(f"mean {latency.mean():.0f}ms describes nobody",
            xy=(latency.mean(), ax.get_ylim()[1] * 0.8),
            xytext=(10, 0), textcoords="offset points",
            color="#1f6feb", fontsize=9)
ax.set_xlabel("Request latency, ms. n=3,900 requests, trailing 7 days.", fontsize=8)
ax.set_title("Latency is bimodal: a fast path and a slow path",
             loc="left", fontsize=12)
for side in ("top", "right"):
    ax.spines[side].set_visible(False)
fig.tight_layout()
fig.savefig("latency_distribution.png", dpi=120)
```

The mean here sits in the empty valley between the two modes. A bar chart of
means would have shown a single number that describes no actual request.

## Key concepts

- **Encoding.** The mapping from data value to a visual property: length,
  position, angle, area, colour, shape. Judgement accuracy differs sharply
  between them, and length along a shared baseline is the most reliable.
- **Zero baseline.** Required when the encoding is length (bars, areas), because
  the reader measures the mark itself. Not required when the encoding is
  position (lines), because the message is the slope between points.
- **Truncated axis.** An axis that does not start at zero. On bars it inflates
  small differences into large-looking ones. On lines it is legitimate when the
  range is labelled.
- **Dual axis.** Two y scales on one plot. The crossing point and apparent
  correlation are set by the two scale choices, so the relationship shown is
  chosen rather than measured.
- **Sequential, diverging, categorical.** Palette families for ordered magnitude,
  data with a meaningful midpoint, and unordered groups. Using the wrong family
  implies an order or a midpoint that does not exist.
- **Colourblind-safe.** A palette that stays distinguishable under the common
  colour-vision deficiencies. Viridis and cividis for continuous data,
  Okabe-Ito for categories; never red-vs-green alone.
- **Overplotting.** Marks stacking on top of each other until density becomes
  invisible. Fixed with transparency, binning, or jitter.
- **Chartjunk.** Ink that carries no data: 3D effects, shadows, gradients, heavy
  gridlines, decorative borders.
- **Data-ink ratio.** The share of ink that encodes data. Raising it means
  deleting decoration, not shrinking the data.
- **Direct labelling.** Putting the series name at the data rather than in a
  legend, so the reader never leaves the mark to decode it.

## Common pitfalls

**Pie chart with many slices**

```python
ax.pie(values, labels=names)                      # Bad: 8 slices, no ranking possible
ax.barh(names_sorted, values_sorted)              # Good: shared baseline, sorted
```

Reason: angle comparison is imprecise, so the reader cannot rank the slices.

**Truncated bar axis**

```python
ax.bar(names, values); ax.set_ylim(95, 101)       # Bad: 4 points look like 5x
ax.bar(names, values); ax.set_ylim(0, 105)        # Good
```

Reason: a bar's length is the encoding, so a cut axis misstates the ratio.

**Forced zero on a line chart**

```python
ax.plot(t, uptime); ax.set_ylim(0, 100)           # Bad: real movement flattens out
ax.plot(t, uptime); ax.set_ylim(98.0, 98.5)       # Good, with the range labelled
```

Reason: lines encode position and slope, so an irrelevant baseline hides the change.

**Dual y axes**

```python
ax2 = ax.twinx(); ax2.plot(t, tickets)            # Bad: correlation set by scales
ax.plot(t, [100 * v / revenue[0] for v in revenue])   # Good: index both, one axis
```

Reason: any crossing or convergence can be manufactured by choosing the limits.

**Mean-only summary**

```python
ax.bar(["control", "variant"], [c.mean(), v.mean()])  # Bad: shape is gone
ax.violinplot([c, v]); ax.set_xticks([1, 2])          # Good: spread is visible
```

Reason: bimodal, skewed, and outlier-heavy data all produce the same bar.

**Opaque dense scatter**

```python
ax.scatter(x, y, s=8)                             # Bad: a solid blob at 40k points
ax.hexbin(x, y, gridsize=45, cmap="viridis")      # Good: density as colour
```

Reason: overlapping marks destroy exactly the dense region you care about.

**Rainbow palette on ordered data**

```python
ax.imshow(grid, cmap="jet")                       # Bad: false banding, not perceptual
ax.imshow(grid, cmap="viridis")                   # Good: monotonic lightness ramp
```

Reason: jet is not uniform in lightness, so it invents edges that are not in the data.

**Diverging palette with no real midpoint**

```python
ax.imshow(counts, cmap="RdBu")                    # Bad: implies a zero that is absent
ax.imshow(counts, cmap="Blues")                   # Good: sequential for magnitude
```

Reason: a diverging ramp claims two directions away from a meaningful centre.

**Legend instead of direct labels**

```python
ax.plot(t, eu, label="EU"); ax.legend()           # Bad: eye travels on every lookup
ax.annotate("EU", (t[-1], eu[-1]), xytext=(4, 0),
            textcoords="offset points", va="center")   # Good
```

Reason: a legend adds a decoding step to every single comparison.

**Alphabetical bars**

```python
ax.barh(sorted(names), values)                    # Bad: ranking scattered at random
pairs = sorted(zip(values, names)); ax.barh([p[1] for p in pairs],
                                            [p[0] for p in pairs])   # Good
```

Reason: the question is usually the ranking, so the order should show it.

**No n and no window**

```python
ax.set_title("Churn by segment")                  # Bad: unfalsifiable
ax.set_title("Enterprise churn halved after guided onboarding")
ax.set_xlabel("n=1,284 accounts, trailing 12 months", fontsize=8)   # Good
```

Reason: the same percentage over n=7 and n=70,000 are different claims.

## See also

- `SKILL.md` in this directory: the full rule set with paired bad and good
  examples and runnable matplotlib.
- `skills/design/presentation-design`: how a chart behaves inside a deck, where
  the title asserts the message and detail moves to an appendix.
- `skills/data/python-pandas-analysis`: getting the numbers right before you draw
  them, including validated merges and shape assertions.
- `skills/office/pivot-tables`: summarising before plotting when the source is a
  spreadsheet.
- `skills/writing/technical-writing`: the captions, footers, and units that make
  a chart readable without you in the room.
- matplotlib docs: "Choosing colormaps", the `Axes.hexbin` and `Axes.violinplot`
  references, and the annotation guide.
