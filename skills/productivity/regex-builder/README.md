# Regex Builder

<!-- robot-banner -->
<div align="center">
<img src="assets/robot.svg" alt="robot" width="150" />
</div>

Build regular expressions incrementally against real input so they match what you meant, reject what you did not, and never blow up on a crafted string.

## What it does

This skill turns regex writing from a guessing game into a repeatable build loop. Instead of writing a 12-field pattern in one shot and debugging by deletion, you add one field at a time and re-run your sample set after each addition, so a failure always points at the field you just touched.

It covers the four places regexes actually break in production:

- **Correctness**: unanchored validation patterns, `$` matching before a trailing newline, greedy `.*` swallowing delimiters
- **Safety**: catastrophic backtracking (ReDoS), unescaped user input becoming executable pattern syntax
- **Portability**: lookbehind, named groups, and `\w` semantics differing across Python, PCRE, JavaScript, and POSIX tools
- **Scope**: recognizing the cases where no regex is correct and you need a parser

Every rule comes with a paired bad/good example tested against real input, plus timing numbers for the backtracking cases.

## When to use this

Reach for this skill when:

- You are writing or reviewing a pattern with more than two capture groups
- A validation regex accepts something it should reject, or rejects something valid
- A pattern works in Python and fails in JavaScript (or grep, or awk)
- One specific request body hangs a service and you suspect ReDoS
- Any user-supplied string is interpolated into a pattern
- You are parsing a log format, a config line, or a fixed-shape identifier

Skip it when:

- A substring test answers the question. `'error' in line` is faster to write, faster to run, and impossible to get wrong.
- The input has a real parser. HTML, JSON, CSV, YAML, URLs, and dates all have libraries that handle the cases your regex will miss.
- The data is delimiter-clean and `split()` is enough.

## Quick start

Here is the whole loop on one real log format. The target lines come from an API gateway:

```
2026-09-21T14:03:22.481Z WARN  [api-gateway] req=7f3a2b91 user=alice@example.com status=503 dur=1204ms "GET /v1/orders?page=2" ua="curl/8.4.0"
2026-09-21T14:03:22.902Z INFO  [api-gateway] req=0c14dd7e user=- status=200 dur=37ms "GET /healthz" ua="kube-probe/1.29"
2026-09-21T14:03:23.117Z ERROR [billing-svc] req=9a2f01bc user=bob+test@corp.co.uk status=500 dur=8021ms "POST /v1/invoices" ua="Mozilla/5.0 (X11; Linux x86_64)"
garbage line with no structure at all
```

That last line is deliberate. Every sample set needs at least one row that must NOT match.

**Step 1. Match only the timestamp.** Nothing else yet.

```python
import re
p = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z')
[p.match(l).group(0) if p.match(l) else None for l in LINES]
# ['2026-09-21T14:03:22.481Z', '2026-09-21T14:03:22.902Z', '2026-09-21T14:03:23.117Z', None]
```

Three hits, one clean `None`. The dots are escaped; an unescaped `.` would also accept `2026-09-21T14:03:22X481Z`.

**Step 2. Add the level, and name both groups.** Names from the start beats renumbering later.

```python
p = re.compile(r'(?P<ts>\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(?P<level>DEBUG|INFO|WARN|ERROR|FATAL)\s+')
[p.match(l).groupdict() if p.match(l) else None for l in LINES]
# [{'ts': '...481Z', 'level': 'WARN'}, {'ts': '...902Z', 'level': 'INFO'}, {'ts': '...117Z', 'level': 'ERROR'}, None]
```

The level is an explicit alternation, not `\w+`. A closed set of values should be spelled out, so `TRACE` fails loudly instead of being silently accepted.

**Step 3. Add the bracketed service name.** This is the first place `.*` would be tempting and wrong.

```python
p = re.compile(r'(?P<ts>\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+'
               r'(?P<level>DEBUG|INFO|WARN|ERROR|FATAL)\s+'
               r'\[(?P<service>[^\]]+)\]\s+')
# ... 'service': 'api-gateway' ... 'service': 'billing-svc' ... None
```

`[^\]]+` cannot cross the closing bracket. `\[(.*)\]` would run to the last `]` on the line, which on a line containing `(X11; Linux x86_64)` style user agents is a real bug waiting.

**Step 4. Handle the quoted request line, and watch greedy bite.** Try all three ways on the first sample:

```python
line = '... dur=1204ms "GET /v1/orders?page=2" ua="curl/8.4.0"'

re.search(r'"(.*)"',    line).group(1)   # 'GET /v1/orders?page=2" ua="curl/8.4.0'
re.search(r'"(.*?)"',   line).group(1)   # 'GET /v1/orders?page=2'
re.search(r'"([^"]*)"', line).group(1)   # 'GET /v1/orders?page=2'
```

