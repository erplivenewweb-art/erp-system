# Scaffold Architecture

Next.js 16.2.10 App Router, React 19.2.7 and strict TypeScript 5.9.3 form a standalone project. Root layout provides language, metadata/noindex, skip link, header/main/footer landmarks and base styles. Root page identifies Phase 3A. Loading, route error, global error and not-found boundaries are accessible.

CSS Modules own component/page styles. A minimal global reset imports generated semantic variables. Dark/festival attributes have structural token readiness but no switching UI.

Current source areas: `app`, `config`, `lib`, `styles`, `tokens`, `types`, `test`, plus build scripts. Future approved extensions may add feature-oriented components/features/media/i18n/analytics only in their scheduled Phase 3 subphase.

Forbidden: ERP imports/routes/auth/credentials, `/internal/v1/`, DB drivers, Commerce backend, live API clients, business pages/features and production domains.

