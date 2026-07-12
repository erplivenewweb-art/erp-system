"""Static Phase 2D blueprint and Product Bible validation. No runtime or network access."""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIBLE = ROOT.parent / "product-bible"
CATALOG = ROOT / "architecture-catalog.json"
REQUIRED_DOCS = {
"README.md","FRONTEND_STACK_DECISION.md","FRONTEND_ARCHITECTURE.md","FOLDER_STRUCTURE.md",
"ROUTING_RENDERING.md","COMPONENT_ARCHITECTURE.md","DESIGN_TOKEN_IMPLEMENTATION.md",
"STYLING_STRATEGY.md","STATE_MANAGEMENT.md","API_CLIENT_ARCHITECTURE.md",
"AUTH_FRONTEND.md","SEO_ARCHITECTURE.md","MEDIA_ASSET_PIPELINE.md",
"PERFORMANCE_ENGINEERING.md","ACCESSIBILITY_ENGINEERING.md","ERROR_LOADING_OFFLINE.md",
"FORMS_ARCHITECTURE.md","ANALYTICS_CONSENT.md","TESTING_STRATEGY.md",
"SECURITY_ENGINEERING.md","DEPLOYMENT_ARCHITECTURE.md","CMS_INTEGRATION.md",
"FUTURE_READY.md","PHASE_3_IMPLEMENTATION_PLAN.md","OPEN_DECISIONS.md"
}
REQUIRED_DIAGRAMS = {f"{i:02d}-{name}.md" for i,name in enumerate([
"frontend-system-architecture","route-layout-hierarchy","rendering-caching",
"component-layering","state-ownership","api-client-boundaries","authentication-flow",
"theme-token-flow","media-pipeline","deployment-topology","testing-pyramid",
"phase-3-sequence"],1)}
FORBIDDEN_SUFFIXES={".html",".css",".js",".jsx",".ts",".tsx",".sql",".env",".vue"}
PHASES=["1A","1B","1C","1D","2A","2B","2C","2D"]


def main() -> int:
    failures=[]
    names={p.name for p in ROOT.glob("*.md")}
    missing=REQUIRED_DOCS-names
    if missing: failures.append("missing Phase 2D documents: "+", ".join(sorted(missing)))
    data=json.loads(CATALOG.read_text(encoding="utf-8"))
    decisions=data.get("decisions",{})
    if decisions.get("stack")!="Next.js App Router + React + TypeScript":
        failures.append("one final frontend stack not selected")
    if decisions.get("styling")!="CSS Modules + generated semantic CSS custom properties":
        failures.append("one final styling strategy not selected")
    if decisions.get("browser_internal_api_access") is not False:
        failures.append("browser internal API access is not forbidden")
    if len(data.get("route_groups",[]))!=5: failures.append("route-group count mismatch")
    if len(data.get("modules",[]))!=46: failures.append("module count mismatch")
    if len(data.get("testing_layers",[]))!=11: failures.append("testing-layer count mismatch")
    if data.get("phase3_subphases")!=[f"3{c}" for c in "ABCDEFGHIJ"]:
        failures.append("Phase 3 subphase inventory mismatch")
    if any(m.get("erp_dependency")!="NONE" or m.get("runtime_status")!="FUTURE_NOT_CREATED" for m in data.get("modules",[])):
        failures.append("module catalogue has ERP/runtime conflict")

    diagrams={p.name for p in (ROOT/"diagrams").glob("*.md")}
    if diagrams!=REQUIRED_DIAGRAMS: failures.append("diagram inventory mismatch")
    plan=(ROOT/"PHASE_3_IMPLEMENTATION_PLAN.md").read_text(encoding="utf-8")
    for phase in [f"Phase 3{c}" for c in "ABCDEFGHIJ"]:
        if phase not in plan: failures.append(f"missing {phase}")
    for label in ["Scope:","Files allowed:","Files prohibited:","Dependencies:","Deliverables:","Tests:","Exit gate:","Rollback:","ERP regression check:"]:
        if plan.count(label)<10: failures.append(f"Phase 3 boundary field incomplete: {label}")

    if {p.name for p in BIBLE.glob("*.md")} != {"README.md","MASTER_PRODUCT_BIBLE_V1.md","SOURCE_INDEX.md","DECISION_INDEX.md"}:
        failures.append("Product Bible file inventory mismatch")
    source=(BIBLE/"SOURCE_INDEX.md").read_text(encoding="utf-8")
    master=(BIBLE/"MASTER_PRODUCT_BIBLE_V1.md").read_text(encoding="utf-8").lower()
    for phase in PHASES:
        if phase not in source: failures.append(f"Product Bible source missing Phase {phase}")
    for term in ["erp protection","b2c","b2b","data","api","brand","ux","visual","frontend","security","accessibility","performance","testing","deployment","future"]:
        if term not in master: failures.append(f"Product Bible topic missing: {term}")

    combined="\n".join(p.read_text(encoding="utf-8") for p in ROOT.rglob("*.md")).lower()
    for term in ["cms","seo","accessibility","performance","security","testing","deployment","future","customer","dealer","/internal/v1/","never call"]:
        if term not in combined: failures.append(f"blueprint coverage missing: {term}")
    files=[p for base in (ROOT,BIBLE) for p in base.rglob("*") if p.is_file()]
    bad=[str(p) for p in files if p.suffix.lower() in FORBIDDEN_SUFFIXES]
    if bad: failures.append("runtime-looking files present: "+", ".join(bad))

    if failures:
        for failure in failures: print("FAIL: "+failure,file=sys.stderr)
        return 1
    print("PASS: stack=Next.js App Router + React + TypeScript; styling=CSS Modules; "
          "modules=46, route_groups=5, testing_layers=11, phase3_subphases=10, "
          "diagrams=12, product_bible_files=4; all required boundaries and topics present")
    return 0

if __name__=="__main__":
    raise SystemExit(main())

