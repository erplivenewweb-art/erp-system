"""Static Phase 2B UX validation. No runtime, network, DB, or ERP access."""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "wireframes" / "page-catalog.json"
REQUIRED_FIELDS = {
    "purpose", "business_goal", "user_goal", "primary_cta", "secondary_cta",
    "desktop_layout", "tablet_layout", "mobile_layout", "cms_editable_areas",
    "seo_areas", "accessibility_notes", "performance_notes", "animation_notes",
    "analytics_events", "future_app_mapping",
}
REQUIRED_SECTIONS = {
    "## Purpose", "## Business goal", "## User goal", "## Calls to action",
    "## Desktop layout", "## Tablet layout", "## Mobile layout",
    "## CMS editable areas", "## SEO areas", "## Accessibility notes",
    "## Performance notes", "## Animation notes", "## Analytics events",
    "## Future app mapping",
}
REQUIRED_DIAGRAMS = {
    "01-site-navigation.md", "02-b2c-journey.md", "03-b2b-journey.md",
    "04-dealer-flow.md", "05-customer-flow.md", "06-search-flow.md",
    "07-checkout-flow.md", "08-cms-workflow.md", "09-homepage-sections.md",
    "10-content-publishing.md",
}
REQUIRED_TERMS = {
    "mobile-first": ["mobile", "4-column"],
    "tablet": ["tablet", "8-column"],
    "desktop": ["desktop", "12-column"],
    "cms": ["cms", "publish", "preview"],
    "b2c": ["b2c", "guest", "wishlist", "checkout"],
    "b2b": ["b2b", "dealer", "moq", "quotation"],
    "accessibility": ["wcag 2.2 aa", "keyboard", "screen-reader", "focus"],
    "seo": ["seo", "canonical", "structured data"],
    "erp": ["erp", "never"],
    "performance": ["lcp", "inp", "lazy-load"],
    "future": ["android", "iphone", "pwa", "marketplace", "ai"],
}
FORBIDDEN_SUFFIXES = {".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".sql", ".env"}


def main() -> int:
    failures = []
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    if data.get("notice") != "DESIGN ONLY — NOT RUNTIME":
        failures.append("page catalogue lacks design-only notice")
    pages = data.get("pages", [])
    if len(pages) != 36:
        failures.append(f"expected 36 pages, found {len(pages)}")
    ids = {page.get("id") for page in pages}
    slugs = {page.get("slug") for page in pages}
    if len(ids) != len(pages) or len(slugs) != len(pages):
        failures.append("duplicate page ID or slug")
    for page in pages:
        missing = REQUIRED_FIELDS - page.keys()
        if missing:
            failures.append(f"{page.get('slug')}: missing fields {sorted(missing)}")
        if not page.get("analytics_events"):
            failures.append(f"{page.get('slug')}: analytics events absent")
    frame_files = sorted((ROOT / "wireframes").glob("page-*.md"))
    if len(frame_files) != len(pages):
        failures.append(f"wireframe file count {len(frame_files)} != page count {len(pages)}")
    for path in frame_files:
        content = path.read_text(encoding="utf-8")
        absent = REQUIRED_SECTIONS - {line.strip() for line in content.splitlines()}
        if absent:
            failures.append(f"{path.name}: missing sections {sorted(absent)}")

    diagrams = {path.name for path in (ROOT / "diagrams").glob("*.md")}
    if diagrams != REQUIRED_DIAGRAMS:
        failures.append("diagram inventory mismatch")
    journeys = list((ROOT / "journeys").glob("*.md"))
    if len(journeys) != 6:
        failures.append(f"expected 6 journey files, found {len(journeys)}")
    files = [path for path in ROOT.rglob("*") if path.is_file()]
    bad = [str(path.relative_to(ROOT)) for path in files if path.suffix.lower() in FORBIDDEN_SUFFIXES]
    if bad:
        failures.append("runtime-looking files present: " + ", ".join(bad))

    combined = "\n".join(path.read_text(encoding="utf-8") for path in ROOT.rglob("*.md")).lower()
    for area, terms in REQUIRED_TERMS.items():
        absent = [term for term in terms if term not in combined]
        if absent:
            failures.append(f"{area} coverage missing: {', '.join(absent)}")

    ctas = {
        value for page in pages
        for value in (page.get("primary_cta"), page.get("secondary_cta"))
        if value and value != "None"
    }
    events = {event for page in pages for event in page.get("analytics_events", [])}
    if len(ctas) < 25:
        failures.append(f"CTA inventory unexpectedly small: {len(ctas)}")
    if len(events) != len(pages) * 4:
        failures.append("analytics event names are not unique per page")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    print(
        f"PASS: pages={len(pages)}, wireframes={len(frame_files)}, journeys={len(journeys)}, "
        f"diagrams={len(diagrams)}, ctas={len(ctas)}, analytics_events={len(events)}; "
        "mobile/tablet/desktop/CMS/B2C/B2B/dealer/a11y/SEO/ERP/performance/future coverage present"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

