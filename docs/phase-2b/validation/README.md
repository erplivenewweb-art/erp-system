# Static UX Validation

Run with Python 3:

```powershell
python docs/phase-2b/validation/validate_ux.py
```

The dependency-free validator checks the 36-page design-only catalogue, all required per-page fields and Markdown sections, one wireframe per page, six journeys, ten exact diagrams, unique CTAs/events and explicit mobile/tablet/desktop, CMS, B2C, B2B/dealer, accessibility, SEO, ERP-isolation, performance and future-app coverage. It rejects runtime-looking HTML, CSS, JavaScript, TypeScript, SQL and environment files.

It makes no network, database, ERP, package, runtime or deployment call.

