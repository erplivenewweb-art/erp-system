# Architecture Baseline

- Framework: Next.js App Router 16.2.10, React 19.2.7, TypeScript 5.9.3.
- Rendering: Server Components by default; 10 intentional client boundaries for interactive navigation, overlays, gallery, mini-cart, tabs/actions and error recovery.
- Styling: 20 CSS Modules plus generated semantic-token CSS; no Tailwind or CSS-in-JS.
- Features: `home`, `catalog`, `product`, `cart`, `wishlist`, `checkout`, `account`, `orders`, `address`, `profile`, `security`, `dealer`, `b2b`, `quotation`, `bulk-order`, `cms`, `admin`, `media`, `blog`.
- Shared primitives: layout, typography, forms, actions, display, feedback, navigation, overlays, commerce shells, icons and public shell.
- Global states: root layout, loading, route/global error, not-found and design-system validation route.

Canonical storefront file inventory: 207 files, SHA-256 `1d6b7b3d03ebfe003ace262433aafabccc8ce7d3e122f8b44112fcdd82c12ce3` (`rg --files storefront`, sorted, each path paired with content SHA-256).
