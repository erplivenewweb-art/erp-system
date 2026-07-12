# Token Integration

Canonical source: `storefront/src/tokens/tokens.json`, version 1.1.0, with provenance from Phase 2A/2C and no runtime dependency on `docs/`.

128 tokens:

- color 29
- typography 25
- spacing 14
- radius 5
- border 2
- elevation 4
- motion 7
- layout 7
- breakpoint 4
- z-index 6
- component 10
- theme 15

Validation checks unique names, required values, supported types/categories and missing references. Generation resolves `{token.reference}` to CSS-variable references deterministically and produces `tokens.generated.css` plus typed `tokens.generated.ts`. Predev/prebuild regenerate artifacts.

Static style guard rejects hard-coded component hex colors, unsafe HTML, inline style objects and unjustified component `!important`. Global `!important` remains limited to the approved reduced-motion accessibility reset.

