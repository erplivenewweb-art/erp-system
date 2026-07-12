# Visual Verification

Live verification completed on 2026-07-13.

| Viewport | Screen | Result |
|---|---|---|
| 1440×900 | Dealer landing | Hero, CTA focus, benefits and public shell pass; 0px overflow |
| 1024×768 | Registration | Two-column form and keyboard focus pass; 0px overflow |
| 768×1024 | Dashboard | Portal navigation, cards and responsive shell pass; 0px overflow |
| 390×844 | Bulk order | Mobile navigation and table scroll internally; 0px document overflow |

Quotation centre was additionally verified at 768×1024 with one H1, four form controls, explicit empty state and zero overflow. Keyboard focus ring was solid and visible. Browser console warnings/errors: none.

Issue found and fixed: axe detected a nested main landmark in DealerShell. The inner main was changed to a neutral div because the root layout already supplies the page main. Tests and all final gates passed after the fix.

Evidence under `evidence/`: `dealer-landing-desktop-1440x900.png`, `registration-laptop-1024x768.png`, `dashboard-tablet-768x1024.png`, `bulk-order-mobile-390x844.png`.
