# SEO and Accessibility

All private-intent commerce screens are noindex. Cart and wishlist use relative canonical placeholders; checkout, confirmation and order history are noindex/no-follow. Each route has one H1 and semantic landmarks/headings.

WCAG 2.2 AA foundations include native labelled controls, auto-complete hints, keyboard-operable buttons, visible token-driven focus, 44px touch targets, named order-summary regions, semantic stepper navigation, dialog labelling, Escape/focus restoration through the shared Drawer and reduced-motion-safe CSS.

Automated axe checks for cart and checkout returned zero violations with JSDOM color contrast disabled; rendered focus and semantic-token colors were inspected live. No unsafe HTML, payment SDK, external script, secret, ERP/internal route string or browser network call was added.
