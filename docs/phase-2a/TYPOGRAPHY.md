# Typography

Display recommendation: Cormorant Garamond with Georgia fallback for editorial Latin headings; Noto Serif Bengali for Bengali editorial content. Body/UI recommendation: Inter/system UI with Noto Sans Bengali. Final licenses, glyph coverage, Indian-script shaping and performance require review.

Scale: 12px captions; 14px labels; 16px body; 18px large body; 20px small heading; 24px H4; 32px H3; 42px H2; 56px H1; 76px display on wide screens. Mobile H1 clamps around 38–48px. Body line height 1.55; editorial copy 1.7; headings 1.1–1.2. Reading measure 45–75 characters.

Use sentence case. All-caps is restricted to short eyebrow labels with 0.14em tracking. Never use display fonts for prices, form labels, long body, tables or legal text. Prices use tabular numerals. Indian numbering presentation and international currency formatting are locale-driven.

Font strategy: self-host approved WOFF2 subsets; preload at most one critical body face; use `font-display: swap`; avoid layout shift through metric-compatible fallbacks. Do not subset away required Bengali/Indian-script glyphs.

