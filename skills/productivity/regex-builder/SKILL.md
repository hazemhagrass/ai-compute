---
name: regex-builder
description: Use when writing a regex. Build it incrementally against real input, anchor it, and prove it cannot backtrack catastrophically.
---

Write regular expressions that match what you meant, reject what you did not, and finish in linear time. Build the pattern one group at a time against real sample input, keep a table of should-match and should-not-match cases, and check the dialect before you ship.

## The build loop

1. **Collect real input** - paste 5 to 10 actual lines, including the ugly ones and at least one line that must NOT match
2. **Match the first field only** - confirm it works, then stop
3. **Add one field** - re-run the whole sample set
4. **Anchor it** - `\A` and `\Z` (or `^`/`$` when you know the newline rules)
5. **Name the groups** - replace `\1` and `\2` with `(?P<name>...)`
6. **Switch to verbose mode** - add a comment per field
7. **Run the case table** - every should-match and every should-not-match
8. **Check for nested quantifiers** - time the pattern against a long non-matching string

Never write the whole pattern blind and then debug it. A 9-field regex that fails gives you no signal about which field is wrong; a 9-step build tells you exactly which step broke.

## Rules

### 1. Test every step against real input

Writing the whole pattern first means debugging a black box. Grow it field by field and print the match after each addition, so a failure always points at the field you just added.

```python
# Bad: written blind, fails on the whole sample set with no hint why
LOG = re.compile(r'^(\S+) (\w+) \[(.+)\] req=(.+) user=(.+) status=(\d+)')

# Good: field 1, verified, then extend
p = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z')
p.match(line).group(0)   # '2026-09-21T14:03:22.481Z'
```

The bad pattern above is not just unreadable: `(.+) user=(.+)` is greedy and will swallow the `user=` of a second occurrence. You only learn that from a test.

### 2. Anchor any pattern used for validation

An unanchored validation regex answers "does this string CONTAIN something valid", which is almost never the question. `re.search(r'\d{3}-\d{4}', s)` accepts `"call 555-1234 now"`, `"555-12345"`, and `"555-1234\nrm -rf /"`.

```python
# Bad: accepts garbage with a valid substring
re.search(r'\d{3}-\d{4}', '555-1234\nrm -rf /')   # matches

# Good: whole string, newline included
re.fullmatch(r'\d{3}-\d{4}', '555-1234\nrm -rf /')      # None
re.search(r'\A\d{3}-\d{4}\Z', '555-1234\nrm -rf /')     # None
```

### 3. Know that `$` is not end-of-string

In Python and PCRE, `$` also matches just before a trailing newline. That one-character gap is a real injection vector for anything that later splits on lines.

```python
# Bad: trailing newline sneaks through
bool(re.search(r'^\d{3}-\d{4}$', '555-1234\n'))    # True

# Good: \Z (Python) or \z (PCRE/Perl) means absolute end
bool(re.search(r'\A\d{3}-\d{4}\Z', '555-1234\n'))  # False
```

Same trap in reverse: with `re.MULTILINE`, `^...$` matches any single line, so `'evil\n555-1234\nmore'` passes. Never combine `MULTILINE` with validation.

### 4. Prefer a negated character class over `.*` or `.*?`

Greedy `.*` runs to the end of the line and backtracks; lazy `.*?` gets the right answer here but still backtracks one character at a time. A negated class cannot cross the delimiter at all, so it is both correct and linear.

```python
line = '... dur=1204ms "GET /v1/orders?page=2" ua="curl/8.4.0"'

re.search(r'"(.*)"',   line).group(1)   # 'GET /v1/orders?page=2" ua="curl/8.4.0'   wrong
re.search(r'"(.*?)"',  line).group(1)   # 'GET /v1/orders?page=2'                   right
re.search(r'"([^"]*)"', line).group(1)  # 'GET /v1/orders?page=2'                   right and fast
```

