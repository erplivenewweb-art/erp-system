# Testing and Build

Current automated gate:

- token generation/validation: 128 passed
- boundary scan: 49 browser-source files passed
- style/security scan: passed
- ESLint: passed
- strict TypeScript: passed
- Vitest: 6 files, 20 tests passed
- axe: scaffold and showcase foundation passed, excluding jsdom contrast computation
- production build: passed
- routes: static `/`, `/_not-found`, `/design-system`
- npm audit after test-only dependencies: zero vulnerabilities at install; final audit is rerun for handoff

New dependencies are test-only: `@testing-library/react@16.3.2`, `@testing-library/user-event@14.6.1`, `@testing-library/jest-dom@6.9.1`. No runtime dependency changed.

Build-size comparison is measured from generated outputs; route transfer size requires browser/network tooling and Phase 3J performance tests. The showcase’s client code is route-split and does not add a client import to the root page.

