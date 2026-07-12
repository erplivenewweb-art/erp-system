# Performance Engineering

Targets p75 representative mobile: LCP ≤2.5s, CLS ≤0.1, INP ≤200ms. Initial compressed budgets: critical CSS ≤20KB; route-critical JS ≤50KB; total first-party initial JS ≤150KB; any route chunk ≤100KB; reviewed third-party ≤50KB; critical fonts ≤100KB; LCP image usually ≤200KB; initial images ≤700KB. Animation: transform/opacity, ≤420ms editorial, no continuous commerce motion.

Server Components reduce hydration. Split by route/feature; dynamic import galleries, charts, rich editor and provider SDKs only on demand. Prefetch intent-aware, not bulk on metered/mobile. Preload only LCP/font truly critical. CDN caches immutable assets/public HTML/data by policy; private responses no-store.

Dealer lists paginate/virtualize accessibly; search typing remains responsive with cached suggestions ≤150ms and useful remote target ≤500ms. Gallery loads first image then intent/viewport neighbors. Third parties require owner, consent, budget, failure isolation and removal plan.