Rule: if you know what the field cannot contain, say so. `[^"]*` beats `.*?` every time.

### 5. Character classes beat alternation for single characters

`(a|b|c)` makes the engine try three branches with backtracking state; `[abc]` is a single-character test the engine compiles to a bitmap. Alternation is for multi-character alternatives only.

```python
# Bad
r'(0|1|2|3|4|5|6|7|8|9)+'
r'(a|b|c|d|e|f)'

# Good
r'[0-9]+'
r'[a-f]'

# Alternation is correct here: the branches are multi-character
r'(?:DEBUG|INFO|WARN|ERROR|FATAL)'
```

Use non-capturing `(?:...)` for grouping you do not extract. A capture group you never read is wasted state and shifts every later group number.

### 6. Name your capture groups

Numbered groups break the moment someone inserts a group in the middle. Names survive edits and document the field.

```python
# Bad: what is group 4?
m = re.match(r'(\S+) (\w+) \[([^\]]+)\] status=(\d{3})', line)
code = m.group(4)

# Good
m = re.match(r'(?P<ts>\S+) (?P<level>\w+) \[(?P<service>[^\]]+)\] status=(?P<status>\d{3})', line)
code = m.group('status')
m.groupdict()   # {'ts': ..., 'level': ..., 'service': ..., 'status': '503'}
```

Syntax differs: Python uses `(?P<name>...)` and backreference `(?P=name)`; JavaScript, .NET, PCRE, Go and Java use `(?<name>...)` and `\k<name>`. Python rejects `(?<name>x)` with "unknown extension".

### 7. Use verbose mode for anything with more than two groups

A one-line 12-field regex is write-only. Verbose mode (`re.VERBOSE` / `re.X`, `(?x)` inline) ignores unescaped whitespace and allows `#` comments, so each field gets a label.

```python
LOG_RE = re.compile(r'''
    \A
    (?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)   # ISO-8601 UTC
    \s+ (?P<level>DEBUG|INFO|WARN|ERROR|FATAL)            # syslog-ish level
    \s+ \[ (?P<service>[^\]]+) \]                         # emitting service
    \s+ req=    (?P<req_id>[0-9a-f]{8})                   # trace id, fixed width
    \s+ user=   (?P<user>\S+)                             # '-' when anonymous
    \s+ status= (?P<status>[1-5]\d{2})                    # HTTP status
    \s+ dur=    (?P<dur_ms>\d+) ms                        # integer milliseconds
    \s+ " (?P<method>[A-Z]+) \s+ (?P<path>[^"\s]+) "      # quoted request line
    \s+ ua=" (?P<ua>[^"]*) "                              # may be empty
    \Z
''', re.VERBOSE)
```

In verbose mode a literal space must be written `\ ` or `[ ]`, and `#` must be escaped as `\#`. Both are easy to forget and both fail silently.

### 8. Escape user input before interpolating it

Any user string spliced into a pattern is executable regex. At best it silently changes the meaning; at worst it throws, or it becomes the ReDoS payload.

```python
# Bad: parentheses become a group, brackets become a class
term = 'rev(2)'
re.search('.*' + term + '.*', 'rev(2) shipped')   # None. Matches 'rev2' instead.
re.findall('[beta]', 'a table of beta')           # ['a','t','a','b','e','b','e','t','a']
re.compile('.*' + 'price (USD' + '.*')            # re.error: missing ), unterminated subpattern

# Good
re.search(re.escape(term), 'rev(2) shipped')      # matches
```

Equivalents: Python `re.escape`, JavaScript has none built in (use a `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` helper), Go `regexp.QuoteMeta`, Java `Pattern.quote`, Rust `regex::escape`. If the user only wants a substring, skip regex entirely and use `in` / `str.contains` / `indexOf`.

### 9. Never nest a quantifier over an overlapping class

`(\w+\s?)+` lets the engine split `"aaaa"` into `a|aaa`, `aa|aa`, `aaa|a`, and so on. Every extra character doubles the number of ways to partition the string, so a failing match explodes exponentially.

