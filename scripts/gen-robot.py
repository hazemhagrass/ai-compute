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
    "security": 355,
    "design": 315,
    "data": 175,
    "writing": 95,
    "devtools": 240,
    "meta": 60,
    "workflow": 150,
    "presentation": 20,
    "knowledge": 165,
    "learning": 75,
    "finance": 135,
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
    "obsidian-zettelkasten": '<rect x="60" y="118" width="17" height="14" rx="2" fill="none" stroke="{g}" stroke-width="3"/><rect x="85" y="118" width="17" height="14" rx="2" fill="none" stroke="{g}" stroke-width="3"/><rect x="72" y="142" width="18" height="13" rx="2" fill="none" stroke="{g}" stroke-width="3"/><path d="M77 125 H85" stroke="{g}" stroke-width="3"/><path d="M68 132 L78 142" stroke="{g}" stroke-width="3"/><path d="M94 132 L85 142" stroke="{g}" stroke-width="3"/>',
    "onenote-knowledge-base": '<rect x="58" y="118" width="40" height="38" rx="3" fill="none" stroke="{g}" stroke-width="3"/><path d="M70 118 V156" stroke="{g}" stroke-width="3"/><path d="M98 126 H106" stroke="{g}" stroke-width="3"/><path d="M98 136 H106" stroke="{g}" stroke-width="3"/><path d="M98 146 H106" stroke="{g}" stroke-width="3"/><path d="M76 130 H92" stroke="{g}" stroke-width="3"/><path d="M76 140 H92" stroke="{g}" stroke-width="3"/>',
    "airtable-database-builder": '<rect x="56" y="120" width="48" height="34" rx="3" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 132 H104" stroke="{g}" stroke-width="3"/><path d="M72 120 V154" stroke="{g}" stroke-width="3"/><path d="M88 120 V154" stroke="{g}" stroke-width="3"/><rect x="89" y="133" width="14" height="10" fill="{g}" opacity="0.55"/>',
    "budget-tracker": '<rect x="56" y="122" width="48" height="32" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 132 H104" stroke="{g}" stroke-width="3"/><circle cx="92" cy="143" r="5" fill="none" stroke="{g}" stroke-width="3"/><path d="M66 143 H78" stroke="{g}" stroke-width="3"/>',
    "spaced-repetition": '<rect x="58" y="126" width="34" height="26" rx="3" fill="none" stroke="{g}" stroke-width="3"/><path d="M66 120 H98 a3 3 0 0 1 3 3 V146" fill="none" stroke="{g}" stroke-width="3"/><path d="M66 139 H84" stroke="{g}" stroke-width="3"/><path d="M66 133 H84" stroke="{g}" stroke-width="3"/>',
    "course-creation": '<path d="M80 119 L102 128 L80 137 L58 128 Z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M68 132 V143 a12 7 0 0 0 24 0 V132" fill="none" stroke="{g}" stroke-width="3"/>',
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
    "dotfiles-sync": '<circle cx="62" cy="126" r="6" fill="none" stroke="{g}" stroke-width="3"/><circle cx="98" cy="126" r="6" fill="none" stroke="{g}" stroke-width="3"/><circle cx="80" cy="152" r="6" fill="none" stroke="{g}" stroke-width="3"/><path d="M68 126 h24 M64 132 l12 15 M96 132 l-12 15" stroke="{g}" stroke-width="2.5"/>',
    "tmux-workspace": '<rect x="54" y="118" width="52" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M78 118 v38 M78 137 h28" stroke="{g}" stroke-width="2.5"/><path d="M60 128 l6 5 -6 5" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    "regex-builder": '<path d="M62 120 q-8 16 0 32 M98 120 q8 16 0 32" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M80 126 v20 M71 131 l18 10 M89 131 l-18 10" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "presentation-design": '<rect x="54" y="116" width="52" height="34" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M64 140 l10 -12 8 7 12 -15" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M80 150 v8 M68 158 h24" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    # ai
    "prompt-engineering": '<path d="M60 124 h40 v22 H86 l-6 8 -6 -8 H60z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M70 135 h20" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "model-selection": '<circle cx="64" cy="126" r="5" fill="none" stroke="{g}" stroke-width="3"/><circle cx="64" cy="146" r="5" fill="none" stroke="{g}" stroke-width="3"/><circle cx="98" cy="136" r="7" fill="{g}" opacity="0.85"/><path d="M69 128 l24 6 M69 144 l24 -6" stroke="{g}" stroke-width="2.5"/>',
    # homelab
    "lancache": '<rect x="56" y="118" width="48" height="12" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="56" y="134" width="48" height="12" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="64" cy="124" r="2.5" fill="{g}"/><circle cx="64" cy="140" r="2.5" fill="{g}"/><path d="M74 152 h12" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "unraid": '<rect x="56" y="120" width="10" height="34" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="70" y="120" width="10" height="34" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="84" y="120" width="10" height="34" rx="3" fill="{g}" opacity="0.4" stroke="{g}" stroke-width="2.5"/><rect x="98" y="120" width="6" height="34" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/>',
    "adguard-home": '<path d="M80 119 l17 7 v13 q0 13 -17 20 q-17 -7 -17 -20 v-13z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><circle cx="80" cy="139" r="8" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M73 139 h14" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    # office
    "python-pandas-analysis": '<rect x="56" y="118" width="48" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 128 h48 M72 118 v38 M88 118 v38" stroke="{g}" stroke-width="2.5"/><path d="M60 140 h8 M76 146 h8" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "powerpoint-automation": '<rect x="54" y="118" width="52" height="32" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M62 142 v-10 M72 142 v-16 M82 142 v-6 M92 142 v-14" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M80 150 v6 M70 158 h20" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "word-documents": '<path d="M62 116 h24 l14 14 v28 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M86 116 v14 h14" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M69 138 l4 12 4 -9 4 9 4 -12" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    # office: spreadsheet advanced family
    "excel-macros-vba": '<rect x="58" y="120" width="44" height="34" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M66 132 l5 12 5 -12" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M82 144 h6 a4 4 0 0 0 0 -8 h-6 v12" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    "power-query-etl": '<path d="M60 124 h16 v10 H60z M60 142 h16 v10 H60z" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M88 128 h14 v20 H88z" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M76 129 q8 0 8 9 t8 9" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M76 147 q8 0 8 -9" fill="none" stroke="{g}" stroke-width="2.5"/>',
    "excel-dashboards": '<rect x="58" y="120" width="44" height="34" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M58 132 h44" stroke="{g}" stroke-width="2.5"/><rect x="64" y="138" width="7" height="10" fill="{g}" opacity="0.8"/><rect x="76" y="142" width="7" height="6" fill="{g}" opacity="0.8"/><rect x="88" y="136" width="7" height="12" fill="{g}" opacity="0.8"/><circle cx="66" cy="126" r="2.5" fill="{g}"/>',
    "google-sheets-advanced": '<rect x="58" y="118" width="44" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M58 130 h44 M72 118 v38 M87 118 v38" stroke="{g}" stroke-width="2.5"/><path d="M62 124 h6" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><circle cx="94" cy="148" r="5" fill="none" stroke="{g}" stroke-width="2.5"/>',
    "excel-financial-modeling": '<path d="M60 150 v-26 M60 150 h42" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M66 142 l10 -10 8 7 12 -15" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="96" cy="124" r="3" fill="{g}"/><path d="M80 152 v4 M92 152 v4" stroke="{g}" stroke-width="2"/>',
    # devtools
    "code-graph": '<circle cx="80" cy="124" r="6" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="64" cy="148" r="6" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="96" cy="148" r="6" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M76 129 l-8 14 M84 129 l8 14 M70 148 h20" stroke="{g}" stroke-width="2.5"/>',
    "shell-history-alias-miner": '<rect x="56" y="120" width="48" height="34" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M64 132 l7 6 -7 6" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M78 144 h14" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M92 126 l4 -4 4 4" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "repo-snippet-extractor": '<path d="M66 124 h20 l8 8 v22 H66z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M86 124 v8 h8" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M74 140 l-4 4 4 4 M82 140 l4 4 -4 4" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    "refactoring-safety-checks": '<path d="M80 116 l20 8 v14 c0 12 -9 19 -20 23 c-11 -4 -20 -11 -20 -23 v-14z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M70 138 l7 7 14 -15" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    # software-development
    "smythos-sdk": '<circle cx="80" cy="136" r="7" fill="none" stroke="{g}" stroke-width="3"/><circle cx="60" cy="124" r="4.5" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="100" cy="124" r="4.5" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="80" cy="154" r="4.5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M75 131 l-11 -5 M85 131 l11 -5 M80 143 v7" stroke="{g}" stroke-width="2.5"/>',
    # office: spreadsheet family
    "excel-formulas": '<rect x="56" y="118" width="48" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 130 h48" stroke="{g}" stroke-width="2.5"/><path d="M64 140 l6 8 M70 140 l-6 8" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M80 148 h4 a5 5 0 0 0 5 -5 v-3" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><circle cx="96" cy="138" r="2.5" fill="{g}"/>',
    "excel-data-cleaning": '<rect x="56" y="118" width="48" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 130 h48 M80 118 v38" stroke="{g}" stroke-width="2.5"/><path d="M62 138 h12 M62 146 h12" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M88 136 l6 6 8 -11" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "pivot-tables": '<rect x="56" y="118" width="48" height="38" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M56 130 h48 M74 118 v38" stroke="{g}" stroke-width="2.5"/><path d="M80 138 h18 M80 146 h12" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M62 140 a6 6 0 1 0 6 -6 v6z" fill="{g}" opacity="0.75"/>',
    # security, engineering, writing, design, data (new wave)
    "authentication-audit": '<rect x="62" y="132" width="36" height="26" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M70 132 v-8 a10 10 0 0 1 20 0 v8" fill="none" stroke="{g}" stroke-width="3"/><circle cx="80" cy="144" r="3.5" fill="{g}"/><path d="M80 147 v5" stroke="{g}" stroke-width="2.5"/>',
    "api-security-audit": '<path d="M62 122 h36 v30 h-36z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M62 132 h36" stroke="{g}" stroke-width="2.5"/><circle cx="68" cy="127" r="2" fill="{g}"/><path d="M70 141 l-6 5 6 5 M90 141 l6 5 -6 5" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    "secrets-management-audit": '<path d="M80 118 l18 7 v14 c0 11 -8 18 -18 21 c-10 -3 -18 -10 -18 -21 v-14z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><circle cx="80" cy="139" r="5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M80 144 v7 M77 148 h6" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "cryptography-audit": '<rect x="60" y="126" width="40" height="28" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M67 134 l5 6 -5 6" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M78 146 h14" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M72 126 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="{g}" stroke-width="2.5"/>',
    "code-review-automation": '<circle cx="76" cy="136" r="11" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="76" cy="136" r="3.5" fill="none" stroke="{g}" stroke-width="2"/><path d="M76 122 v4 M76 146 v4 M62 136 h4 M86 136 h4 M66 126 l3 3 M86 146 l-3 -3 M66 146 l3 -3 M86 126 l-3 3" stroke="{g}" stroke-width="2" stroke-linecap="round"/><path d="M84 144 l5 5 9 -11" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "code-review-checklist": '<rect x="60" y="118" width="40" height="40" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M66 128 l4 4 6 -7" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 140 l4 4 6 -7" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M82 130 h12 M82 142 h12 M66 152 h28" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "architecture-review": '<rect x="69" y="119" width="22" height="13" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="62" y="143" width="18" height="13" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><rect x="84" y="143" width="16" height="13" rx="3" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M80 132 v5 M80 137 h-9 v6 M80 137 h12 v6" fill="none" stroke="{g}" stroke-width="2.5"/>',
    "review-comment-phrasing": '<path d="M58 120 h44 v26 h-26 l-12 10 v-10 h-6z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M68 129 h24 M68 137 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "accessibility-audit": '<circle cx="80" cy="125" r="5.5" fill="none" stroke="{g}" stroke-width="3"/><path d="M67 137 h26" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M80 134 v9" stroke="{g}" stroke-width="3"/><path d="M80 143 l-7 12 M80 143 l7 12" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "data-visualization-principles": '<path d="M60 156 v-34 M60 156 h40" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><rect x="67" y="138" width="8" height="16" fill="{g}" opacity="0.8"/><rect x="79" y="128" width="8" height="26" fill="{g}" opacity="0.8"/><rect x="91" y="144" width="8" height="10" fill="{g}" opacity="0.8"/>',
    "sql-for-analysts": '<ellipse cx="80" cy="126" rx="16" ry="6" fill="none" stroke="{g}" stroke-width="3"/><path d="M64 126 v20 c0 3.5 7.5 6 16 6 s16 -2.5 16 -6 v-20" fill="none" stroke="{g}" stroke-width="3"/><path d="M64 136 c0 3.5 7.5 6 16 6 s16 -2.5 16 -6" fill="none" stroke="{g}" stroke-width="2.5"/>',
    # career
    "latex-resume": '<path d="M62 114 h36 v46 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><circle cx="74" cy="128" r="5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M67 140 q7 -6 14 0" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M86 126 h8 M86 133 h8 M70 150 h20" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    # research
    "literature-review": '<path d="M80 124 q-9 -5 -20 -3.5 v26 q11 -1.5 20 3.5 q9 -5 20 -3.5 v-26 q-11 -1.5 -20 3.5z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M80 124 v26" stroke="{g}" stroke-width="2.5"/><circle cx="88" cy="143" r="6" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M92.5 147.5 l4.5 4.5" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "cover-letter-generator": '<path d="M62 112 h40 v52 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M68 120 h28 M68 128 h28 M68 136 h18" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M76 152 l8 6 l16 -12" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    "creative-resume-design": '<path d="M60 114 h44 v48 H60z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M66 122 h18 v10 H66z" fill="none" stroke="{g}" stroke-width="2.5"/><circle cx="88" cy="127" r="4" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M66 140 h32 M66 148 h24" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "infographic-resume": '<path d="M64 152 v-22 h8 v22 M78 152 v-32 h8 v32 M92 152 v-16 h8 v16" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><circle cx="76" cy="120" r="5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M106 116 v36" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "interactive-web-resume": '<rect x="60" y="112" width="44" height="52" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M66 120 h22" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><rect x="66" y="128" width="32" height="12" rx="2" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M70 150 h10 M86 150 h10" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><circle cx="98" cy="150" r="2" fill="{g}"/>',
    "interview-prep": '<path d="M56 116 h24 a4 4 0 0 1 4 4 v14 a4 4 0 0 1 -4 4 h-14 l-6 6 v-6 h-4 a4 4 0 0 1 -4 -4 v-14 a4 4 0 0 1 4 -4z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M92 132 h20 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-4 v6 l-6 -6 h-10 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/>',
    "linkedin-profile-optimizer": '<rect x="62" y="112" width="40" height="40" rx="4" fill="none" stroke="{g}" stroke-width="3"/><rect x="68" y="129" width="8" height="16" fill="{g}"/><circle cx="72" cy="122" r="4" fill="{g}"/><path d="M82 145 v-9 q0 -5 5 -5 t5 5 v9" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M82 131 v14" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "portfolio-website-builder": '<rect x="60" y="116" width="44" height="32" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M60 124 h44" stroke="{g}" stroke-width="2.5"/><circle cx="65" cy="120" r="1.5" fill="{g}"/><circle cx="70" cy="120" r="1.5" fill="{g}"/><path d="M66 138 l8 6 l-8 6 M80 150 h14" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M74 156 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "resume-storytelling": '<path d="M104 130 q-14 -14 -34 0 q20 14 34 0z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="96" cy="130" r="3" fill="{g}"/><path d="M62 112 h36 v50 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M68 122 h20 M68 130 h24 M68 138 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "salary-negotiation": '<path d="M75 156 v-32 h14 v32 M69 156 v-22 h6 v22 M89 156 v-16 h6 v16" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M70 118 h26 l-5 -6 M96 118 l-5 6" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "video-resume": '<rect x="62" y="120" width="36" height="28" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M98 128 l10 -6 v24 l-10 -6z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="80" cy="134" r="5" fill="none" stroke="{g}" stroke-width="2.5"/><path d="M74 142 q6 -5 12 0" fill="none" stroke="{g}" stroke-width="2.5"/>',
    "word-resume-optimizer": '<path d="M62 112 h36 v50 H62z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M68 122 h24 M68 130 h24 M68 138 h24 M68 146 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><path d="M88 130 l12 12 M100 130 l-12 12" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "academic-paper-writing": '<path d="M66 112 h28 l12 12 v40 H66z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M94 112 v12 h12" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M72 134 h18 M72 142 h22 M72 150 h14" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "citation-manager": '<path d="M58 114 h30 a6 6 0 0 1 6 6 v34 a6 6 0 0 0 -6 -6 h-30z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M112 114 h-18 v40 a6 6 0 0 1 6 -6 h12z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M100 114 v22 l5 -5 l5 5 v-22" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/>',
    "research-data-analysis": '<path d="M70 156 v-20 M84 156 v-34 M98 156 v-44" stroke="{g}" stroke-width="4" stroke-linecap="round"/><path d="M64 128 l14 -12 l14 -6 l10 -4" fill="none" stroke="{g}" stroke-width="2" stroke-dasharray="3 3"/>',
    "survey-design": '<rect x="62" y="116" width="40" height="44" rx="3" fill="none" stroke="{g}" stroke-width="3"/><rect x="68" y="126" width="7" height="7" fill="none" stroke="{g}" stroke-width="2"/><path d="M80 129 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><rect x="68" y="140" width="7" height="7" fill="none" stroke="{g}" stroke-width="2"/><path d="M80 143 h16" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/>',
    "systematic-web-research": '<circle cx="76" cy="132" r="14" fill="none" stroke="{g}" stroke-width="3"/><path d="M62 132 h28 M76 118 q7 14 0 28 q-7 -14 0 -28" fill="none" stroke="{g}" stroke-width="2"/><path d="M87 143 l10 10" stroke="{g}" stroke-width="3.5" stroke-linecap="round"/>',
    "grant-proposal-writing": '<path d="M58 116 h30 v34 H58z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M64 124 h18 M64 131 h18 M64 138 h11" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><circle cx="98" cy="142" r="9" fill="none" stroke="{g}" stroke-width="3"/><path d="M94 142 l3 3 l6 -6" fill="none" stroke="{g}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    "blog-post-writer": '<path d="M60 114 h40 v38 H60z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M66 122 h20" stroke="{g}" stroke-width="4" stroke-linecap="round"/><path d="M66 132 h28 M66 139 h28 M66 146 h16" stroke="{g}" stroke-width="2.2" stroke-linecap="round"/>',
    "video-script-writer": '<path d="M58 126 h44 v26 H58z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M58 126 l6 -10 h44 l-6 10" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M72 116 l-6 10 M86 116 l-6 10" stroke="{g}" stroke-width="2.5"/>',
    "slide-deck-designer": '<path d="M58 116 h44 v26 H58z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M65 134 l9 -9 l7 5 l11 -12" fill="none" stroke="{g}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M80 142 v7 M71 151 h18" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "youtube-seo-optimizer": '<rect x="57" y="119" width="36" height="26" rx="6" fill="none" stroke="{g}" stroke-width="3"/><path d="M71 127 l9 5 l-9 5z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="95" cy="143" r="7" fill="none" stroke="{g}" stroke-width="2.6"/><path d="M100 148 l4 4" stroke="{g}" stroke-width="2.8" stroke-linecap="round"/>',
    "podcast-production": '<rect x="70" y="112" width="20" height="26" rx="10" fill="none" stroke="{g}" stroke-width="3"/><path d="M60 132 a20 20 0 0 0 40 0" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round"/><path d="M80 146 v8 M68 156 h24" stroke="{g}" stroke-width="3" stroke-linecap="round"/>',
    "newsletter-writer": '<path d="M56 126 h48 v26 H56z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M56 126 l24 16 l24 -16" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/><path d="M68 120 h24 v-8 H68z" fill="none" stroke="{g}" stroke-width="2.5" stroke-linejoin="round"/>',
    "social-media-scheduler": '<rect x="57" y="120" width="31" height="29" rx="4" fill="none" stroke="{g}" stroke-width="3"/><path d="M57 129 h31 M64 114 v10 M81 114 v10" stroke="{g}" stroke-width="2.5" stroke-linecap="round"/><circle cx="96" cy="142" r="8" fill="none" stroke="{g}" stroke-width="2.6"/><path d="M96 137 v5 l3 2" fill="none" stroke="{g}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    "email-efficiency": '<path d="M59 134 h11 l4 8 h14 l4 -8 h11 v16 H59z" fill="none" stroke="{g}" stroke-width="3" stroke-linejoin="round"/><path d="M80 114 v15 m-6 -6 l6 6 l6 -6" fill="none" stroke="{g}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
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
