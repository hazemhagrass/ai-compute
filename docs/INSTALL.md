# Installing and publishing this library

Three ways to consume these skills, and one way they get published.

## 1. Claude Code plugin marketplace

The repo carries `.claude-plugin/marketplace.json`, generated from the skill
tree. Inside Claude Code:

```
/plugin marketplace add hazemhagrass/ai-compute
/plugin install ai-computer-engineering
```

Plugins are split one per category rather than a single bundle. The unit a
person installs should be a unit they can describe: nobody wants 98 skills to
get the three finance ones. Install as many categories as you want.

To see what is on offer without installing:

```
/plugin marketplace info hazemhagrass/ai-compute
```

## 2. Any host that reads the open skill format

The skill format (a directory with `SKILL.md` carrying `name` and
`description` frontmatter) is shared across several agent hosts. Nothing in
this repo is host-specific, so the generic install is a copy or a symlink
into whatever directory the host scans:

```sh
git clone https://github.com/hazemhagrass/ai-compute.git
ln -s "$PWD/ai-compute/skills/engineering" ~/<host-skills-dir>/engineering
```

`scripts/install.sh` does this for the two hosts used here, symlinking every
category so a `git pull` updates the installed skills with no reinstall step:

```sh
bash scripts/install.sh
bash scripts/doctor.sh     # verifies the links landed
```

Because it iterates over `skills/*/`, new categories are picked up on the next
run without editing the script.

## 3. Read them as documentation

Every skill has a `README.md` next to its `SKILL.md`. The README is written
for a human deciding whether the skill is worth loading; the SKILL.md is
written for the agent that loads it.

## How publishing happens

`.github/workflows/release.yml` runs on any push to `main` that touches
`skills/`. It validates before it publishes, every time:

1. `doctor.sh` (structure, frontmatter contract, link integrity)
2. `gen-manifest.py --check` (manifest matches the tree)
3. `gen-robot.py --check` (every skill has unique art)
4. `scan-skills.py` (prompt injection and unsafe bundled scripts)
5. `gen-marketplace.py --check` (marketplace manifest matches the tree)

Only then does it compute a version, tag, and cut a release.

### Versioning

`scripts/gen-release.py` diffs `skills/MANIFEST.json` between the last release
tag and the working tree, and bumps by what actually changed for a consumer:

| Change | Bump | Why |
|---|---|---|
| A skill was removed or renamed | major | Someone's pin breaks. |
| A skill was added | minor | New capability, nothing breaks. |
| Existing skill content changed | patch | Same surface, better content. |

The bump is computed from the manifest rather than from commit subjects,
because the manifest is what consumers actually receive and commit messages
are not a reliable record of what shipped.

### Dry runs

Run the workflow manually from the Actions tab with `dry_run` checked (the
default) to see the version it would cut and the release notes it would
write, without tagging or publishing anything.

```sh
python3 scripts/gen-release.py      # same computation, locally
```

### Rollback

Release tags are immutable, which is the point: a consumer pinned to `v1.4.0`
keeps getting exactly `v1.4.0` no matter what happens afterwards. To withdraw
a bad release, revert the offending commit on `main`; the next run cuts a new
patch version containing the revert. Do not move or delete a published tag,
because anyone who already pinned it would silently get different content
under a version they believe is fixed.

## Local verification before pushing

```sh
bash scripts/doctor.sh
python3 scripts/gen-manifest.py --check
python3 scripts/gen-robot.py --check
python3 scripts/scan-skills.py
python3 scripts/gen-marketplace.py --check
```

These are the same five checks CI runs, in the same order.