Greedy `.*` ran to the final quote on the line and captured two fields as one. Lazy `.*?` is correct but backtracks character by character. The negated class is correct AND linear, so that is what goes in the pattern.

**Step 5. Assemble the rest in verbose mode.** Twelve fields on one line is write-only code; `re.VERBOSE` lets every field carry a comment.

```python
LOG_RE = re.compile(r'''
    \A
    (?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)   # ISO-8601 UTC
    \s+ (?P<level>DEBUG|INFO|WARN|ERROR|FATAL)            # closed set
    \s+ \[ (?P<service>[^\]]+) \]                         # emitting service
    \s+ req=    (?P<req_id>[0-9a-f]{8})                   # trace id, fixed width
    \s+ user=   (?P<user>\S+)                             # '-' when anonymous
    \s+ status= (?P<status>[1-5]\d{2})                    # HTTP status only
    \s+ dur=    (?P<dur_ms>\d+) ms                        # integer milliseconds
    \s+ " (?P<method>[A-Z]+) \s+ (?P<path>[^"\s]+) "      # quoted request line
    \s+ ua=" (?P<ua>[^"]*) "                              # may be empty
    \Z
''', re.VERBOSE)

LOG_RE.match(LINES[2]).groupdict()
# {'ts': '2026-09-21T14:03:23.117Z', 'level': 'ERROR', 'service': 'billing-svc',
#  'req_id': '9a2f01bc', 'user': 'bob+test@corp.co.uk', 'status': '500',
#  'dur_ms': '8021', 'method': 'POST', 'path': '/v1/invoices',
#  'ua': 'Mozilla/5.0 (X11; Linux x86_64)'}
```

Note `\A` and `\Z`, not `^` and `$`. In Python and PCRE, `$` also matches before a trailing newline, so `^...$` would accept a line with `\n` glued on the end.

**Step 6. Lock it with a case table.** The should-not-match rows are the ones that catch future over-widening.

```python
CASES = [
    (LINES[0], True),
    (LINES[1], True),
    (LINES[2], True),
    ('garbage line with no structure at all',      False),
    (LINES[0].replace('WARN ', 'TRACE'),           False),   # unknown level
    (LINES[0].replace('status=503', 'status=999'), False),   # not an HTTP status
    (LINES[0] + '\n',                              False),   # trailing newline
    ('',                                           False),
]

for text, expected in CASES:
    assert bool(LOG_RE.match(text)) == expected, text[:60]
```

**Step 7. Check for backtracking before you ship.** Grep your own pattern for a quantifier wrapping a quantified group. `LOG_RE` has none: every `+` and `*` sits over a class that cannot overlap its neighbor. If it did, it would look like this:

```python
bad = re.compile(r'^(\w+\s?)+$')
bad.search('a'*20 + '!')   # 0.045 s
bad.search('a'*24 + '!')   # 0.718 s     each +2 chars is about 4x

good = re.compile(r'^\w+(?:\s\w+)*$')
good.search('a'*10000 + '!')   # 0.0002 s
```

Seven steps, each one verified. That is the whole method.

## Key concepts

**Anchors.** `\A` is start of string, `\Z` is absolute end (Python) or `\z` (PCRE/Perl). `^` and `$` are line-relative and `$` tolerates one trailing newline. Validation always wants `re.fullmatch` or `\A...\Z`.

**Greedy, lazy, possessive.** `*` takes as much as possible then gives back; `*?` takes as little as possible then grows; `*+` (PCRE, Java, Python 3.11+) takes everything and refuses to give back. Possessive quantifiers and atomic groups `(?>...)` are the surgical fix for backtracking when you cannot restructure the pattern.

**Negated character classes.** `[^"]*` expresses "up to the delimiter" without backtracking. Whenever you know what a field cannot contain, encode that instead of reaching for `.*?`.

**Catastrophic backtracking.** Happens when two parts of the pattern can match the same text, so the engine must try every partition. `(\w+\s?)+`, `(a+)+`, `(.*)*` all qualify. The fix is always to make exactly one partition possible, usually by moving the separator inside a non-capturing group: `\w+(?:\s\w+)*`.

**Named groups.** `(?P<name>...)` in Python, `(?<name>...)` everywhere else. Python rejects the JavaScript syntax outright with "unknown extension". Names survive pattern edits; numbers do not.

**Verbose mode.** `re.VERBOSE` ignores unescaped whitespace and treats `#` as a comment. The cost is that a literal space must be `\ ` or `[ ]` and a literal `#` must be `\#`, both of which fail silently when forgotten.

**Escaping.** `re.escape` (Python), `regexp.QuoteMeta` (Go), `Pattern.quote` (Java), `regex::escape` (Rust). JavaScript has no built-in; use a `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` helper.

