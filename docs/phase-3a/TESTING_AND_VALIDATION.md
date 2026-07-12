# Testing and Validation

## Automated checks

- Token validation/generation: 50 unique tokens.
- Boundary scan: 16 storefront source files, no forbidden terms.
- ESLint: pass.
- Strict TypeScript: pass.
- Vitest: 4 files, 8 tests, all pass.
- Accessibility: axe-core scan of scaffold content, semantic layout/loading/not-found assertions, focus/reduced-motion foundations.
- Dependency boundary: only Next/React/React DOM runtime dependencies; no DB/ERP package.
- Production build: pass; static `/` and `/_not-found`.
- npm audit: zero vulnerabilities.
- Development smoke: Next ready in 737ms; GET `/` HTTP 200; expected scaffold text found; server stopped.

The automated axe test disables jsdom-incompatible color contrast computation; contrast requires real-browser/manual validation.

## Commands executed

`npm install`; token generation/validation; boundary check; lint; typecheck; Vitest; two production builds (second after explicit Turbopack root); development-server HTTP smoke; npm audit; dependency inventory.

## Remaining manual tests

Real browser keyboard/focus/zoom/reduced-motion and screen-reader check; verify security headers/CSP in selected hosting; preview/standalone deployment smoke; Windows/macOS/Linux clean install; selected supported Node LTS; CI reproduction.

