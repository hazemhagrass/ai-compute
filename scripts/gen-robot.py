#!/usr/bin/env python3
"""Generate a unique robot SVG for a skill.

Every skill in this repo carries its own robot at
`skills/<category>/<name>/assets/robot.svg`. The robot is derived
deterministically from the skill name, so the same name always produces the
same robot and no two skills collide.

What varies:
  * hue is seeded by category (engineering blue, devops purple, productivity
    green, ai pink, homelab amber, software-development teal), then nudged by
    a hash of the skill name so siblings in a category stay distinct
  * head shape, eye style and antenna are each chosen by a different slice of
    the name hash
  * the torso carries a glyph specific to that skill, looked up in GLYPHS

Usage:
    python3 scripts/gen-robot.py engineering/sql-optimization
    python3 scripts/gen-robot.py --all          # regenerate every skill
    python3 scripts/gen-robot.py --check        # fail if any robot is missing or duplicated
"""

from __future__ import annotations

import argparse
import colorsys
import hashlib
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKILLS = ROOT / "skills"

CATEGORY_HUE = {
    "engineering": 205,
    "devops": 265,
    "productivity": 150,
    "ai": 330,
    "homelab": 30,
    "software-development": 190,
    "office": 45,
    "research": 280,
    "career": 15,
}
DEFAULT_HUE = 210


def _hex(h: float, s: float, v: float) -> str:
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360.0, s, v)
    return "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))


def palette(name: str, category: str) -> dict:
    """Colours for one skill: category sets the family, name sets the variation."""
    h = int(hashlib.sha256(name.encode()).hexdigest(), 16)
    base = CATEGORY_HUE.get(category, DEFAULT_HUE)
    hue = base + (h % 40) - 20
    return {
        "hash": h,
        "accent": _hex(hue, 0.68, 0.88),
        "accent_dark": _hex(hue, 0.78, 0.63),
        "glow": _hex(hue + 28, 0.62, 0.95),
        "body": _hex(hue, 0.30, 0.22),
        "body_lo": _hex(hue, 0.34, 0.15),
    }


# Head outlines. Each takes the body fill and accent stroke.
def head_rounded(body: str, accent: str) -> str:
    return f'<rect x="46" y="30" width="68" height="56" rx="18" fill="{body}" stroke="{accent}" stroke-width="3.5"/>'


def head_oval(body: str, accent: str) -> str:
    return f'<ellipse cx="80" cy="58" rx="35" ry="29" fill="{body}" stroke="{accent}" stroke-width="3.5"/>'


def head_hex(body: str, accent: str) -> str:
    return f'<path d="M80 28 L112 46 v30 L80 94 L48 76 V46 Z" fill="{body}" stroke="{accent}" stroke-width="3.5" stroke-linejoin="round"/>'


def head_visor(body: str, accent: str) -> str:
    return (
        f'<rect x="46" y="32" width="68" height="54" rx="26" fill="{body}" stroke="{accent}" stroke-width="3.5"/>'
        f'<path d="M52 58 h56" stroke="{accent}" stroke-width="2" opacity="0.45"/>'
    )


HEADS = [head_rounded, head_oval, head_hex, head_visor]


# Eye styles. Each takes the glow colour.
def eyes_round(glow: str) -> str:
    return (
        f'<circle cx="66" cy="58" r="7" fill="{glow}">'
        f'<animate attributeName="opacity" values="1;0.45;1" dur="3.1s" repeatCount="indefinite"/></circle>'
        f'<circle cx="94" cy="58" r="7" fill="{glow}">'
        f'<animate attributeName="opacity" values="1;0.45;1" dur="3.1s" repeatCount="indefinite"/></circle>'
    )


