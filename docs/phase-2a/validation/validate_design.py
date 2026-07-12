"""Static Phase 2A design validation. No runtime, network, database, or ERP access."""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_DOCS = {
    "README.md", "BRAND_GUIDELINES.md", "DESIGN_SYSTEM.md", "TYPOGRAPHY.md",
    "COLOR_SYSTEM.md", "COMPONENT_LIBRARY.md", "HOMEPAGE_BLUEPRINT.md",
    "PRODUCT_PAGE_BLUEPRINT.md", "B2C_USER_JOURNEY.md", "B2B_USER_JOURNEY.md",
    "CMS_BLUEPRINT.md", "IMAGE_GUIDELINES.md", "SEO_UX.md", "ACCESSIBILITY.md",
    "PERFORMANCE_UX.md", "INFORMATION_ARCHITECTURE.md", "FUTURE_READY.md",
    "OPEN_DECISIONS.md",
}
REQUIRED_DIAGRAMS = {
    "01-brand-architecture.md", "02-site-map.md", "03-navigation.md",
    "04-homepage.md", "05-b2c-journey.md", "06-b2b-journey.md",
    "07-cms-ownership.md", "08-content-flow.md", "09-search-flow.md",
    "10-product-discovery.md",
}
REQUIRED_TERMS = {
    "mobile": ["mobile", "44"],
    "accessibility": ["wcag 2.2 aa", "focus", "keyboard", "screen reader", "reduced-motion"],
    "seo": ["breadcrumb", "canonical", "structured data", "internal link"],
    "performance": ["lcp", "cls", "inp", "javascript", "font"],
    "cms": ["draft", "review", "publish", "audit"],
    "erp": ["erp", "never"],
    "b2c": ["b2c", "retail"],
    "b2b": ["b2b", "dealer", "wholesale", "moq", "quotation"],
    "future": ["android", "iphone", "pwa", "export", "marketplace", "ai"],
}
FORBIDDEN_SUFFIXES = {".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".sql", ".env"}


def token_count(value):
    if isinstance(value, dict):
        if "$value" in value:
            return 1
        return sum(token_count(child) for child in value.values())
    if isinstance(value, list):
        return sum(token_count(child) for child in value)
    return 0


def main() -> int:
    failures = []
    files = [path for path in ROOT.rglob("*") if path.is_file()]
    names = {path.name for path in ROOT.glob("*.md")}
    missing = sorted(REQUIRED_DOCS - names)
    if missing:
        failures.append("missing required documents: " + ", ".join(missing))
    diagrams = {path.name for path in (ROOT / "diagrams").glob("*.md")}
    if REQUIRED_DIAGRAMS != diagrams:
        failures.append("diagram inventory mismatch")
    wireframes = list((ROOT / "wireframes").glob("*.md"))
    if len(wireframes) < 8:
        failures.append("fewer than 8 wireframes")
    runtime = [str(path.relative_to(ROOT)) for path in files if path.suffix.lower() in FORBIDDEN_SUFFIXES]
    if runtime:
        failures.append("runtime/executable-looking files present: " + ", ".join(runtime))

    tokens = json.loads((ROOT / "design-tokens" / "tokens.json").read_text(encoding="utf-8"))
    if tokens.get("notice") != "DESIGN ONLY — NOT RUNTIME":
        failures.append("token artifact lacks design-only notice")
    count = token_count(tokens)
    if count < 100:
        failures.append(f"insufficient design tokens: {count}")

    combined = "\n".join(path.read_text(encoding="utf-8") for path in ROOT.glob("*.md")).lower()
    for area, terms in REQUIRED_TERMS.items():
        absent = [term for term in terms if term not in combined]
        if absent:
            failures.append(f"{area} coverage missing: {', '.join(absent)}")
    component = (ROOT / "COMPONENT_LIBRARY.md").read_text(encoding="utf-8")
    rows = [line for line in component.splitlines() if line.startswith("| ") and not line.startswith("|---")]
    # Two header rows precede the 46 inventory entries.
    if len(rows) - 1 < 46:
        failures.append(f"component inventory below 46: {len(rows) - 1}")
    homepage = (ROOT / "HOMEPAGE_BLUEPRINT.md").read_text(encoding="utf-8")
    section_rows = [line for line in homepage.splitlines() if line.startswith("| ") and not line.startswith("|---")]
    if len(section_rows) - 1 < 19:
        failures.append("homepage section coverage incomplete")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    print(
        f"PASS: tokens={count}, components=46, journeys=2, "
        f"wireframes={len(wireframes)}, diagrams={len(diagrams)}; "
        "mobile/accessibility/SEO/performance/CMS/ERP/B2C/B2B/future coverage present"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

