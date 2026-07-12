"""Static Phase 2C visual-system validation. No runtime, network, DB, or ERP access."""
from __future__ import annotations
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOKENS = ROOT / "design-tokens" / "visual-tokens.json"
SCREENS = ROOT / "screen-specs" / "screen-catalog.json"
REQUIRED_SCREEN_FIELDS = {
    "visual_hierarchy", "grid", "spacing", "typography", "color_usage",
    "motion", "cta_hierarchy", "component_usage", "responsive_rules",
    "accessibility", "seo_placeholders", "cms_editable_zones", "dark_mode",
    "performance",
}
REQUIRED_SCREEN_SECTIONS = {
    "## Visual hierarchy", "## Grid", "## Spacing", "## Typography",
    "## Color usage", "## Motion", "## CTA hierarchy", "## Component usage",
    "## Responsive rules", "## Accessibility", "## SEO placeholders",
    "## CMS editable zones", "## Dark mode", "## Performance",
}
REQUIRED_DIAGRAMS = {
    "01-visual-hierarchy.md", "02-color-relationships.md",
    "03-typography-scale.md", "04-motion-flow.md", "05-component-states.md",
    "06-responsive-behaviour.md", "07-brand-story-flow.md",
    "08-photography-flow.md", "09-product-presentation.md",
    "10-theme-engine.md",
}
REQUIRED_TERMS = {
    "luxury": ["luxury", "negative space", "minimalism"],
    "accessibility": ["wcag 2.2 aa", "focus", "reduced motion", "contrast"],
    "performance": ["lcp", "inp", "lazy-load"],
    "seo": ["seo", "canonical", "structured"],
    "cms": ["cms", "preview", "publish"],
    "erp": ["erp", "not changed", "never"],
    "b2c": ["retail", "customer"],
    "b2b": ["dealer", "wholesale", "moq"],
    "future": ["android", "iphone", "pwa", "ai assistant", "marketplace", "export"],
    "themes": ["diwali", "durga puja", "raja festival", "akshaya tritiya", "wedding season", "christmas", "new year"],
}
FORBIDDEN_SUFFIXES = {".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".sql", ".env", ".vue"}


def main() -> int:
    failures = []
    token_data = json.loads(TOKENS.read_text(encoding="utf-8"))
    if token_data.get("notice") != "DESIGN ONLY — NOT RUNTIME":
        failures.append("token catalogue lacks design-only notice")
    tokens = token_data.get("tokens", [])
    if token_data.get("token_count") != len(tokens) or len(tokens) != 166:
        failures.append(f"visual token count mismatch: {len(tokens)}")
    names = [item.get("name") for item in tokens]
    if len(names) != len(set(names)):
        failures.append("duplicate visual token names")
    categories = Counter(item.get("category") for item in tokens)
    if categories["color"] != 63 or categories["typography"] != 33:
        failures.append(f"color/typography token counts mismatch: {categories}")

    screen_data = json.loads(SCREENS.read_text(encoding="utf-8"))
    if screen_data.get("notice") != "DESIGN ONLY — NOT RUNTIME":
        failures.append("screen catalogue lacks design-only notice")
    screens = screen_data.get("screens", [])
    if len(screens) != 29:
        failures.append(f"expected 29 screens, found {len(screens)}")
    for screen in screens:
        missing = REQUIRED_SCREEN_FIELDS - screen.keys()
        if missing:
            failures.append(f"{screen.get('slug')}: missing {sorted(missing)}")
    specs = list((ROOT / "screen-specs").glob("screen-*.md"))
    if len(specs) != 29:
        failures.append(f"screen spec file count mismatch: {len(specs)}")
    for path in specs:
        headings = {line.strip() for line in path.read_text(encoding="utf-8").splitlines()}
        missing = REQUIRED_SCREEN_SECTIONS - headings
        if missing:
            failures.append(f"{path.name}: missing sections {sorted(missing)}")

    diagrams = {path.name for path in (ROOT / "diagrams").glob("*.md")}
    if diagrams != REQUIRED_DIAGRAMS:
        failures.append("diagram inventory mismatch")
    if len(list((ROOT / "visual-assets").glob("*.md"))) != 4:
        failures.append("visual asset specification count mismatch")

    component = (ROOT / "COMPONENT_VISUAL_SPECS.md").read_text(encoding="utf-8")
    rows = [line for line in component.splitlines() if line.startswith("| ") and not line.startswith("|---")]
    if len(rows) - 1 != 26:
        failures.append(f"component count mismatch: {len(rows) - 1}")

    combined = "\n".join(path.read_text(encoding="utf-8") for path in ROOT.rglob("*.md")).lower()
    for area, terms in REQUIRED_TERMS.items():
        absent = [term for term in terms if term not in combined]
        if absent:
            failures.append(f"{area} coverage missing: {', '.join(absent)}")

    files = [path for path in ROOT.rglob("*") if path.is_file()]
    bad = [str(path.relative_to(ROOT)) for path in files if path.suffix.lower() in FORBIDDEN_SUFFIXES]
    if bad:
        failures.append("runtime-looking files present: " + ", ".join(bad))

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    print(
        f"PASS: screens={len(screens)}, components=26, visual_tokens={len(tokens)}, "
        f"color_tokens={categories['color']}, typography_tokens={categories['typography']}, "
        f"asset_specs=4, diagrams={len(diagrams)}; all required quality domains present"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

