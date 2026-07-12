"""Offline validation for Phase 1B commerce contracts. No ERP or network access."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "schema" / "commerce-contracts.schema.json"
EXAMPLES = ROOT / "examples"
REQUIRED_DEFINITIONS = {
    "Product", "ProductVariant", "ProductMedia", "Collection", "Category",
    "InventoryAvailability", "InventoryStatus", "PriceQuote", "RetailPrice",
    "WholesalePrice", "DealerSpecialPrice", "PriceBreak", "MOQRule",
    "CustomerProfile", "CustomerType", "DealerProfile", "DealerLevel",
    "DealerCategory", "ApprovalStatus", "Quotation", "QuotationStatus",
    "CreditTerms", "OrderChannel", "PublishStatus", "Visibility", "Pagination",
    "Sorting", "Filtering", "Search", "AuditMetadata", "ErrorResponse",
    "SuccessResponse", "RequestMetadata", "ResponseMetadata", "VersionMetadata",
}
FORBIDDEN_KEYS = {
    "internalcost", "costprice", "manufacturingsecret", "manufacturingrecipe",
    "employeedata", "employeeid", "erptoken", "erpauthentication",
    "erpauth_token", "branchid", "companyid", "accountingdata", "ledgerbalance",
    "databaseid", "rowid", "physicalbarcode", "barcodevalue", "exactstock",
    "stockquantity", "onhandquantity",
}


def load(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def normalized_key(value: str) -> str:
    return "".join(ch for ch in value.lower() if ch.isalnum() or ch == "_")


def scan_keys(value, location="$"):
    failures = []
    if isinstance(value, dict):
        for key, child in value.items():
            normalized = normalized_key(key)
            if normalized in FORBIDDEN_KEYS:
                failures.append(f"{location}.{key}: forbidden sensitive field")
            failures.extend(scan_keys(child, f"{location}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            failures.extend(scan_keys(child, f"{location}[{index}]"))
    return failures


def target_definition(filename: str):
    return "ErrorResponse" if filename == "error-response.json" else None


def basic_validate(value, rule, root, location="$"):
    """Validate the schema subset used here when jsonschema is unavailable."""
    errors = []
    if "$ref" in rule:
        name = rule["$ref"].removeprefix("#/$defs/")
        return basic_validate(value, root["$defs"][name], root, location)
    for branch in rule.get("allOf", []):
        errors.extend(basic_validate(value, branch, root, location))
    condition = rule.get("if")
    if condition and not basic_validate(value, condition, root, location):
        errors.extend(basic_validate(value, rule.get("then", {}), root, location))
    if "const" in rule and value != rule["const"]:
        errors.append(f"{location}: expected constant {rule['const']!r}")
    if "enum" in rule and value not in rule["enum"]:
        errors.append(f"{location}: value is not in enum")
    expected = rule.get("type")
    if expected:
        names = expected if isinstance(expected, list) else [expected]
        checks = {
            "object": lambda item: isinstance(item, dict),
            "array": lambda item: isinstance(item, list),
            "string": lambda item: isinstance(item, str),
            "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
            "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
            "boolean": lambda item: isinstance(item, bool),
            "null": lambda item: item is None,
        }
        if not any(checks[name](value) for name in names):
            return [f"{location}: expected type {expected}"]
    if isinstance(value, dict):
        for key in rule.get("required", []):
            if key not in value:
                errors.append(f"{location}: missing required property {key}")
        properties = rule.get("properties", {})
        if rule.get("additionalProperties") is False:
            for key in value.keys() - properties.keys():
                errors.append(f"{location}.{key}: additional property is forbidden")
        for key, child in value.items():
            if key in properties:
                errors.extend(basic_validate(child, properties[key], root, f"{location}.{key}"))
    if isinstance(value, list):
        if len(value) < rule.get("minItems", 0):
            errors.append(f"{location}: too few items")
        if len(value) > rule.get("maxItems", len(value)):
            errors.append(f"{location}: too many items")
        if rule.get("uniqueItems") and len({json.dumps(item, sort_keys=True) for item in value}) != len(value):
            errors.append(f"{location}: duplicate items")
        for index, child in enumerate(value):
            errors.extend(basic_validate(child, rule.get("items", {}), root, f"{location}[{index}]"))
    if isinstance(value, str):
        if len(value) < rule.get("minLength", 0):
            errors.append(f"{location}: string is too short")
        if len(value) > rule.get("maxLength", len(value)):
            errors.append(f"{location}: string is too long")
        if "pattern" in rule and re.fullmatch(rule["pattern"], value) is None:
            errors.append(f"{location}: pattern mismatch")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value < rule.get("minimum", value):
            errors.append(f"{location}: below minimum")
        if value > rule.get("maximum", value):
            errors.append(f"{location}: above maximum")
    return errors


def main() -> int:
    failures = []
    schema = load(SCHEMA)
    definitions = set(schema.get("$defs", {}))
    missing = sorted(REQUIRED_DEFINITIONS - definitions)
    if missing:
        failures.append("Missing definitions: " + ", ".join(missing))
    failures.extend(scan_keys(schema, "schema"))

    try:
        import jsonschema
        jsonschema.Draft202012Validator.check_schema(schema)
        validator = jsonschema.Draft202012Validator(
            schema, format_checker=jsonschema.FormatChecker()
        )
    except ImportError:
        validator = None
        print("INFO: jsonschema is unavailable; using the dependency-free contract subset validator.")
    except Exception as exc:
        failures.append(f"Invalid schema: {exc}")
        validator = None

    for path in sorted(EXAMPLES.glob("*.json")):
        payload = load(path)
        failures.extend(f"{path.name}: {item}" for item in scan_keys(payload))
        definition = target_definition(path.name)
        if validator is None:
            active_schema = (
                {"$ref": f"#/$defs/{definition}", "$defs": schema["$defs"]}
                if definition
                else schema
            )
            failures.extend(
                f"{path.name}: {error}"
                for error in basic_validate(payload, active_schema, schema)
            )
            continue
        active = (
            jsonschema.Draft202012Validator(
                {
                    "$schema": schema["$schema"],
                    "$defs": schema["$defs"],
                    "$ref": f"#/$defs/{definition}",
                },
                format_checker=jsonschema.FormatChecker(),
            )
            if definition
            else validator
        )
        for error in sorted(active.iter_errors(payload), key=lambda item: list(item.path)):
            pointer = "/" + "/".join(str(part) for part in error.path)
            failures.append(f"{path.name}{pointer}: {error.message}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}", file=sys.stderr)
        return 1
    print(f"PASS: {len(definitions)} definitions and {len(list(EXAMPLES.glob('*.json')))} examples validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