```python
bad = re.compile(r'^(\w+\s?)+$')
bad.search('a'*16 + '!')   # 0.003 s
bad.search('a'*20 + '!')   # 0.045 s
bad.search('a'*22 + '!')   # 0.179 s
bad.search('a'*24 + '!')   # 0.718 s   each +2 chars is ~4x
```

The fix is to make the branches unambiguous, so exactly one partition is possible:

```python
good = re.compile(r'^\w+(?:\s\w+)*$')
good.search('a'*10000 + '!')   # 0.0002 s
```

Red flags to grep your own patterns for: `(a+)+`, `(a*)*`, `(a|a)*`, `(.*)*`, `(\w+\s?)+`, `(\s*\w*)*`. The test is always "can two different splits of the same input reach the same state".

### 10. Put a guard around regexes that touch untrusted input

Even a reviewed pattern can be pathological on input you did not imagine. Bound it.

```python
# Option A: the third-party `regex` module supports a timeout
import regex
regex.match(pattern, text, timeout=0.1)   # raises TimeoutError

# Option B: cap the input length before matching (cheap, always available)
if len(text) > 4096:
    raise ValueError('input too long to validate')

# Option C: use a linear-time engine for untrusted patterns
#   Go regexp, Rust regex, RE2 - no backtracking, no lookaround
```

Node has no regex timeout at all: a bad pattern blocks the single event loop thread and takes the whole process down. Length-cap there, or move matching to a worker.

### 11. `\w` does not mean "a letter"

`\w` is `[A-Za-z0-9_]` in ASCII mode and "word character plus underscore" in Unicode mode, which is not the same in any two languages.

```python
re.findall(r'\w+', 'café')                  # ['café']       Python 3 str: Unicode by default
re.findall(r'\w+', 'café', re.ASCII)        # ['caf']        ASCII mode drops the é
re.findall(r'\w+', 'Москва', re.ASCII)      # []             nothing at all
```

Two more traps:

- `\w` includes `_` and digits, so it is wrong for "letters only". Use `[^\W\d_]` (Python) or `\p{L}` (PCRE, .NET, Java, Go, Rust).
- Combining characters are separate code points. `'e\u0301'` renders as "é" but has length 2, and `re.match(r'\A\w\Z', 'e\u0301')` is `None`. Normalize with `unicodedata.normalize('NFC', s)` before matching.

JavaScript needs the `u` (or `v`) flag for `\p{...}` and for correct handling of astral characters. POSIX tools have no `\w` guarantee: use `[[:alpha:]]`, `[[:digit:]]`, `[[:alnum:]]`, which are locale-aware (`grep -Eo '[[:alpha:]]+'` on `naïve café` returns both words).

### 12. Check the dialect before you copy a pattern

The same string behaves differently in four common engines.

| Feature | Python `re` | PCRE / Perl | JavaScript | POSIX ERE (`grep -E`, `sed -E`, `awk`) |
| --- | --- | --- | --- | --- |
| Named groups | `(?P<n>)` | `(?<n>)` and `(?P<n>)` | `(?<n>)` (ES2018+) | none |
| Lookahead | yes | yes | yes | none |
| Lookbehind | fixed width only | yes, bounded | yes, variable width | none |
| `\d` `\w` `\s` | yes | yes | yes | not portable, use `[[:digit:]]` |
| Non-greedy `*?` | yes | yes | yes | not in POSIX ERE (GNU sed allows it) |
| Atomic group `(?>...)` | 3.11+ | yes | no | no |
| Unicode `\p{L}` | no (use `regex` module) | yes | with `u` flag | no |

Lookbehind is the sharpest edge. Python requires fixed width: `(?<=\d+)px` raises "look-behind requires fixed-width pattern", while `(?<=USD|EUR)\d+` is accepted because both branches are 3 characters. JavaScript allows variable width, so `/(?<=\d+)px/` works. POSIX has none, which is why `grep -P` (PCRE mode) exists.

