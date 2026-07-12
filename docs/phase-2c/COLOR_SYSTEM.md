# Color System

Canonical tokens are in `design-tokens/visual-tokens.json`: 63 colors spanning brand, neutral, surfaces, text, borders, focus, semantic states, overlays, disabled, dark, festival and seasonal accents.

Core: Ink #151311, Ivory #F8F4EC, Silver #B9BDC2, Silver Dark #666B70, Vermilion #8C2F2B, Antique Gold #A27B43. Vermilion is the scarce primary accent; gold is editorial only and never implies material/price/certification.

Semantic colors always pair with icon and text. Disabled controls retain legibility and are not merely lowered opacity. Glass surfaces require blur support plus opaque fallback and contrast validation. Overlays never hide focus or meaning.

Festival/season tokens change accents, hero crops and decorative texture only. Layout, semantic colors, focus, product accuracy and task hierarchy remain fixed. Theme activation is scheduled, locale/audience scoped, previewed and automatically expires.

