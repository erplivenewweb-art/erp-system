# Contract Validation Support

This folder is isolated, offline support. It has no ERP runtime, database, route, network, environment, or package-script dependency.

Run from repository root:

```powershell
python docs/phase-1b/contracts/v1/validation/validate_contracts.py
```

The validator checks that schema and examples parse, validates examples with `jsonschema` when available, scans schema/examples for forbidden sensitive field names, and verifies required v1 definitions. If `jsonschema` is absent it uses a dependency-free validator for the schema keywords used by these contracts; it does not modify dependencies.

Compatibility review remains mandatory because schema tooling cannot detect all semantic changes. Compare a proposed schema with the approved copy using the rules in `COMPATIBILITY.md`.