def eyes_blink(glow: str) -> str:
    return (
        f'<ellipse cx="66" cy="58" rx="7" ry="7" fill="{glow}">'
        f'<animate attributeName="ry" values="7;7;1;7;7" dur="4.6s" repeatCount="indefinite"/></ellipse>'
        f'<ellipse cx="94" cy="58" rx="7" ry="7" fill="{glow}">'
        f'<animate attributeName="ry" values="7;7;1;7;7" dur="4.6s" repeatCount="indefinite"/></ellipse>'
    )


def eyes_bar(glow: str) -> str:
    return (
        f'<rect x="58" y="54" width="16" height="8" rx="4" fill="{glow}"/>'
        f'<rect x="86" y="54" width="16" height="8" rx="4" fill="{glow}">'
        f'<animate attributeName="width" values="16;9;16" dur="3.8s" repeatCount="indefinite"/></rect>'
    )


def eyes_square(glow: str) -> str:
    return (
        f'<rect x="59" y="51" width="14" height="14" rx="4" fill="{glow}"/>'
        f'<rect x="87" y="51" width="14" height="14" rx="4" fill="{glow}">'
        f'<animate attributeName="opacity" values="1;0.35;1" dur="2.4s" repeatCount="indefinite"/></rect>'
    )


EYES = [eyes_round, eyes_blink, eyes_bar, eyes_square]


# Antennae. Each takes accent and glow.
def ant_ball(accent: str, glow: str) -> str:
    return (
        f'<path d="M80 30 V16" stroke="{accent}" stroke-width="3.5" stroke-linecap="round"/>'
        f'<circle cx="80" cy="12" r="6" fill="{glow}">'
        f'<animate attributeName="r" values="6;8;6" dur="2.2s" repeatCount="indefinite"/></circle>'
    )


def ant_twin(accent: str, glow: str) -> str:
    return (
        f'<path d="M62 32 L56 18" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>'
        f'<path d="M98 32 L104 18" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>'
        f'<circle cx="56" cy="15" r="4.5" fill="{glow}"/><circle cx="104" cy="15" r="4.5" fill="{glow}"/>'
    )


def ant_coil(accent: str, glow: str) -> str:
    return (
        f'<path d="M80 30 C80 20 92 22 90 14" fill="none" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>'
        f'<circle cx="90" cy="11" r="5" fill="{glow}">'
        f'<animate attributeName="opacity" values="1;0.4;1" dur="2.6s" repeatCount="indefinite"/></circle>'
    )


def ant_dish(accent: str, glow: str) -> str:
    return (
        f'<path d="M80 30 V20" stroke="{accent}" stroke-width="3.5" stroke-linecap="round"/>'
        f'<path d="M68 20 a12 8 0 0 1 24 0" fill="none" stroke="{accent}" stroke-width="3" stroke-linecap="round"/>'
        f'<circle cx="80" cy="18" r="3.5" fill="{glow}"/>'
    )


ANTENNAE = [ant_ball, ant_twin, ant_coil, ant_dish]


