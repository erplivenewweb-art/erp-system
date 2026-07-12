# Rollback Baseline

Phase 3K is documentation-only. Rollback removes only `docs/phase-3k/`; do not reset storefront or earlier-phase dirty work.

For a future release rollback, restore the exact Frontend v1.0 commit/tag selected by the release owner after review. Recommended tag command after an approved commit (not executed here): `git tag -a frontend-v1.0 -m "Silver Sankha Storefront Frontend v1.0"`.

Validate restoration with the route/component/token/package fingerprints in this baseline, then rerun the complete gate suite. Never use a destructive reset against the shared dirty working tree.
