# Token Pipeline

Canonical runtime-independent source: `storefront/src/tokens/tokens.json` with 50 unique semantic tokens. It was derived from approved Phase 2A/2C catalogues; provenance is recorded inside the source, but production never reads `docs/`.

`npm run tokens:validate` checks notice, list, names, duplicates, values and types. `npm run tokens:generate` produces:

- `src/styles/tokens.generated.css`
- `src/tokens/tokens.generated.ts`

Both generated files declare their origin and must not be hand-edited. Predev/prebuild regenerate them, preventing drift. CSS variables use `--sf-` prefix. Base semantic values plus dark/festival mappings come from the same JSON; components do not duplicate literal token values.