# Torso glyphs, one per skill. `{g}` is substituted with the glow colour.
# Keep every path inside x 48..112, y 112..160 so it stays on the body panel.
GLYPHS = {
    # engineering
    "debugging": '<circle cx="80" cy="132" r="9" fill="none" stroke="{g}" stroke-width="3"/><path d="M86 138 l9 9" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "refactoring": '<path d="M62 126 h22 a8 8 0 0 1 0 16 h-22" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M92 134 l8 8 -8 8" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "security-audit": '<path d="M80 118 l16 7 v12 c0 10 -7 17 -16 20 -9 -3 -16 -10 -16 -20 v-12z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M73 137 l5 5 10 -10" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "code-review": '<path d="M68 124 l-10 12 10 12" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M92 124 l10 12 -10 12" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M86 120 l-12 32" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "api-design": '<circle cx="62" cy="136" r="6" fill="none" stroke="{g}" stroke-width="3"/><circle cx="98" cy="136" r="6" fill="none" stroke="{g}" stroke-width="3"/><path d="M68 136 h24" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "api-integration": '<path d="M64 130 a10 10 0 0 0 0 14 h10" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M96 130 a10 10 0 0 1 0 14 h-10" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M72 137 h16" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "database-design": '<ellipse cx="80" cy="124" rx="18" ry="6" fill="none" stroke="{g}" stroke-width="3"/><path d="M62 124 v20 c0 3 8 6 18 6 s18 -3 18 -6 v-20" fill="none" stroke="{g}" stroke-width="3"/><path d="M62 134 c0 3 8 6 18 6 s18 -3 18 -6" fill="none" stroke="{g}" stroke-width="3"/>',
    "sql-optimization": '<ellipse cx="74" cy="124" rx="15" ry="5" fill="none" stroke="{g}" stroke-width="3"/><path d="M59 124 v16 c0 3 7 5 15 5 s15 -2 15 -5 v-16" fill="none" stroke="{g}" stroke-width="3"/><path d="M92 140 l10 10" stroke="{g}" stroke-width="3" stroke-linecap="round"/><circle cx="90" cy="138" r="6" fill="none" stroke="{g}" stroke-width="3"/>',
    "test-strategy": '<path d="M70 118 v10 l-10 20 a4 4 0 0 0 4 6 h32 a4 4 0 0 0 4 -6 l-10 -20 v-10" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M66 118 h28" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "git-workflow": '<circle cx="64" cy="124" r="5" fill="none" stroke="{g}" stroke-width="3"/><circle cx="64" cy="150" r="5" fill="none" stroke="{g}" stroke-width="3"/><circle cx="96" cy="137" r="5" fill="none" stroke="{g}" stroke-width="3"/><path d="M64 129 v16" stroke="{g}" stroke-width="3"/><path d="M69 137 h22" stroke="{g}" stroke-width="3"/>',
    "performance-profiling": '<path d="M58 148 l12 -14 10 8 14 -20" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M88 122 h10 v10" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "frontend-architecture": '<rect x="56" y="120" width="48" height="34" rx="5" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 130 h48" stroke="{g}" stroke-width="3"/><circle cx="63" cy="125" r="2" fill="{g}"/><circle cx="70" cy="125" r="2" fill="{g}"/>',
    # devops
    "docker-troubleshooting": '<rect x="58" y="132" width="12" height="10" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="72" y="132" width="12" height="10" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="72" y="120" width="12" height="10" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M52 146 h44 a12 12 0 0 1 -12 8 H64 a12 12 0 0 1 -12 -8z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/>',
    "kubernetes-debugging": '<path d="M80 116 l20 10 v20 l-20 10 -20 -10 v-20z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><circle cx="80" cy="136" r="5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M80 121 v10 M92 129 l-8 5 M92 143 l-8 -3 M68 143 l8 -3 M68 129 l8 5" stroke="{g}" stroke-width="2"/>',
    "ci-cd-debugging": '<circle cx="62" cy="136" r="6" fill="none" stroke="{g}" stroke-width="3"/><circle cx="98" cy="136" r="6" fill="none" stroke="{g}" stroke-width="3"/><path d="M68 136 h10" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M82 136 h10" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M80 122 v6 M80 144 v6" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    # productivity
    "planning": '<rect x="58" y="118" width="44" height="38" rx="5" fill="none" stroke="{g}" stroke-width="3"/><path d="M58 128 h44" stroke="{g}" stroke-width="3"/><path d="M66 138 l4 4 8 -8" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M84 140 h10" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "skill-authoring": '<path d="M70 144 l3 -9 14 -14 6 6 -14 14z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M87 121 l6 6" stroke="{g}" stroke-width="3"/>',
    "technical-writing": '<rect x="60" y="118" width="40" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M68 128 h24 M68 136 h24 M68 144 h14" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "readme-generator": '<path d="M62 118 h26 l12 12 v26 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M88 118 v12 h12" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M70 140 h20 M70 148 h12" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "env-doctor": '<path d="M80 120 v32 M64 136 h32" stroke="{g}" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="136" r="20" fill="none" stroke="{g}" stroke-width="2.5" opacity="0.5"/>',
    "spec-first-development": '<rect x="60" y="116" width="40" height="42" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M68 128 h24 M68 137 h24 M68 146 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M92 146 l5 5 9 -11" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "truth-first": '<path d="M80 116 l15 7 v13 c0 10 -6 17 -15 20 -9 -3 -15 -10 -15 -20 v-13z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M80 128 v10 M80 144 v2" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "git-commit-writer": '<circle cx="80" cy="136" r="8" fill="none" stroke="{g}" stroke-width="3"/><path d="M58 136 h14 M88 136 h14" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "grill-me": '<path d="M62 122 q18 -8 36 0" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M66 132 v18 M80 130 v20 M94 132 v18" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M58 142 h44" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "autonomous-task": '<circle cx="80" cy="136" r="18" fill="none" stroke="{g}" stroke-width="3" stroke-dasharray="6 5"><animateTransform attributeName="transform" type="rotate" from="0 80 136" to="360 80 136" dur="9s" repeatCount="indefinite"/></circle><path d="M74 136 l5 5 9 -11" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "presentation-design": '<rect x="54" y="116" width="52" height="34" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M64 140 l10 -12 8 7 12 -15" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M80 150 v8 M68 158 h24" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    # ai
    "prompt-engineering": '<path d="M60 124 h40 v22 H86 l-6 8 -6 -8 H60z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M70 135 h20" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "model-selection": '<circle cx="64" cy="126" r="5" fill="none" stroke="{g}" stroke-width="3"/><circle cx="64" cy="146" r="5" fill="none" stroke="{g}" stroke-width="3"/><circle cx="98" cy="136" r="7" fill="{g}" opacity="0.85"/><path d="M69 128 l24 6 M69 144 l24 -6" stroke="{g}" stroke-width="2.5"/>',
    # homelab
    "lancache": '<rect x="56" y="118" width="48" height="12" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="56" y="134" width="48" height="12" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="64" cy="124" r="2.5" fill="{g}"/><circle cx="64" cy="140" r="2.5" fill="{g}"/><path d="M74 152 h12" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "unraid": '<rect x="56" y="120" width="10" height="34" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="70" y="120" width="10" height="34" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="84" y="120" width="10" height="34" rx="3" fill="{g}" opacity="0.4" stroke="{g}" stroke-width="2.5"/><rect x="98" y="120" width="6" height="34" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/>',
    # office
    "python-pandas-analysis": '<rect x="56" y="118" width="48" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 128 h48 M72 118 v38 M88 118 v38" stroke="{g}" stroke-width="2.5"/><path d="M60 140 h8 M76 146 h8" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "powerpoint-automation": '<rect x="54" y="118" width="52" height="32" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M62 142 v-10 M72 142 v-16 M82 142 v-6 M92 142 v-14" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M80 150 v6 M70 158 h20" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "word-documents": '<path d="M62 116 h24 l14 14 v28 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M86 116 v14 h14" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M69 138 l4 12 4 -9 4 9 4 -12" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    # software-development
    "smythos-sdk": '<circle cx="80" cy="136" r="7" fill="none" stroke="{g}" stroke-width="3"/><circle cx="60" cy="124" r="4.5" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="100" cy="124" r="4.5" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="80" cy="154" r="4.5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M75 131 l-11 -5 M85 131 l11 -5 M80 143 v7" stroke="{g}" stroke-width="2.5"/>',
}

