# Performance UX

Targets at the 75th percentile on representative mobile: LCP ≤2.5s, CLS ≤0.1, INP ≤200ms. FID is monitored only as legacy context; INP is the interaction target.

Initial mobile budgets: HTML ≤35KB compressed; critical CSS ≤20KB compressed; total initial CSS ≤60KB; first-party JavaScript ≤150KB compressed with ≤50KB initial interaction-critical; third-party JS ≤50KB and consent/necessity reviewed; critical fonts ≤100KB; LCP image usually ≤200KB; initial page image transfer ≤700KB. Budgets require measurement and may tighten.

Prioritize the actual LCP image; reserve all media/ad/embed dimensions; avoid client-only primary content; use system/metric-compatible fallback and limited WOFF2. Critical CSS covers above-fold structure and focus; noncritical styles load progressively. Route/content chunks are demand-loaded.

Motion stays compositor-friendly, under 240ms for controls, with no long main-thread choreography. Third-party social/video embeds use poster-to-consent activation. Skeletons preserve layout but never delay already available text. Performance is tested on low/mid mobile, constrained network, long dealer lists and localized fonts.

