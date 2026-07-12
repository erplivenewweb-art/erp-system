# Build Baseline

Final gates:

| Gate | Result | Duration |
|---|---|---:|
| Token generation | Pass, 128 tokens | 1.159s |
| Token validation | Pass | 1.107s |
| Boundary guard | Pass, 178 source files | 1.343s |
| Style guard | Pass | 1.314s |
| Lint | Pass | 9.585s |
| Typecheck | Pass | 3.680s |
| Tests | 94/94, 15 files | 11.690s command / 9.77s runner |
| Production build | Pass, 61 pages | 19.207s |
| npm audit | Pass, 0 vulnerabilities | 2.776s |

Build output classes: static `○` routes and statically generated `●` parameterized category, collection, product and account-order routes.