FALLBACK_GLYPH = (
    '<circle cx="80" cy="136" r="10" fill="none" stroke="{g}" stroke-width="3"/>'
    '<path d="M80 130 v6 l4 4" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
)


def build_svg(name: str, category: str, title: str) -> str:
    """Return the SVG text for one skill's robot."""
    p = palette(name, category)
    h = p["hash"]
    head = HEADS[h % len(HEADS)]
    eyes = EYES[(h >> 7) % len(EYES)]
    antenna = ANTENNAE[(h >> 13) % len(ANTENNAE)]
    glyph = GLYPHS.get(name, FALLBACK_GLYPH).format(g=p["glow"])

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200" role="img" aria-label="{title} robot">
  <title>{title}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{p['body']}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="{p['body_lo']}" stop-opacity="0.12"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="160" height="200" rx="20" fill="url(#bg)"/>

  {antenna(p['accent'], p['glow'])}
  {head(p['body'], p['accent'])}
  <g filter="url(#glow)">{eyes(p['glow'])}</g>
  <path d="M68 76 h24" stroke="{p['accent']}" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>

  <path d="M80 86 v14" stroke="{p['accent']}" stroke-width="3"/>
  <rect x="44" y="108" width="72" height="56" rx="14" fill="{p['body']}" stroke="{p['accent']}" stroke-width="3.5"/>
  <g filter="url(#glow)">{glyph}</g>

  <rect x="26" y="116" width="14" height="38" rx="7" fill="{p['body']}" stroke="{p['accent']}" stroke-width="3"/>
  <rect x="120" y="116" width="14" height="38" rx="7" fill="{p['body']}" stroke="{p['accent']}" stroke-width="3"/>
  <rect x="58" y="164" width="14" height="20" rx="6" fill="{p['body']}" stroke="{p['accent']}" stroke-width="3"/>
  <rect x="88" y="164" width="14" height="20" rx="6" fill="{p['body']}" stroke="{p['accent']}" stroke-width="3"/>

  <circle cx="22" cy="40" r="2.5" fill="{p['glow']}" opacity="0.45">
    <animate attributeName="opacity" values="0.45;0.1;0.45" dur="3.6s" repeatCount="indefinite"/>
  </circle>
  <circle cx="140" cy="176" r="2" fill="{p['glow']}" opacity="0.4"/>
