"""Offline Phase 1D API design validation. No runtime, network, DB, or ERP access."""
from __future__ import annotations
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "api" / "endpoint-catalog.json"
EXAMPLES = ROOT / "api" / "examples"
REQUIRED_GROUPS = {"public", "customer", "dealer", "admin", "internal"}
REQUIRED_ENDPOINT_FIELDS = {
    "group", "method", "path", "purpose", "auth_level", "request_schema",
    "response_schema", "error_schema", "rate_limit_class", "status",
    "permissions", "idempotency", "cache_policy", "company_scope",
}
ALLOWED_PREFIX = {
    "public": "/commerce/v1/public/",
    "customer": "/commerce/v1/customer/",
    "dealer": "/commerce/v1/dealer/",
    "admin": "/commerce/v1/admin/",
    "internal": "/internal/v1/",
}
FORBIDDEN_NAMES = {
    "erp_id", "barcode", "physical_barcode", "internal_cost", "employee_data",
    "accounting_data", "manufacturing_secret", "branch_id", "company_id",
    "sql", "stack_trace", "database_password",
}


def keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from keys(child)


def main() -> int:
    failures = []
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    if data.get("notice") != "DESIGN ONLY — NOT RUNTIME":
        failures.append("machine artifact lacks exact design-only notice")
    endpoints = data.get("endpoints", [])
    schemas = {item["name"] for item in data.get("schemas", [])}
    groups = Counter(item.get("group") for item in endpoints)
    if set(groups) != REQUIRED_GROUPS:
        failures.append(f"API groups mismatch: {sorted(groups)}")
    seen = set()
    for index, endpoint in enumerate(endpoints):
        label = f"endpoint[{index}]"
        missing = REQUIRED_ENDPOINT_FIELDS - endpoint.keys()
        if missing:
            failures.append(f"{label}: missing {sorted(missing)}")
        method_path = (endpoint.get("method"), endpoint.get("path"))
        if method_path in seen:
            failures.append(f"duplicate endpoint {method_path}")
        seen.add(method_path)
        group = endpoint.get("group")
        if group in ALLOWED_PREFIX and not endpoint.get("path", "").startswith(ALLOWED_PREFIX[group]):
            failures.append(f"{label}: path outside group namespace")
        if endpoint.get("method") not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
            failures.append(f"{label}: unsupported method")
        for field in ("request_schema", "response_schema", "error_schema"):
            if endpoint.get(field) not in schemas:
                failures.append(f"{label}: unknown {field} {endpoint.get(field)}")
        if endpoint.get("group") == "dealer" and ("price" in endpoint.get("path", "") or "catalogue" in endpoint.get("path", "")):
            if endpoint.get("auth_level") != "APPROVED_DEALER":
                failures.append(f"{label}: wholesale resource lacks approved-dealer gate")
        if endpoint.get("group") == "internal" and endpoint.get("rate_limit_class") == "INTERNAL_MUTATION":
            if endpoint.get("status") != "FUTURE_NOT_IMPLEMENTED":
                failures.append(f"{label}: internal mutation is not marked future")
        if re.search(r"(^|/)api(/|$)|/getStock|/saveBilling", endpoint.get("path", "")):
            failures.append(f"{label}: possible existing ERP route dependency")

    if not data.get("rules", {}).get("direct_erp_database_access") is False:
        failures.append("direct ERP database access is not explicitly forbidden")
    if not data.get("rules", {}).get("erp_routes_directly_callable") is False:
        failures.append("direct ERP routes are not explicitly forbidden")

    for path in sorted(EXAMPLES.glob("*.json")):
        value = json.loads(path.read_text(encoding="utf-8"))
        found = {key.lower() for key in keys(value)} & FORBIDDEN_NAMES
        if found:
            failures.append(f"{path.name}: forbidden fields {sorted(found)}")
        if value.get("success") is True and not {"data", "metadata"} <= value.keys():
            failures.append(f"{path.name}: invalid success envelope")
        if value.get("success") is False and not {"error", "metadata"} <= value.keys():
            failures.append(f"{path.name}: invalid error envelope")
        meta = value.get("metadata", {})
        if not {"requestId", "correlationId", "generatedAt", "contractVersion"} <= meta.keys():
            failures.append(f"{path.name}: incomplete metadata")

    required_terms = {
        "PriceQuoteResponse", "AvailabilityResponse", "QuotationResponse",
        "OrderResponse", "RequestMetadata", "ResponseMetadata", "ErrorResponse",
    }
    if not required_terms <= schemas:
        failures.append("Phase 1B/1C contract reference schemas are incomplete")
    if groups["public"] == 0 or groups["customer"] == 0 or groups["dealer"] == 0:
        failures.append("B2C/B2B V1 coverage missing")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    print(
        "PASS: "
        + ", ".join(f"{group}={groups[group]}" for group in sorted(groups))
        + f"; endpoints={len(endpoints)}, schemas={len(schemas)}, examples={len(list(EXAMPLES.glob('*.json')))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
