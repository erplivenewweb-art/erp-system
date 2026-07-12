# Final Styling Strategy

## Decision

Use **CSS Modules** plus generated semantic CSS custom properties. No CSS tool is installed in Phase 2D.

| Option | Assessment |
|---|---|
| CSS Modules | Local scope, low runtime/bundle cost, explicit luxury styling, native media/container queries and print; selected |
| Tailwind | Fast composition but risks token/class sprawl and verbose high-fidelity exceptions |
| Vanilla Extract | Strong typing/build-time themes but adds specialized toolchain |
| Styled Components | Flexible runtime theming but runtime/SSR complexity and payload |
| Plain global CSS | Minimal but weak isolation/ownership at scale |

Future style layers: standards-based reset; minimal globals for body/type/focus; layout helpers; feature/component `.module.css`; generated theme variables; motion utilities with reduced-motion override; print sheets for customer-safe order/quote views only. Avoid global utility proliferation, deep selectors, `!important`, arbitrary colors/spacing and JS-driven responsive layout. CMS preview loads the same token/theme outputs in isolation.