</svg>
"""


def title_for(skill_dir: pathlib.Path) -> str:
    """Prefer the README H1, fall back to a prettified directory name."""
    readme = skill_dir / "README.md"
    if readme.exists():
        for line in readme.read_text().split("\n"):
            if line.startswith("# "):
                return line[2:].strip()
    return skill_dir.name.replace("-", " ").title()


def generate(rel: str) -> pathlib.Path:
    category, name = rel.split("/", 1)
    skill_dir = SKILLS / category / name
    if not skill_dir.is_dir():
        sys.exit(f"no such skill: {rel}")
    out = skill_dir / "assets" / "robot.svg"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_svg(name, category, title_for(skill_dir)))
    return out


def all_skills() -> list[str]:
    return sorted(f"{p.parent.parent.name}/{p.parent.name}" for p in SKILLS.glob("*/*/SKILL.md"))


def check() -> int:
    seen: dict[str, list[str]] = {}
    missing: list[str] = []
    for rel in all_skills():
        category, name = rel.split("/", 1)
        svg = SKILLS / category / name / "assets" / "robot.svg"
        if not svg.exists():
            missing.append(rel)
            continue
        digest = hashlib.sha256(svg.read_bytes()).hexdigest()
        seen.setdefault(digest, []).append(rel)

    dupes = {d: rels for d, rels in seen.items() if len(rels) > 1}
    for rel in missing:
        print(f"MISSING  {rel}")
    for rels in dupes.values():
        print(f"DUPLICATE  {', '.join(rels)}")
    if not missing and not dupes:
        print(f"ok: {len(seen)} skills, every robot present and unique")
        return 0
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("skill", nargs="?", help="category/name, e.g. engineering/sql-optimization")
    ap.add_argument("--all", action="store_true", help="regenerate every skill's robot")
    ap.add_argument("--check", action="store_true", help="verify every robot exists and is unique")
    args = ap.parse_args()

    if args.check:
        return check()
    if args.all:
        for rel in all_skills():
            print(generate(rel).relative_to(ROOT))
        return 0
    if not args.skill:
        ap.print_help()
        return 1
    print(generate(args.skill).relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