Also JavaScript specific: a `/g` regex carries mutable `lastIndex`, so calling `.test()` on the same string alternates true/false.

```javascript
const r = /\d+/g;
r.test('a1');  // true
r.test('a1');  // false   lastIndex is now 2
r.test('a1');  // true    reset to 0
```

Use a fresh non-global regex for boolean tests, or reset `r.lastIndex = 0`.

### 13. Keep a case table and run it

A regex without negative test cases is untested. The should-not-match rows are where the bugs are.

```python
import re

CASES = [
    # (input, should_match)
    ('2026-09-21T14:03:22.481Z WARN  [api-gateway] req=7f3a2b91 user=alice@example.com '
     'status=503 dur=1204ms "GET /v1/orders?page=2" ua="curl/8.4.0"', True),
    ('2026-09-21T14:03:22.902Z INFO  [api-gateway] req=0c14dd7e user=- '
     'status=200 dur=37ms "GET /healthz" ua="kube-probe/1.29"', True),
    ('garbage line with no structure at all',           False),
    ('2026-09-21T14:03:22.481Z TRACE [x] ...',          False),   # unknown level
    ('2026-09-21 14:03:22 WARN [x] ...',                False),   # no T, no millis
    ('... status=999 ...',                              False),   # out of HTTP range
    ('',                                                False),
]

for text, expected in CASES:
    got = bool(LOG_RE.match(text))
    assert got == expected, f'{expected=} {got=} for {text[:50]!r}'
```

Put this table in the test suite next to the pattern. When someone widens the regex to accept a new line format, the negative rows catch the over-widening.

### 14. Do not use regex where a parser exists

Regex matches regular languages. HTML, JSON, and nested quoting are not regular, so any regex you write is an approximation that fails on real data.

- **HTML/XML**: nesting and optional close tags are unbounded. Use `lxml`, `BeautifulSoup`, `DOMParser`.
- **JSON**: strings contain escaped quotes and braces. Use `json.loads`, then walk the object.
- **CSV**: `line.split(',')` breaks on `"Smith, John",42` and on embedded newlines inside quoted fields. Use `csv.reader` / `csv.DictReader`.
- **URLs**: use `urllib.parse.urlparse` / `new URL()`, then regex the specific component if you must.
- **Email**: the RFC 5322 grammar permits comments, quoted local parts, and nested folding. The only validation that means anything is sending a confirmation message. If you must pre-filter, use `\A[^@\s]+@[^@\s]+\.[^@\s]+\Z` and accept that it is deliberately loose.
- **Dates**: use `datetime.strptime` / `fromisoformat`, which reject February 30. A regex cannot.

Use a regex to find the interesting line or extract one flat field; use a parser to understand structure.

## Anti-patterns

- Writing a 12-field pattern in one shot and debugging by deletion
- `re.search` for validation when you meant `re.fullmatch`
- `.*` between two literals where a negated class would do
- Interpolating a user string without `re.escape`
- `(\w+\s?)+`, `(a+)+`, `(.*)*` or any quantifier over an overlapping quantified group
- A single-line 200-character pattern with no `re.VERBOSE` and no comment
- Reusing a `/g` JavaScript regex across `.test()` calls
- Copying an email or URL regex from Stack Overflow without reading it
- A test suite with only should-match cases

## When to use this skill

Use it when:
- You are writing or reviewing a regex with more than two capture groups
- A validation regex accepts input it should reject
- A pattern works in one language and fails in another
- A service hangs on one specific request body (suspect ReDoS)
- User input reaches a pattern string

Skip it when:
- A plain substring test (`in`, `contains`, `startswith`) answers the question
- The input has a real parser: HTML, JSON, CSV, YAML, URLs, dates
- The data is fixed-width or delimiter-clean and `split()` is enough