**Dialects.** Python `re` requires fixed-width lookbehind and has no `\p{L}`; JavaScript allows variable-width lookbehind and needs the `u` flag for Unicode property escapes; POSIX ERE (`grep -E`, `sed -E`, `awk`) has no lookaround at all and no portable `\d`, so use `[[:digit:]]`. RE2-family engines (Go, Rust, `grep` with RE2) drop lookaround entirely in exchange for guaranteed linear time.

**Unicode.** `\w` is Unicode-aware for Python 3 `str` but ASCII-only with `re.ASCII`, and it always includes digits and underscore. For "letters only" use `[^\W\d_]` or `\p{L}`. Combining characters are separate code points, so normalize with NFC before matching.

## Common pitfalls

**Using `search` for validation.**
Bad: `re.search(r'\d{3}-\d{4}', user_input)`
Good: `re.fullmatch(r'\d{3}-\d{4}', user_input)`
Reason: `search` accepts `"555-1234\nrm -rf /"` because it only asks whether a valid substring exists anywhere.

**Trusting `$` as end of string.**
Bad: `re.search(r'\A\d+$', '42\n')` returns a match
Good: `re.search(r'\A\d+\Z', '42\n')` returns `None`
Reason: `$` matches just before a trailing newline, which is a real injection gap for anything that later splits on lines.

**Combining `MULTILINE` with validation.**
Bad: `re.search(r'^\d{3}-\d{4}$', 'evil\n555-1234\nmore', re.M)` matches
Good: drop the flag and use `\A...\Z`
Reason: `MULTILINE` makes the anchors line-relative, so any single valid line passes the whole input.

**Greedy `.*` between delimiters.**
Bad: `re.search(r'"(.*)"', line)` captures `GET /v1/orders?page=2" ua="curl/8.4.0`
Good: `re.search(r'"([^"]*)"', line)` captures `GET /v1/orders?page=2`
Reason: `.*` runs to the last delimiter on the line, merging two fields into one.

**Alternation for single characters.**
Bad: `(0|1|2|3|4|5|6|7|8|9)+`
Good: `[0-9]+`
Reason: each branch is a separate backtracking point, where a class compiles to one bitmap test.

**Unescaped user input.**
Bad: `re.search('.*' + term + '.*', text)` with `term = 'rev(2)'` matches `rev2`, not `rev(2)`
Good: `re.search(re.escape(term), text)`
Reason: user strings are executable pattern syntax, and `'price (USD'` does not even compile.

**Nested quantifiers over overlapping classes.**
Bad: `^(\w+\s?)+$` takes 0.7 s on 25 characters
Good: `^\w+(?:\s\w+)*$` takes 0.0002 s on 10000
Reason: ambiguous partitioning makes the engine try exponentially many splits before declaring failure.

**No timeout on untrusted input.**
Bad: `re.match(pattern, request_body)` with no bound
Good: length-cap the input, or use the `regex` module's `timeout=`, or an RE2 engine
Reason: in Node a pathological match blocks the single event loop thread and takes the process down.

**Assuming `\w` means letters.**
Bad: `re.findall(r'\w+', 'café', re.ASCII)` returns `['caf']`
Good: `re.findall(r'[^\W\d_]+', 'café')` returns `['café']`
Reason: `\w` includes digits and underscore, and drops non-ASCII letters entirely under `re.ASCII`.

**Reusing a global JavaScript regex for boolean tests.**
Bad: `const r = /\d+/g;` then `r.test(s)` twice returns `true`, `false`
Good: `const r = /\d+/;` without `/g`, or reset `r.lastIndex = 0`
Reason: `/g` regexes carry mutable `lastIndex` state between calls.

**Variable-width lookbehind in Python.**
Bad: `re.compile(r'(?<=\d+)px')` raises "look-behind requires fixed-width pattern"
Good: `re.compile(r'\d+px')` and slice, or move to JavaScript/PCRE where it is supported
Reason: Python's engine only supports fixed-width lookbehind; `(?<=USD|EUR)` works only because both branches are 3 characters.

**Regex for structured formats.**
Bad: `re.findall(r'<a href="(.*?)"', html)` or `line.split(',')` for CSV
Good: `BeautifulSoup(html).find_all('a')` and `csv.reader(f)`
Reason: nesting and embedded quotes are not regular, so `"Smith, John",42` silently splits into three fields.

**Regex for email validation.**
Bad: a 400-character RFC 5322 pattern copied from a forum
Good: `\A[^@\s]+@[^@\s]+\.[^@\s]+\Z` plus a confirmation email
Reason: the grammar allows comments and quoted local parts, so the long pattern rejects valid addresses while still accepting undeliverable ones.

## See also

- [debugging](../../engineering/debugging/README.md) - isolating which field of a pattern actually broke
- [test-strategy](../../engineering/test-strategy/README.md) - turning the case table into a permanent test suite
- [security-audit](../../engineering/security-audit/README.md) - ReDoS and input-escaping review in a wider context
- [performance-profiling](../../engineering/performance-profiling/README.md) - measuring a pattern that is slow but not exponential
