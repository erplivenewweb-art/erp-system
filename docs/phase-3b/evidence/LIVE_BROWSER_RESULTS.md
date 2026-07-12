# Phase 3B Live Browser Results

Date: 2026-07-12  
Server: local Next.js development server, `127.0.0.1:3100`

| Viewport | Route | Horizontal overflow | Result |
| --- | --- | ---: | --- |
| 1440x900 | `/design-system`, `/` | 0px | Pass |
| 768x1024 | `/design-system`, `/` | 0px after fix | Pass |
| 390x844 | `/design-system`, `/` | 0px | Pass |

Verified layout, responsive flow, typography, spacing, light theme, dark readiness, form labels/help/error and input behavior, tabs, accordion, modal, drawer, toast, loading, empty and error states. Modal and drawer moved focus to their close controls; explicit close restored focus to the trigger. Visible focus outline was present. The loading boundary appeared during live navigation.

Issue found: the `/design-system` wrapper overflowed horizontally by 14px at 768px. Cause: its negative responsive gutter exceeded the scaffold shell's fixed 1rem inset. Fix: align the wrapper's negative inline margin to `--sf-space-4`. Retest: 0px overflow at all tested widths.

Reduced motion: the browser's live OS preference was normal (`prefers-reduced-motion: reduce` false). The reduced-motion media rules and component-specific no-animation rules were revalidated, and automated coverage remained green; the approved browser surface did not expose OS preference forcing.

Post-fix automated gates: lint pass; strict typecheck pass; Vitest 6/6 files and 20/20 tests pass; boundary guard 49 files pass; style guard pass; production build pass with static `/`, `/_not-found`, `/design-system`; npm audit 0 vulnerabilities.

ERP/root integrity: the pre-existing dirty ERP file list is unchanged. No ERP, root package, database, deployment, route or previous-phase file was modified. Phase 3C was not started. Phase 3B is not declared fully complete until a browser/OS session with forced reduced motion can be run.
