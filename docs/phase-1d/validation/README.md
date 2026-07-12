# Static API Design Validation

Run with Python 3:

```powershell
python docs/phase-1d/validation/validate_api_design.py
```

The dependency-free validator parses the endpoint catalogue and examples; checks groups, namespaces, unique method/path pairs, mandatory endpoint metadata, schema references, approved-dealer pricing gates, future-only internal mutations, envelope metadata, sensitive fields and explicit ERP route/database prohibitions.

It makes no network call and opens no database, runtime, environment, migration or ERP process.

