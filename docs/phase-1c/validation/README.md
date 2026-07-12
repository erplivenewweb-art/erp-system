# Static Validation

Run with Python 3:

```powershell
python docs/phase-1c/validation/validate_model.py
```

The script reads only the Phase 1C JSON catalogue. It checks the full required entity inventory, per-entity metadata, unique entity/relationship identities, valid relationship targets, owner presence, B2C/B2B concepts and channels, availability statuses, sensitive field exclusions, opaque public-ID strategy, and absence of a direct ERP-write ownership conflict.

It does not connect to any database, server, network, environment, ERP process, migration tool, or runtime.

